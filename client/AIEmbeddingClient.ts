import type { EmbeddingModelV4 } from "@ai-sdk/provider";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import { type EmbedManyResult, embedMany } from "ai";
import { z } from "zod";
import type { ModelSettings } from "../schema.client.ts";
import { BaseModelSpecSchema, ProviderOptionsSchema } from "../schema.client.ts";

export const EmbeddingRequestSchema = z.object({
  values: z.array(z.string()),
  providerOptions: ProviderOptionsSchema.prefault({}),
});

export type EmbeddingRequest = z.input<typeof EmbeddingRequestSchema>;
export type ParsedEmbeddingRequest = z.output<typeof EmbeddingRequestSchema>;

export const EmbeddingModelSpecSchema = BaseModelSpecSchema.extend({
  impl: z.custom<EmbeddingModelV4>(),
  mangleRequest: z.custom<(req: ParsedEmbeddingRequest, settings: ModelSettings) => void>().exactOptional(),

  contextLength: z.number(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number().exactOptional(),
});

export type EmbeddingModelSpec = z.input<typeof EmbeddingModelSpecSchema>;
export type ParsedEmbeddingModelSpec = z.output<typeof EmbeddingModelSpecSchema>;

/**
 * Client for generating embeddings using the Vercel AI SDK.
 */
export default class AIEmbeddingClient {
  constructor(
    private readonly modelSpec: EmbeddingModelSpec,
    private settings: ModelSettings,
  ) {}

  /**
   * Set settings for this client instance.
   */
  setSettings(settings: ModelSettings): void {
    this.settings = new Map(settings.entries());
  }

  /**
   * Get a copy of the settings.
   */
  getSettings(): ModelSettings {
    return new Map(this.settings.entries());
  }

  /**
   * Gets the model ID from the model specification.
   */
  getModelId(): string {
    return this.modelSpec.impl.modelId;
  }

  /**
   * Generates embeddings for an array of input strings.
   * Each result includes the embedding vector and usage statistics for that input.
   */
  async getEmbeddings(request: EmbeddingRequest): Promise<EmbedManyResult> {
    const parsedRequest = EmbeddingRequestSchema.parse(request);
    parsedRequest.providerOptions = deepClone(this.modelSpec.providerOptions, parsedRequest.providerOptions);

    this.modelSpec.mangleRequest?.(parsedRequest, this.settings);

    return await embedMany({
      model: this.modelSpec.impl,
      ...parsedRequest,
    });
  }
}
