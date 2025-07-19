import ChatService from "@token-ring/chat/ChatService";

import { experimental_generateImage as generateImage } from "ai";

/**
 * @typedef {Object} ModelSpec
 * @property {string} provider - The model provider code.
 * @property {number} [contextLength] - Maximum context length in tokens (may not be applicable for image models).
 * @property {number} [costPerMillionInputTokens] - Cost per million input tokens (may be used for prompt processing).
 * @property {number} [costPerMillionOutputTokens] - Cost per million output tokens (may not be applicable, or cost is per image).
 * @property {number} [costPerImage] - Cost per generated image (common pricing model for image generation).
 * @property {import("ai").ImageGenerationModel} impl - The AI SDK image generation model implementation.
 * @property {function(): Promise<any>} isAvailable - A callback that checks whether the model is online and available for use.
 * @property {function(): Promise<any>} [isHot] - A callback that checks whether the model is hot, or will need to be loaded.
 */

/**
 * Client for generating images using the Vercel AI SDK's experimental image generation features.
 */
export default class AIImageGenerationClient {
	/**
	 * Creates an instance of AIImageGenerationClient.
	 * @param {object} cfg - Configuration object.
	 * @param {ModelSpec} cfg.modelSpec  – The image generation model specification to use.
	 */
	constructor({ modelSpec }) {
		this.modelSpec = modelSpec;
		this.webSearchEnabled = false; // Note: webSearch is generally not applicable for image generation clients
	}

	/**
	 * Gets the model ID from the model specification.
	 * @returns {string} The model ID.
	 */
	getModelId() {
		return this.modelSpec.impl.modelId;
	}

	/**
	 * Calculates the token cost. For image models, this might be an approximation
	 * or based on prompt tokens if applicable. Often, cost is per image.
	 * @param {object} params - Parameters for cost calculation.
	 * @param {number} params.promptTokens - The number of prompt tokens.
	 * @param {number} [params.completionTokens] - The number of completion tokens (optional, often not applicable).
	 * @returns {string} The formatted token cost (e.g., "$0.0010") or "Unknown" if not applicable/calculable.
	 *                   Returns cost per image if `costPerImage` is in `modelSpec`.
	 */
	getTokenCost({ promptTokens, completionTokens = 0 }) {
		if (!this.modelSpec) return "Unknown";

		if (this.modelSpec.costPerImage !== undefined) {
			return `$${this.modelSpec.costPerImage.toFixed(4)} per image`;
		}

		if (
			promptTokens === undefined ||
			!this.modelSpec.costPerMillionInputTokens
		) {
			return "Unknown"; // Not enough info for token-based cost
		}

		const inputCost =
			(promptTokens * this.modelSpec.costPerMillionInputTokens) / 1000000;
		// Output cost might not be applicable or could be zero
		const outputCost = this.modelSpec.costPerMillionOutputTokens
			? (completionTokens * this.modelSpec.costPerMillionOutputTokens) / 1000000
			: 0;
		const totalCost = inputCost + outputCost;

		return `$${totalCost.toFixed(4)}`;
	}

	/**
	 * Generates an image based on a prompt using the specified model.
	 * @param {object} request - The image generation request parameters.
	 * @param {string} request.prompt - The prompt to generate an image from.
	 * @param {`${number}x${number}`} [request.size] - The size of the image to generate (e.g., '1024x1024').
	 * @param {number} [request.n] - The number of images to generate.
	 * @param {number} [request.seed] - Seed for deterministic image generation.
	 * @param {TokenRingRegistry} registry - The package registry
	 * @returns {Promise<[object, object]>} The generated image data and metadata.
	 */
	async generateImage(request, registry) {
		if (request.model)
			throw new Error("generateImage does not accept a model parameter");

		const chatService = registry.requireFirstServiceByType(ChatService);
		const signal = chatService.getAbortSignal();

		try {
			const result = await generateImage({
				model: this.modelSpec.impl,
				prompt: request.prompt,
				n: request.n,
				size: request.size,
				seed: request.seed,
				abortSignal: signal,
			});

			// If multiple images were requested
			if (result.images) {
				return [
					result.images,
					{
						type: "ai_sdk_image",
						status: "success",
						model: this.getModelId(),
						count: result.images.length,
					},
				];
			}

			// If a single image was requested
			return [
				result.image,
				{
					type: "ai_sdk_image",
					status: "success",
					model: this.getModelId(),
				},
			];
		} catch (error) {
			chatService.errorLine("Error generating image: ", error);
			throw error;
		}
	}
}
