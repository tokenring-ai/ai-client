import {describe, expect, it} from "vitest";
import {normalizeChatModelSpec, type ChatModelSpec} from "./AIChatClient.ts";
import {normalizeEmbeddingModelSpec} from "./AIEmbeddingClient.ts";
import {normalizeTranscriptionModelSpec} from "./AITranscriptionClient.ts";

describe("normalizeChatModelSpec", () => {
  it("applies default capability metadata", () => {
    const modelSpec = normalizeChatModelSpec({
      modelId: "test-model",
      providerDisplayName: "Test",
      impl: {} as ChatModelSpec["impl"],
      maxContextLength: 1024,
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
    });

    expect(modelSpec.tools).toBe(true);
    expect(modelSpec.structuredOutput).toBe(true);
    expect(modelSpec.inputCapabilities).toEqual({
      text: true,
      image: false,
      video: false,
      audio: false,
      file: false,
    });
  });

  it("preserves explicit capability overrides", () => {
    const modelSpec = normalizeChatModelSpec({
      modelId: "test-model",
      providerDisplayName: "Test",
      impl: {} as ChatModelSpec["impl"],
      maxContextLength: 1024,
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
      tools: false,
      structuredOutput: false,
      inputCapabilities: {
        image: ["image/png"],
        file: true,
      },
    });

    expect(modelSpec.tools).toBe(false);
    expect(modelSpec.structuredOutput).toBe(false);
    expect(modelSpec.inputCapabilities).toEqual({
      text: true,
      image: ["image/png"],
      video: false,
      audio: false,
      file: true,
    });
  });

  it("defaults non-chat model input capabilities to text only", () => {
    const modelSpec = normalizeEmbeddingModelSpec({
      modelId: "embedding-model",
      providerDisplayName: "Test",
      impl: {} as any,
      contextLength: 1024,
      costPerMillionInputTokens: 0,
    });

    expect(modelSpec.inputCapabilities).toEqual({
      text: true,
      image: false,
      video: false,
      audio: false,
      file: false,
    });
  });

  it("defaults transcription models to audio input and no text input", () => {
    const modelSpec = normalizeTranscriptionModelSpec({
      modelId: "transcription-model",
      providerDisplayName: "Test",
      impl: {} as any,
    });

    expect(modelSpec.inputCapabilities).toEqual({
      text: false,
      image: false,
      video: false,
      audio: true,
      file: false,
    });
  });
});
