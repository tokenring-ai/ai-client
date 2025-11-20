import {embed, type EmbeddingModel, type EmbedResult} from "ai";
import type {ModelSpec} from "../ModelTypeRegistry.js";

export type EmbeddingModelSpec = ModelSpec & {
  contextLength: number;
  costPerMillionInputTokens: number;
  costPerMillionOutputTokens?: number;
  impl: Exclude<EmbeddingModel, string>;
  /**
   * Optional hook to adjust the request prior to sending.
   * Receives the runtime feature flags as the second parameter.
   */
  mangleRequest?: (
    req: { value: string },
    features?: Record<string, any>,
  ) => void;
};

/**
 * Client for generating embeddings using the Vercel AI SDK.
 */
export default class AIEmbeddingClient {
  public readonly modelSpec: EmbeddingModelSpec;
  private features: Record<string, string | boolean | number | null | undefined> = {};

  /**
   * Creates an instance of AIEmbeddingClient.
   */
  constructor(modelSpec: EmbeddingModelSpec, features: typeof this.features = {}) {
    this.modelSpec = modelSpec;
    this.features = features;
  }

  /**
   * Sets enabled features on this client instance. Does not mutate the modelSpec.
   */
  setFeatures(features: Record<string, any> | undefined): void {
    this.features = {...(features ?? {})};
  }

  /**
   * Returns a copy of the enabled features for this client instance.
   */
  getFeatures(): Record<string, any> {
    return {...this.features};
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
  async getEmbeddings({
                        input,
                      }: {
    input: string[];
  }): Promise<Array<EmbedResult<string>>> {
    if (!Array.isArray(input)) {
      throw new Error("Input must be an array of strings.");
    }
    return Promise.all(
      input.map((value) =>
        embed((() => {
          // Allow providers to mangle per-item request
          if (this.modelSpec.mangleRequest) {
            const req = {value};
            this.modelSpec.mangleRequest(req, this.features);
            value = req.value;
          }
          return {
            model: this.modelSpec.impl,
            value,
          };
        })()),
      ),
    );
  }
}
