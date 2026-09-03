import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  detectReferenceImageType,
  findReferenceImage,
  readReferenceImages,
  saveReferenceImage,
} from "./references";

const temporaryRoots: string[] = [];
const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02,
]);

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("reference image storage", () => {
  it("recognizes supported image signatures", () => {
    expect(detectReferenceImageType(pngBytes)).toBe("image/png");
    expect(detectReferenceImageType(Buffer.from([0xff, 0xd8, 0xff]))).toBe(
      "image/jpeg",
    );
    expect(
      detectReferenceImageType(Buffer.from("RIFF1234WEBP", "ascii")),
    ).toBe("image/webp");
    expect(detectReferenceImageType(Buffer.from("not an image"))).toBeNull();
  });

  it("stores an image and its reusable fal URL", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "character-reference-test-"));
    temporaryRoots.push(root);
    const entry = await saveReferenceImage(root, {
      bytes: pngBytes,
      originalName: "sample.png",
      mimeType: "image/png",
      remoteImageUrl: "https://v3b.fal.media/files/sample.png",
    });

    expect(await readReferenceImages(root)).toEqual([entry]);
    expect(await findReferenceImage(root, pngBytes)).toEqual(entry);
    expect(entry.localImageUrl).toBe(`/reference-images/${entry.id}.png`);
    expect(
      await readFile(path.join(root, "reference", "images", `${entry.id}.png`)),
    ).toEqual(pngBytes);
  });

  it("deduplicates the same image and updates its fal URL", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "character-reference-test-"));
    temporaryRoots.push(root);
    const first = await saveReferenceImage(root, {
      bytes: pngBytes,
      originalName: "first.png",
      mimeType: "image/png",
      remoteImageUrl: "https://v3b.fal.media/files/first.png",
    });
    const second = await saveReferenceImage(root, {
      bytes: pngBytes,
      originalName: "second.png",
      mimeType: "image/png",
      remoteImageUrl: "https://v3b.fal.media/files/second.png",
    });

    expect(second.id).toBe(first.id);
    expect(second.originalName).toBe("first.png");
    expect(second.remoteImageUrl).toContain("second.png");
    expect(await readReferenceImages(root)).toEqual([second]);
  });
});
