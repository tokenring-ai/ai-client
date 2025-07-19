import {embed } from "ai";

/**
 * @typedef {Object} ModelSpec
 * @property {string} provider - The model provider code.
 * @property {number} contextLength - Maximum context length in tokens.
 * @property {number} costPerMillionInputTokens - Cost per million input tokens.
 * @property {number} [costPerMillionOutputTokens] - Cost per million output tokens (may not be applicable for embeddings).
 * @property {import("ai").EmbeddingModel} impl - The AI SDK embedding model implementation.
 * @property {function(): Promise<any>} isAvailable - A callback that checks whether the model is online and available for use.
 * @property {function(): Promise<any>} [isHot] - A callback that checks whether the model is hot, or will need to be loaded.
 */

/**
 * Client for generating embeddings using the Vercel AI SDK.
 */
export default class AIEmbeddingClient {

 /**
  * Creates an instance of AIEmbeddingClient.
  * @param {object} cfg - Configuration object.
  * @param {ModelSpec} cfg.modelSpec  – The embedding model specification to use.
  */
 constructor({modelSpec}) {
  this.modelSpec = modelSpec;
  this.webSearchEnabled = false; // Note: webSearch might not be relevant for embedding clients
 }

 /**
  * Gets the model ID from the model specification.
  * @returns {string} The model ID.
  */
 getModelId() {
  return this.modelSpec.impl.modelId;
 }

 /**
  * Calculates the token cost for the given number of prompt tokens.
  * Completion tokens are usually not applicable for embedding models.
  * @param {object} params - Parameters for cost calculation.
  * @param {number} params.promptTokens - The number of prompt tokens.
  * @param {number} [params.completionTokens] - The number of completion tokens (optional, defaults to 0 for embeddings).
  * @returns {string} The formatted token cost (e.g., "$0.0010") or "Unknown" if calculation is not possible.
  */
 getTokenCost({promptTokens, completionTokens = 0}) {
  if (!this.modelSpec || promptTokens === undefined) {
   return "Unknown";
  }

  // Calculate cost - convert from per 1M tokens to per token
  const inputCost = (promptTokens * this.modelSpec.costPerMillionInputTokens) / 1000000;
  // Output cost might not be applicable or could be zero for embeddings
  const outputCost = this.modelSpec.costPerMillionOutputTokens
    ? (completionTokens * this.modelSpec.costPerMillionOutputTokens) / 1000000
    : 0;
  const totalCost = inputCost + outputCost;

  return `$${totalCost.toFixed(4)}`;
 }


 /**
  * Generates embeddings for an array of input strings.
  * @param {object} params - Parameters for generating embeddings.
  * @param {string[]} params.input - Array of input strings to embed.
  * @returns {Promise<Array<import("ai").Embedding>>} A promise that resolves to an array of embedding results.
  * Each result includes the embedding vector and usage statistics for that input.
  * @throws {Error} If the input is not an array.
  */
 async getEmbeddings({input}) {
  if (!Array.isArray(input)) throw new Error("Input must be an array of strings.");
  return Promise.all(
   input.map(async (value) =>
    embed({
     model: this.modelSpec.impl,
     value,
    })
   )
  );
 }
}