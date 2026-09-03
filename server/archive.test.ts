import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { archiveVideo, isAllowedFalMediaUrl, readArchive } from "./archive";

const temporaryRoots: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("isAllowedFalMediaUrl", () => {
  it("accepts fal CDN video hosts", () => {
    expect(
      isAllowedFalMediaUrl("https://v3b.fal.media/files/demo/video.mp4"),
    ).toBe(true);
    expect(isAllowedFalMediaUrl("https://fal.media/files/video.mp4")).toBe(
      true,
    );
  });

  it("rejects non-fal and deceptive hosts", () => {
    expect(isAllowedFalMediaUrl("https://example.com/video.mp4")).toBe(false);
    expect(isAllowedFalMediaUrl("https://fal.media.example.com/video.mp4")).toBe(
      false,
    );
    expect(isAllowedFalMediaUrl("file:///tmp/video.mp4")).toBe(false);
  });
});

describe("archiveVideo", () => {
  it("stores the generated video and searchable conversation metadata", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "character-video-archive-test-"));
    temporaryRoots.push(root);
    const videoBytes = Uint8Array.from([0, 1, 2, 3, 4, 5]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(videoBytes, {
          status: 200,
          headers: {
            "content-type": "video/mp4",
            "content-length": String(videoBytes.byteLength),
          },
        }),
      ),
    );

    const entry = await archiveVideo(root, {
      characterName: "Sample Character",
      userMessage: "今日は何してた？",
      assistantReply: "家でのんびりしてたよ。",
      videoPrompt: "test prompt",
      llmModel: "google/gemini-2.5-flash",
      resolution: "480P",
      remoteVideoUrl: "https://v3b.fal.media/files/test/video.mp4",
      falRequestId: "request-id",
    });

    expect(entry.localVideoUrl).toMatch(/^\/local-media\/videos\/.+\.mp4$/);
    expect(await readArchive(root)).toEqual([entry]);
    const savedVideo = await readFile(
      path.join(root, "archive", "videos", `${entry.id}.mp4`),
    );
    expect([...savedVideo]).toEqual([...videoBytes]);
  });
});
