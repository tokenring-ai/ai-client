import {describe, expect, it} from "vitest";
import AIClientRpcSchema from "./schema.ts";

describe("AI Client RPC Schema", () => {
  it("should have correct endpoint path", () => {
    expect(AIClientRpcSchema.path).toBe("/rpc/ai-client");
  });

  it("should have all model listing methods", () => {
    const methods = AIClientRpcSchema.methods;

    // Chat models
    expect(methods.listChatModels).toBeDefined();
    expect(methods.listChatModelsByProvider).toBeDefined();

    // Embedding models
    expect(methods.listEmbeddingModels).toBeDefined();
    expect(methods.listEmbeddingModelsByProvider).toBeDefined();

    // Image generation models
    expect(methods.listImageGenerationModels).toBeDefined();
    expect(methods.listImageGenerationModelsByProvider).toBeDefined();

    // Speech models
    expect(methods.listSpeechModels).toBeDefined();
    expect(methods.listSpeechModelsByProvider).toBeDefined();

    // Transcription models
    expect(methods.listTranscriptionModels).toBeDefined();
    expect(methods.listTranscriptionModelsByProvider).toBeDefined();

    // Reranking models
    expect(methods.listRerankingModels).toBeDefined();
    expect(methods.listRerankingModelsByProvider).toBeDefined();
  });

  it("should have query type for all methods", () => {
    const methods = AIClientRpcSchema.methods;

    Object.values(methods).forEach(method => {
      expect(method.type).toBe("query");
    });
  });

  it("should have input schema with optional agentId for all methods", () => {
    const methods = AIClientRpcSchema.methods;

    Object.values(methods).forEach(method => {
      const inputShape = method.input.shape;
      expect(inputShape).toHaveProperty("agentId");
    });
  });

  it("should have result schema with models or modelsByProvider", () => {
    const methods = AIClientRpcSchema.methods;

    Object.entries(methods).forEach(([name, method]) => {
      const resultShape = method.result.shape;

      if (name.includes("ByProvider")) {
        expect(resultShape).toHaveProperty("modelsByProvider");
      } else {
        expect(resultShape).toHaveProperty("models");
      }
    });
  });
});
