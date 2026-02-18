import {embed, type EmbeddingModel, type EmbedResult} from "ai";
import type {ChatModelSettings, ModelSpec} from "../ModelTypeRegistry.js";

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
    settings?: Record<string, any>,
  ) => void;
};

/**
 * Client for generating embeddings using the Vercel AI SDK.
 */
export default class AIEmbeddingClient {
  constructor(private readonly modelSpec: EmbeddingModelSpec, private settings: ChatModelSettings = {}) {
  }

  /**
   * Sets enabled settings on this client instance. Does not mutate the modelSpec.
   */
  setSettings(settings: ChatModelSettings | undefined): void {
    this.settings = {...(settings ?? {})};
  }

  /**
   * Returns a copy of the enabled settings for this client instance.
   */
  getSettings(): Record<string, any> {
    return {...this.settings};
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
  }): Promise<Array<EmbedResult>> {
    if (!Array.isArray(input)) {
      throw new Error("Input must be an array of strings.");
    }
    return Promise.all(
      input.map((value) =>
        embed((() => {
          // Allow providers to mangle per-item request
          if (this.modelSpec.mangleRequest) {
            const req = {value};
            this.modelSpec.mangleRequest(req, this.settings);
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
