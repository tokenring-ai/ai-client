import {EmbeddingModelV2} from "@ai-sdk/provider";
import {embed, type EmbedResult} from "ai";

export type ModelSpec = {
  provider: string;
  contextLength: number;
  costPerMillionInputTokens: number;
  costPerMillionOutputTokens?: number;
  impl: EmbeddingModelV2<string>;
  isAvailable: () => Promise<boolean>;
  isHot?: () => Promise<boolean>;
};

/**
 * Client for generating embeddings using the Vercel AI SDK.
 */
export default class AIEmbeddingClient {
  public readonly modelSpec: ModelSpec;

  /**
   * Creates an instance of AIEmbeddingClient.
   * @param cfg Configuration object.
   */
  constructor({modelSpec}: { modelSpec: ModelSpec }) {
    this.modelSpec = modelSpec;
  }

  /**
   * Gets the model ID from the model specification.
   * @returns The model ID.
   */
  getModelId(): string {
    return this.modelSpec.impl.modelId;
  }

  /**
   * Calculates the token cost for the given number of prompt tokens.
   * Completion tokens are usually not applicable for embedding models.
   * @param params Parameters for cost calculation.
   * @returns The formatted token cost (e.g., "$0.0010") or "Unknown" if calculation is not possible.
   */
  getTokenCost({
                 promptTokens,
                 completionTokens = 0,
               }: {
    promptTokens: number;
    completionTokens?: number;
  }): string {
    if (!this.modelSpec) {
      return "Unknown";
    }

    // Calculate cost - convert from per 1M tokens to per token
    const inputCost =
      (promptTokens * this.modelSpec.costPerMillionInputTokens) / 1_000_000;

    // Output cost might not be applicable or could be zero for embeddings
    const outputCost = this.modelSpec.costPerMillionOutputTokens
      ? (completionTokens * this.modelSpec.costPerMillionOutputTokens) / 1_000_000
      : 0;

    const totalCost = inputCost + outputCost;
    return `$${totalCost.toFixed(4)}`;
  }

  /**
   * Generates embeddings for an array of input strings.
   * @param params Parameters for generating embeddings.
   * @returns A promise that resolves to an array of embedding results.
   * Each result includes the embedding vector and usage statistics for that input.
   * @throws If the input is not an array of strings.
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