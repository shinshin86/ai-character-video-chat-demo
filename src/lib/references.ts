import type { ReferenceImage } from "../types";
import { readJsonError } from "./errors";

export async function fetchReferenceImages(): Promise<ReferenceImage[]> {
  const response = await fetch("/api/reference-images", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readJsonError(response));
  }
  const payload = (await response.json()) as { images?: ReferenceImage[] };
  return Array.isArray(payload.images) ? payload.images : [];
}
