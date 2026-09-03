import { readJsonError } from "./errors";
import type { ReferenceImage } from "../types";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export function validateCharacterImage(file: File): void {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("PNG、JPG、JPEG、WebPの画像を選択してください。");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("画像サイズは15MB以下にしてください。");
  }
}

export async function uploadCharacterImage(
  file: File,
  falApiKey: string,
): Promise<ReferenceImage> {
  validateCharacterImage(file);
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("/api/fal/upload-character", {
    method: "POST",
    headers: { Authorization: `Bearer ${falApiKey}` },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readJsonError(response));
  }

  const payload = (await response.json()) as {
    imageUrl?: string;
    referenceImage?: ReferenceImage;
  };
  if (!payload.imageUrl || !payload.referenceImage) {
    throw new Error("画像の保存結果を取得できませんでした。");
  }
  return payload.referenceImage;
}
