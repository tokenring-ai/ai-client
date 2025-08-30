import {embed, EmbeddingModel, type EmbedResult} from "ai";

export type EmbeddingModelSpec = {
  providerDisplayName: string;
  contextLength: number;
  costPerMillionInputTokens: number;
  costPerMillionOutputTokens?: number;
  impl: Exclude<EmbeddingModel, string>;
  isAvailable: () => Promise<boolean>;
  isHot?: () => Promise<boolean>;
};

/**
 * Client for generating embeddings using the Vercel AI SDK.
 */
export default class AIEmbeddingClient {
  public readonly modelSpec: EmbeddingModelSpec;

  /**
   * Creates an instance of AIEmbeddingClient.
   */
  constructor({modelSpec}: { modelSpec: EmbeddingModelSpec }) {
    this.modelSpec = modelSpec;
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
        embed({
          model: this.modelSpec.impl,
          value,
        }),
      ),
    );
  }
}