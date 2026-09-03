import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VideoResolution } from "../src/types/index";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export interface ArchiveInput {
  characterName: string;
  userMessage: string;
  assistantReply: string;
  videoPrompt: string;
  llmModel: string;
  resolution: VideoResolution;
  remoteVideoUrl: string;
  falRequestId: string;
}

export interface StoredArchiveEntry extends ArchiveInput {
  id: string;
  createdAt: string;
  localVideoUrl: string;
}

export function isAllowedFalMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "fal.media" || url.hostname.endsWith(".fal.media"))
    );
  } catch {
    return false;
  }
}

function getArchivePaths(dataRoot: string) {
  const archiveRoot = path.join(dataRoot, "archive");
  return {
    archiveRoot,
    videosRoot: path.join(archiveRoot, "videos"),
    indexPath: path.join(archiveRoot, "index.json"),
  };
}

export async function ensureArchive(dataRoot: string): Promise<void> {
  const { videosRoot } = getArchivePaths(dataRoot);
  await mkdir(videosRoot, { recursive: true });
}

export async function readArchive(
  dataRoot: string,
): Promise<StoredArchiveEntry[]> {
  const { indexPath } = getArchivePaths(dataRoot);

  try {
    const contents = await readFile(indexPath, "utf8");
    const parsed: unknown = JSON.parse(contents);
    return Array.isArray(parsed) ? (parsed as StoredArchiveEntry[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function fetchFalVideo(remoteVideoUrl: string): Promise<Buffer> {
  if (!isAllowedFalMediaUrl(remoteVideoUrl)) {
    throw new Error("Unexpected video host returned by fal.");
  }

  const response = await fetch(remoteVideoUrl, {
    redirect: "error",
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error(`Could not download generated video (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("video/")) {
    throw new Error("The generated file was not a video.");
  }

  const declaredSize = Number(response.headers.get("content-length") ?? "0");
  if (declaredSize > MAX_VIDEO_BYTES) {
    throw new Error("The generated video is too large to archive.");
  }

  const video = Buffer.from(await response.arrayBuffer());
  if (video.byteLength > MAX_VIDEO_BYTES) {
    throw new Error("The generated video is too large to archive.");
  }

  return video;
}

export async function archiveVideo(
  dataRoot: string,
  input: ArchiveInput,
): Promise<StoredArchiveEntry> {
  const { videosRoot, indexPath } = getArchivePaths(dataRoot);
  await ensureArchive(dataRoot);

  const id = randomUUID();
  const video = await fetchFalVideo(input.remoteVideoUrl);
  const videoFile = `${id}.mp4`;
  const finalVideoPath = path.join(videosRoot, videoFile);
  const temporaryVideoPath = path.join(videosRoot, `${id}.tmp`);

  await writeFile(temporaryVideoPath, video, { flag: "wx" });
  await rename(temporaryVideoPath, finalVideoPath);

  const entry: StoredArchiveEntry = {
    ...input,
    id,
    createdAt: new Date().toISOString(),
    localVideoUrl: `/local-media/videos/${videoFile}`,
  };

  const entries = await readArchive(dataRoot);
  const temporaryIndexPath = `${indexPath}.tmp`;
  await writeFile(
    temporaryIndexPath,
    `${JSON.stringify([entry, ...entries], null, 2)}\n`,
    "utf8",
  );
  await rename(temporaryIndexPath, indexPath);

  return entry;
}
