import { afterEach, describe, expect, it, vi } from "vitest";
import { buildIdleVideoPrompt, buildVideoPrompt, generateAndArchiveVideo } from "./video";

describe("buildVideoPrompt", () => {
  it("preserves style and requests Japanese dialogue without subtitles", () => {
    const prompt = buildVideoPrompt("今日はゆっくりしてたよ。君は？");
    expect(prompt).toContain("says in Japanese");
    expect(prompt).toContain("preserve that exact visual style");
    expect(prompt).toContain("Do not add subtitles");
  });

  it("escapes quotes and newlines in dialogue", () => {
    const prompt = buildVideoPrompt('彼女は「いいね」\nと言った');
    expect(prompt).toContain('"彼女は「いいね」\\nと言った"');
  });

  it("passes requested gestures and expressions without suppressing body motion", () => {
    const prompt = buildVideoPrompt("こんにちは！", {
      action: "Raise one hand and wave toward the camera.",
      expression: "Smile warmly.",
    });
    expect(prompt).toContain('says in Japanese:\n"こんにちは！"');
    expect(prompt).toContain("Action: Raise one hand and wave toward the camera.");
    expect(prompt).toContain("Facial expression: Smile warmly.");
    expect(prompt).not.toMatch(/very subtle head and upper body movement/i);
    expect(prompt).toContain("do not speak these directions");
  });

  it("keeps ordinary conversation subtle and allows expression-only requests", () => {
    const prompt = buildVideoPrompt("こんにちは！", { action: "", expression: "Smile warmly." });
    expect(prompt).toContain("very subtle head and upper body movement");
    expect(prompt).toContain("Facial expression: Smile warmly.");
    expect(prompt).not.toContain("Action:");
  });
});


afterEach(() => vi.unstubAllGlobals());

describe("idle generation", () => {
  it("requests silent breathing and blinking with matching loop boundaries", () => {
    const prompt = buildIdleVideoPrompt();
    expect(prompt).toContain("gentle breathing");
    expect(prompt).toContain("mouth closed");
    expect(prompt).toContain("No speaking");
    expect(prompt).toContain("exact starting pose");
  });

  it("uses the edited prompt and rejects empty or oversized prompts", () => {
    expect(buildIdleVideoPrompt("  静かに呼吸し、ゆっくりまばたきする。  ")).toBe("静かに呼吸し、ゆっくりまばたきする。");
    expect(() => buildIdleVideoPrompt(" ")).toThrow();
    expect(() => buildIdleVideoPrompt("x".repeat(4001))).toThrow();
  });

  it("generates an idle video without invoking dialogue generation", async () => {
    const archive = { id: "idle-example", kind: "idle", localVideoUrl: "/local-media/videos/idle-example.mp4" };
    const fetchMock = vi.fn(async () => new Response([
      JSON.stringify({ type: "status", status: "ARCHIVING" }),
      JSON.stringify({ type: "result", archive }),
    ].join("\n")));
    vi.stubGlobal("fetch", fetchMock);
    const { DEFAULT_SETTINGS } = await import("./storage");
    const onStatus = vi.fn();
    expect(await generateAndArchiveVideo({ settings: { ...DEFAULT_SETTINGS, videoModel: "h3-max-turbo" }, kind: "idle", idlePrompt: "Gentle breathing only.", onStatus })).toEqual(archive);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]!.body as string);
    expect(body.kind).toBe("idle");
    expect(body.videoModel).toBe("h3-max-turbo");
    expect(body.prompt).toBe("Gentle breathing only.");
    expect(body.assistantReply).toBe("");
    expect(onStatus).toHaveBeenCalledWith("ARCHIVING", undefined);
  });
});
