import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, normalizeIdleVideoUrls, saveSettings } from "./storage";

afterEach(() => vi.unstubAllGlobals());

describe("idle motion settings", () => {
  it("loads existing settings without an idle motion", () => {
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ characterImageUrl: "https://example.com/avatar.png" }) });
    expect(loadSettings().idleVideoUrls).toEqual({});
    expect(loadSettings().idlePrompts).toEqual({});
  });

  it("persists separate idle videos for each character image", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const idleVideoUrls = {
      "https://example.com/first.png": "/local-media/videos/first.mp4",
      "https://example.com/second.png": "/local-media/videos/second.mp4",
    };
    const idlePrompts = { "https://example.com/first.png": "ゆっくり呼吸する" };
    saveSettings({ ...DEFAULT_SETTINGS, idleVideoUrls, idlePrompts });
    expect(loadSettings().idleVideoUrls).toEqual(idleVideoUrls);
    expect(loadSettings().idlePrompts).toEqual(idlePrompts);
  });

  it("ignores malformed settings and nonlocal video URLs", () => {
    expect(normalizeIdleVideoUrls(null)).toEqual({});
    expect(normalizeIdleVideoUrls([])).toEqual({});
    expect(normalizeIdleVideoUrls({ first: "https://example.com/video.mp4", second: 42 })).toEqual({});
  });
});
