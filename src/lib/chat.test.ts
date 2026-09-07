import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./storage";
import { buildSystemPrompt, extractAssistantText, normalizeReply, parseCharacterReply } from "./chat";

describe("chat prompt", () => {
  it("includes the character identity and short reply constraints", () => {
    const prompt = buildSystemPrompt(DEFAULT_SETTINGS);
    expect(prompt).toContain("ユーザーが設定したAIキャラクター");
    expect(prompt).toContain("20〜35文字");
    expect(prompt).toContain("セリフだけ");
  });

  it("uses an optional character name and persona when configured", () => {
    const prompt = buildSystemPrompt({
      ...DEFAULT_SETTINGS,
      characterName: "サンプルキャラクター",
      characterPersona: "落ち着いた口調で話す。",
    });
    expect(prompt).toContain("サンプルキャラクター");
    expect(prompt).toContain("落ち着いた口調で話す。");
  });

  it("normalizes wrappers without changing the dialogue", () => {
    expect(normalizeReply("```\n「今日はのんびりしてたよ！」\n```"))
      .toBe("今日はのんびりしてたよ！");
  });

  it("reads both OpenAI-compatible and fal-style responses", () => {
    expect(
      extractAssistantText({
        choices: [{ message: { content: "こんにちは！" } }],
      }),
    ).toBe("こんにちは！");
    expect(extractAssistantText({ data: { output: "元気だよ！" } })).toBe(
      "元気だよ！",
    );
  });
});

describe("parseCharacterReply", () => {
  it("keeps gestures and expressions separate from spoken dialogue", () => {
    expect(parseCharacterReply('```json\n' + JSON.stringify({
      dialogue: "「こんにちは！」", action: " Wave one hand. ", expression: "Smile warmly.",
    }) + '\n```')).toEqual({
      dialogue: "こんにちは！", action: "Wave one hand.", expression: "Smile warmly.",
    });
  });

  it("allows an ordinary reply without requested gestures", () => {
    expect(parseCharacterReply('{"dialogue":"元気だよ！","action":"","expression":""}').action).toBe("");
  });

  it.each([
    "こんにちは！", "null", "[]", '{"dialogue":"こんにちは！"}',
    '{"dialogue":"こんにちは！","action":{},"expression":""}',
    '{"dialogue":" ","action":"","expression":""}',
    JSON.stringify({ dialogue: "こんにちは！", action: "a".repeat(601), expression: "" }),
  ])("rejects unusable replies before video generation: %s", (value) => {
    expect(() => parseCharacterReply(value)).toThrow();
  });
});
