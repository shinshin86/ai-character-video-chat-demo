import { describe, expect, it } from "vitest";
import { shouldSubmitChatInput } from "./chatInput";

describe("shouldSubmitChatInput", () => {
  it("sends with Enter after composition has finished", () => {
    expect(
      shouldSubmitChatInput({
        key: "Enter",
        shiftKey: false,
        isComposing: false,
        keyCode: 13,
      }),
    ).toBe(true);
  });

  it("does not send while an IME composition is active", () => {
    expect(
      shouldSubmitChatInput({
        key: "Enter",
        shiftKey: false,
        isComposing: true,
        keyCode: 13,
      }),
    ).toBe(false);
  });

  it("does not send for the legacy IME key code", () => {
    expect(
      shouldSubmitChatInput({
        key: "Enter",
        shiftKey: false,
        isComposing: false,
        keyCode: 229,
      }),
    ).toBe(false);
  });

  it("inserts a newline with Shift + Enter", () => {
    expect(
      shouldSubmitChatInput({
        key: "Enter",
        shiftKey: true,
        isComposing: false,
        keyCode: 13,
      }),
    ).toBe(false);
  });

  it("does not send with another key", () => {
    expect(
      shouldSubmitChatInput({
        key: "Space",
        shiftKey: false,
        isComposing: false,
        keyCode: 32,
      }),
    ).toBe(false);
  });
});
