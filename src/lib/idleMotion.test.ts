import { describe, expect, it } from "vitest";
import { canApplyIdle, normalizeIdlePrompts } from "./idleMotion";
import type { ArchiveEntry } from "../types";

const entry = {
  kind: "idle", sourceImageUrl: "https://example.com/first.png",
} as ArchiveEntry;

describe("idle archive selection", () => {
  it("only applies idle videos generated from the selected reference image", () => {
    expect(canApplyIdle(entry, "https://example.com/first.png")).toBe(true);
    expect(canApplyIdle(entry, "https://example.com/second.png")).toBe(false);
    expect(canApplyIdle({ ...entry, kind: "reply" }, entry.sourceImageUrl!)).toBe(false);
    expect(canApplyIdle({ ...entry, sourceImageUrl: undefined }, "")).toBe(false);
  });
});

describe("idle prompt storage", () => {
  it("retains per-image prompts and ignores malformed values", () => {
    expect(normalizeIdlePrompts({ first: "ゆっくりまばたき", second: "Gentle breathing" }))
      .toEqual({ first: "ゆっくりまばたき", second: "Gentle breathing" });
    expect(normalizeIdlePrompts({ empty: " ", invalid: 1, long: "x".repeat(4001) })).toEqual({});
    expect(normalizeIdlePrompts(null)).toEqual({});
  });
});
