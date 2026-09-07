import { describe, expect, it } from "vitest";
import { isVideoModel, normalizeVideoModel, VIDEO_MODELS } from "./videoModels";

describe("video model selection", () => {
  it("maps both supported choices to their fal endpoints", () => {
    expect(VIDEO_MODELS[normalizeVideoModel("h3-max")].endpoint).toBe("minimax/h3-max/image-to-video");
    expect(VIDEO_MODELS[normalizeVideoModel("h3-max-turbo")].endpoint).toBe("minimax/h3-max-turbo/image-to-video");
  });
  it("defaults to H3 Max and rejects arbitrary model identifiers", () => {
    expect(normalizeVideoModel(undefined)).toBe("h3-max");
    expect(normalizeVideoModel("unknown")).toBe("h3-max");
    expect(normalizeVideoModel(undefined, "h3-max")).toBe("h3-max");
    expect(isVideoModel("unknown")).toBe(false);
    expect(isVideoModel("toString")).toBe(false);
  });
});
