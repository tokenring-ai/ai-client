import ChatService from "@token-ring/chat/ChatService";

import { generateObject, generateText, streamText } from "ai";

const storedResultKeys = [
	"finishReason",
	"usage",
	"toolCalls",
	"toolResults",
	"files",
	"sources",
	"text",
	"warnings",
	"object",
	"providerMetadata",
];

/**
 * @typedef {Object} ChatRequest
 * @property {import("ai").TOOLS} tools - The tools that the model can call. The model needs to support calling tools.
 * @property {number} maxSteps - Maximum number of sequential LLM calls (steps), e.g. when you use tool calls. Must be at least 1. By default, it's set to 1, which means that only a single LLM call is made.
 * @property {Array<import("ai").CoreMessage> | Array<Omit<import("ai").Message, 'id'>>} [messages]
 */
/**
 * @typedef {Object} GenerateRequest
 * @property {import("ai").TOOLS} tools - The tools that the model can call. The model needs to support calling tools.
 * @property {number} maxSteps - Maximum number of sequential LLM calls (steps), e.g. when you use tool calls. Must be at least 1. By default, it's set to 1, which means that only a single LLM call is made.
 * @property {import("zod").ZodType} schema - The response schema for the response
 * @property {Array<import("ai").CoreMessage> | Array<Omit<import("ai").Message, 'id'>>} [messages]
 */
/**
 * @typedef {Object} ChatModelSpec
 * @property {string} provider - The model provider code
 * @property {number} contextLength - Maximum context length in tokens
 * @property {number} costPerMillionInputTokens - Cost per million input tokens (in some currency unit)
 * @property {number} costPerMillionOutputTokens - Cost per million output tokens (in some currency unit)
 * @property {import("ai").CoreModel} impl - The AI SDK model implementation
 * @property {function(): Promise<any>} isAvailable - A callback that checks whether the model is online and available for use
 * @property {function(): Promise<any>} [isHot] - A callback that checks whether the model is hot, or will need to be loaded
 * @property {function(ChatRequest): void} [mangleRequest] - A callback that modifies the request, if the provider requires different input vs classic openai
 * @property {number} [research] - Research ability (0-infinity)
 * @property {number} [reasoning] - Reasoning capability score (0-infinity)
 * @property {number} [intelligence] - Intelligence capability score (0-infinity)
 * @property {number} [speed] - Speed capability score (0-infinity)
 * @property {number} [webSearch] - Web search capability score (0-infinity)
 */

/**
 * Chat client that relies on the Vercel AI SDK instead of the OpenAI SDK.
 * It keeps the identical public interface so it can be used as a drop-in
 * replacement for `OpenAIChatCompletionClient`.
 */
/**
 * Chat client that relies on the Vercel AI SDK instead of the OpenAI SDK.
 * It keeps the identical public interface so it can be used as a drop-in
 * replacement for `OpenAIChatCompletionClient`.
 * @class
 */
export default class AIChatClient {
	/**
	 * @param {ChatModelSpec} modelSpec  – chatModels to use
	 */
	constructor(modelSpec) {
		this.modelSpec = modelSpec;
	}

	/**
	 * Get the model ID.
	 * @returns {string} The model ID.
	 */
	getModelId() {
		return this.modelSpec.impl.modelId;
	}

	/**
	 * Calculate the cost for a given usage object (promptTokens, completionTokens)
	 * using the pricing info from modelSpec (prefers .pricing, falls back to legacy fields).
	 * Returns a number (cost in USD or provider's currency).
	 * @param {{promptTokens: number, completionTokens: number}} usage - The usage object.
	 * @returns {number|undefined} The calculated cost.
	 */
	calculateCost({ promptTokens, completionTokens }) {
		if (
			!this.modelSpec ||
			promptTokens === undefined ||
			completionTokens === undefined
		) {
			return undefined;
		}
		let promptRate = this.modelSpec.costPerMillionInputTokens / 1000000;
		let completionRate = this.modelSpec.costPerMillionOutputTokens / 1000000;

		const inputCost = promptTokens * promptRate;
		const outputCost = completionTokens * completionRate;
		return inputCost + outputCost;
	}

	/**
	 * Get the token cost as a formatted string.
	 * @param {{promptTokens: number, completionTokens: number}} usage - The usage object.
	 * @returns {string} The formatted cost string.
	 */
	getTokenCost({ promptTokens, completionTokens }) {
		const totalCost = this.calculateCost({ promptTokens, completionTokens });
		if (totalCost === undefined) return "Unknown";
		return `$${totalCost.toFixed(4)}`;
	}

