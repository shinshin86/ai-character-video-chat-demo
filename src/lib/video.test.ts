import { describe, expect, it } from "vitest";
import { buildVideoPrompt } from "./video";

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
