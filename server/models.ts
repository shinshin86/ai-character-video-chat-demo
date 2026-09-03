const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const MODEL_CACHE_TTL_MS = 15 * 60 * 1_000;

export interface LlmModelOption {
  id: string;
  name: string;
  provider: string;
  contextLength: number | null;
  promptPerMillion: number | null;
  completionPerMillion: number | null;
}

interface ModelCatalog {
  models: LlmModelOption[];
  fetchedAt: string;
}

let cachedCatalog: (ModelCatalog & { expiresAt: number }) | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPricePerMillion(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const price = Number(value) * 1_000_000;
  return Number.isFinite(price) && price >= 0 ? price : null;
}

export function parseOpenRouterModels(payload: unknown): LlmModelOption[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error("OpenRouter model catalog response was invalid.");
  }

  return payload.data
    .flatMap((value): LlmModelOption[] => {
      if (!isRecord(value)) return [];
      const id = typeof value.id === "string" ? value.id.trim() : "";
      if (!id) return [];

      const architecture = isRecord(value.architecture)
        ? value.architecture
        : null;
      const inputModalities = Array.isArray(architecture?.input_modalities)
        ? architecture.input_modalities
        : [];
      const outputModalities = Array.isArray(architecture?.output_modalities)
        ? architecture.output_modalities
        : [];
      if (
        (inputModalities.length > 0 && !inputModalities.includes("text")) ||
        (outputModalities.length > 0 && !outputModalities.includes("text"))
      ) {
        return [];
      }

      const pricing = isRecord(value.pricing) ? value.pricing : {};
      const contextLength =
        typeof value.context_length === "number" &&
        Number.isFinite(value.context_length)
          ? value.context_length
          : null;

      return [
        {
          id,
          name:
            typeof value.name === "string" && value.name.trim()
              ? value.name.trim()
              : id,
          provider: id.includes("/") ? id.split("/", 1)[0] : "other",
          contextLength,
          promptPerMillion: readPricePerMillion(pricing.prompt),
          completionPerMillion: readPricePerMillion(pricing.completion),
        },
      ];
    })
    .sort(
      (left, right) =>
        left.provider.localeCompare(right.provider) ||
        left.name.localeCompare(right.name),
    );
}

export async function getOpenRouterModelCatalog(): Promise<ModelCatalog> {
  const now = Date.now();
  if (cachedCatalog && cachedCatalog.expiresAt > now) {
    return {
      models: cachedCatalog.models,
      fetchedAt: cachedCatalog.fetchedAt,
    };
  }

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`OpenRouter model catalog returned ${response.status}.`);
    }

    const models = parseOpenRouterModels(await response.json());
    const fetchedAt = new Date().toISOString();
    cachedCatalog = {
      models,
      fetchedAt,
      expiresAt: now + MODEL_CACHE_TTL_MS,
    };
    return { models, fetchedAt };
  } catch (error) {
    if (cachedCatalog) {
      return {
        models: cachedCatalog.models,
        fetchedAt: cachedCatalog.fetchedAt,
      };
    }
    throw error;
  }
}
