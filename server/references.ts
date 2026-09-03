import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReferenceImage } from "../src/types/index";

type SupportedImageType = ReferenceImage["mimeType"];

interface ReferenceImageInput {
  bytes: Buffer;
  originalName: string;
  mimeType: SupportedImageType;
  remoteImageUrl: string;
}

const IMAGE_EXTENSIONS: Record<SupportedImageType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function getReferencePaths(dataRoot: string) {
  const referenceRoot = path.join(dataRoot, "reference");
  return {
    referenceRoot,
    imagesRoot: path.join(referenceRoot, "images"),
    indexPath: path.join(referenceRoot, "index.json"),
  };
}

export function getReferenceImagesRoot(dataRoot: string): string {
  return getReferencePaths(dataRoot).imagesRoot;
}

export function detectReferenceImageType(
  bytes: Buffer,
): SupportedImageType | null {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function getReferenceImageId(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function cleanOriginalName(value: string, extension: string): string {
  const name = path
    .basename(value)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 160);
  return name || `reference.${extension}`;
}

export async function ensureReferenceStore(dataRoot: string): Promise<void> {
  await mkdir(getReferencePaths(dataRoot).imagesRoot, { recursive: true });
}

export async function readReferenceImages(
  dataRoot: string,
): Promise<ReferenceImage[]> {
  const { indexPath } = getReferencePaths(dataRoot);
  try {
    const contents = await readFile(indexPath, "utf8");
    const parsed: unknown = JSON.parse(contents);
    return Array.isArray(parsed) ? (parsed as ReferenceImage[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function findReferenceImage(
  dataRoot: string,
  bytes: Buffer,
): Promise<ReferenceImage | undefined> {
  const id = getReferenceImageId(bytes);
  return (await readReferenceImages(dataRoot)).find((entry) => entry.id === id);
}

export async function saveReferenceImage(
  dataRoot: string,
  input: ReferenceImageInput,
): Promise<ReferenceImage> {
  const detectedType = detectReferenceImageType(input.bytes);
  if (!detectedType || detectedType !== input.mimeType) {
    throw new Error("Unsupported image data.");
  }

  await ensureReferenceStore(dataRoot);
  const { imagesRoot, indexPath } = getReferencePaths(dataRoot);
  const id = getReferenceImageId(input.bytes);
  const extension = IMAGE_EXTENSIONS[detectedType];
  const imageFile = `${id}.${extension}`;
  const finalImagePath = path.join(imagesRoot, imageFile);

  try {
    await access(finalImagePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const temporaryImagePath = path.join(
      imagesRoot,
      `${id}-${randomUUID()}.tmp`,
    );
    await writeFile(temporaryImagePath, input.bytes, { flag: "wx" });
    await rename(temporaryImagePath, finalImagePath);
  }

  const entries = await readReferenceImages(dataRoot);
  const existing = entries.find((entry) => entry.id === id);
  const entry: ReferenceImage = existing
    ? { ...existing, remoteImageUrl: input.remoteImageUrl }
    : {
        id,
        createdAt: new Date().toISOString(),
        originalName: cleanOriginalName(input.originalName, extension),
        mimeType: detectedType,
        localImageUrl: `/reference-images/${imageFile}`,
        remoteImageUrl: input.remoteImageUrl,
      };
  const nextEntries = [entry, ...entries.filter((item) => item.id !== id)];
  const temporaryIndexPath = `${indexPath}.${randomUUID()}.tmp`;
  await writeFile(
    temporaryIndexPath,
    `${JSON.stringify(nextEntries, null, 2)}\n`,
    "utf8",
  );
  await rename(temporaryIndexPath, indexPath);
  return entry;
}
