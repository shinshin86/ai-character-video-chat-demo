import type { ArchiveEntry } from "../types";
import { readJsonError } from "./errors";

export async function fetchArchive(): Promise<ArchiveEntry[]> {
  const response = await fetch("/api/archive", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readJsonError(response));
  }
  const payload = (await response.json()) as { entries?: ArchiveEntry[] };
  return payload.entries ?? [];
}
