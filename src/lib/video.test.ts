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
});
