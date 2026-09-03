import { describe, expect, it } from "vitest";
import { parseOpenRouterModels } from "./models";

describe("OpenRouter model catalog", () => {
  it("normalizes and sorts models with per-million-token prices", () => {
    const models = parseOpenRouterModels({
      data: [
        {
          id: "openai/gpt-test",
          name: "OpenAI: GPT Test",
          context_length: 128_000,
          pricing: { prompt: "0.000001", completion: "0.000002" },
        },
        {
          id: "anthropic/claude-test",
          name: "Anthropic: Claude Test",
          context_length: 200_000,
          pricing: { prompt: "0.000003", completion: "0.000015" },
        },
        {
          id: "google/image-test",
          name: "Google: Image Test",
          architecture: {
            input_modalities: ["text", "image"],
            output_modalities: ["image"],
          },
        },
      ],
    });

    expect(models.map((model) => model.id)).toEqual([
      "anthropic/claude-test",
      "openai/gpt-test",
    ]);
    expect(models[1]).toMatchObject({
      provider: "openai",
      contextLength: 128_000,
      promptPerMillion: 1,
      completionPerMillion: 2,
    });
  });

  it("ignores malformed entries", () => {
    expect(parseOpenRouterModels({ data: [null, {}, { id: "valid/model" }] }))
      .toHaveLength(1);
  });
});