	/**
	 * Streams a chat completion via `streamText`, relaying every delta
	 * back to the `ChatService`.
	 * @param {object} request - The chat request parameters.
	 * @param {TokenRingRegistry} registry - The package registry.
	 * @returns {Promise<[string,object]>} The completed chat response object.
	 */
	async streamChat(request, registry) {
		if (request.model)
			throw new Error("streamChat does not accept a model parameter");

		const chatService = registry.requireFirstServiceByType(ChatService);
		const signal = chatService.getAbortSignal();

		if (this.modelSpec.mangleRequest) {
			request = { ...request };
			this.modelSpec.mangleRequest(request);
		}

		let isHot = this.modelSpec.isHot ? await this.modelSpec.isHot() : true;

		if (!isHot) {
			chatService.systemLine(
				"Model is not hot and will need to be cold started. Setting retries to 15...",
			);
		}

		const result = await streamText({
			...request,
			maxRetries: 15,
			model: this.modelSpec.impl,
			abortSignal: signal,
		});

		let mode = "text";
		/**
		 * @typedef {Object} StreamPart
		 * @property {string} type - The type of stream part ('text-delta'|'reasoning'|'finish'|'error')
		 * @property {string} [textDelta] - The text delta for text and reasoning parts
		 * @property {string} [error] - Error message for error parts
		 */
		/** @type {StreamPart} */

		/** @type {AsyncIterable<StreamPart>} */
		const stream = result.fullStream;
		for await (const part of stream) {
			switch (part.type) {
				case "text-delta": {
					if (mode !== "text") {
						chatService.out("\n");
						chatService.emit("outputType", "chat");
						mode = "text";
					}

					chatService.out(part.textDelta);
					break;
				}
				case "reasoning": {
					if (mode !== "reasoning") {
						chatService.emit("outputType", "reasoning");
						mode = "reasoning";
					}
					chatService.out(part.textDelta);
					break;
				}
				case "finish": {
					chatService.out("\n");
					chatService.emit("outputType", null);
					break;
				}
				case "error": {
					chatService.emit("outputType", null);
					throw new Error(part.error.message);
				}
			}
		}

		const response = await this.generateResponseObject(result);

		return [response.text, response];
	}

	/**
	 * Sends a chat completion request and returns the full text response.
	 * @param {object} request - The chat request parameters.
	 * @param {TokenRingRegistry} registry - The package registry.
	 * @returns {Promise<[string, Object]>} The completed chat text & response object.
	 */
	async textChat(request, registry) {
		if (request.model)
			throw new Error("textChat does not accept a model parameter");

		if (this.modelSpec.mangleRequest) {
			request = { ...request };
			this.modelSpec.mangleRequest(request);
		}

		const chatService = registry.requireFirstServiceByType(ChatService);
		const signal = chatService.getAbortSignal();

		if (this.webSearchEnabled) {
			request = { ...request };
			this.modelSpec.enableWebSearch(request);
		}

		const result = await generateText({
			...request,
			model: this.modelSpec.impl,
			abortSignal: signal,
		});

		const response = await this.generateResponseObject(result);
		return [response.text, response];
	}

	/**
	 * Sends a chat completion request and returns the generated object response.
	 * @param {GenerateRequest} request - The chat request parameters.
	 * @param {TokenRingRegistry} registry - The package registry.
	 * @returns {Promise<[string,object]>} The generated object.
	 */
	async generateObject(request, registry) {
		if (this.modelSpec.mangleRequest) {
			request = { ...request };
			this.modelSpec.mangleRequest(request);
		}

		const chatService = registry.requireFirstServiceByType(ChatService);
		const signal = chatService.getAbortSignal();

		if (this.webSearchEnabled) {
			request = { ...request };
			this.modelSpec.enableWebSearch(request);
		}

		const result = await generateObject({
			model: this.modelSpec.impl,
			abortSignal: signal,
			...request,
		});

		const response = await this.generateResponseObject(result);

		return [response.object, response];
	}

	/**
	 * Generates a response object from the result.
	 * @param {object} result - The result object.
	 * @returns {Promise<object>} The generated response object.
	 */
	async generateResponseObject(result) {
		const { timestamp, model, messages } = await result.response;

		const response = {
			timestamp,
			model,
			messages,
		};

		for (const key of storedResultKeys) {
			const value = await result[key];
			if (value) {
				response[key] = value;
			}
		}

		const { usage } = response;

		if (
			usage &&
			usage.promptTokens !== undefined &&
			usage.completionTokens !== undefined
		) {
			usage.cost = this.calculateCost({
				promptTokens: usage.promptTokens,
				completionTokens: usage.completionTokens,
			});
		}
		return response;
	}
}
