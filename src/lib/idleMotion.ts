import type { ArchiveEntry } from "../types";

export const DEFAULT_IDLE_PROMPT = `Create a seamless five-second idle animation of the character in the reference image.
Preserve the exact identity, outfit, hairstyle, visual style, background, framing, and lighting.
Keep the camera completely fixed. The character faces the camera with a relaxed neutral expression.
Only gentle breathing and occasional natural blinking. Keep the mouth closed and the hands at rest.
No speaking, lip movement, gestures, camera movement, music, sound effects, subtitles, or text.
Return to the exact starting pose and expression at the end, with calm motion at both boundaries for looping.
Do not add people or change the character design. Preserve illustration or anime style when present.`;

export const MAX_IDLE_PROMPT_LENGTH = 4_000;

export function canApplyIdle(entry: ArchiveEntry, imageUrl: string): boolean {
  return entry.kind === "idle" && Boolean(imageUrl) && entry.sourceImageUrl === imageUrl;
}

export function normalizeIdlePrompts(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, prompt]) =>
    typeof prompt === "string" && prompt.trim().length > 0 && prompt.length <= MAX_IDLE_PROMPT_LENGTH,
  ));
}
