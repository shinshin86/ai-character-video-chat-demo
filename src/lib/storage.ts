import type { AppSettings } from "../types";

const SETTINGS_KEY = "ai-character-video-chat:settings:v2";
const LEGACY_SETTINGS_KEY = "ai-character-video-chat:settings:v1";

export const DEFAULT_SETTINGS: AppSettings = {
  falApiKey: "",
  characterImageUrl: "",
  characterReferenceId: "",
  characterName: "",
  characterPersona: "",
  llmModel: "google/gemini-2.5-flash",
  resolution: "480P",
};

export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        resolution: parsed.resolution === "768P" ? "768P" : "480P",
      };
    }

    const legacyStored = localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!legacyStored) return DEFAULT_SETTINGS;
    const legacy = JSON.parse(legacyStored) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      falApiKey: typeof legacy.falApiKey === "string" ? legacy.falApiKey : "",
      characterImageUrl:
        typeof legacy.characterImageUrl === "string"
          ? legacy.characterImageUrl
          : "",
      llmModel:
        typeof legacy.llmModel === "string"
          ? legacy.llmModel
          : DEFAULT_SETTINGS.llmModel,
      resolution: legacy.resolution === "768P" ? "768P" : "480P",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function resetSettings(): AppSettings {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(LEGACY_SETTINGS_KEY);
  return DEFAULT_SETTINGS;
}
