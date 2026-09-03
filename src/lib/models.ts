import type { LlmModelOption } from "../types";
import { readJsonError } from "./errors";

interface ModelCatalogResponse {
  models?: LlmModelOption[];
}

export async function fetchLlmModels(): Promise<LlmModelOption[]> {
  const response = await fetch("/api/fal/openrouter/models");
  if (!response.ok) {
    throw new Error(await readJsonError(response));
  }

  const payload = (await response.json()) as ModelCatalogResponse;
  if (!Array.isArray(payload.models) || payload.models.length === 0) {
    throw new Error("LLMモデル一覧を取得できませんでした。");
  }
  return payload.models;
}

export function formatPerMillionPrice(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return "$0";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(2)}`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
