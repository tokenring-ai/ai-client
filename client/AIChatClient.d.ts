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
    constructor(modelSpec: ChatModelSpec);
    modelSpec: ChatModelSpec;
    /**
     * Get the model ID.
     * @returns {string} The model ID.
     */
    getModelId(): string;
    /**
     * Calculate the cost for a given usage object (promptTokens, completionTokens)
     * using the pricing info from modelSpec (prefers .pricing, falls back to legacy fields).
     * Returns a number (cost in USD or provider's currency).
     * @param {{promptTokens: number, completionTokens: number}} usage - The usage object.
     * @returns {number|undefined} The calculated cost.
     */
    calculateCost({ promptTokens, completionTokens }: {
        promptTokens: number;
        completionTokens: number;
    }): number | undefined;
    /**
     * Get the token cost as a formatted string.
     * @param {{promptTokens: number, completionTokens: number}} usage - The usage object.
     * @returns {string} The formatted cost string.
     */
    getTokenCost({ promptTokens, completionTokens }: {
        promptTokens: number;
        completionTokens: number;
    }): string;
    /**
     * Streams a chat completion via `streamText`, relaying every delta
     * back to the `ChatService`.
     * @param {object} request - The chat request parameters.
     * @param {TokenRingRegistry} registry - The package registry.
     * @returns {Promise<[string,object]>} The completed chat response object.
     */
    streamChat(request: object, registry: TokenRingRegistry): Promise<[string, object]>;
    /**
     * Sends a chat completion request and returns the full text response.
     * @param {object} request - The chat request parameters.
     * @param {TokenRingRegistry} registry - The package registry.
     * @returns {Promise<[string, Object]>} The completed chat text & response object.
     */
    textChat(request: object, registry: TokenRingRegistry): Promise<[string, any]>;
    /**
     * Sends a chat completion request and returns the generated object response.
     * @param {GenerateRequest} request - The chat request parameters.
     * @param {TokenRingRegistry} registry - The package registry.
     * @returns {Promise<[string,object]>} The generated object.
     */
    generateObject(request: GenerateRequest, registry: TokenRingRegistry): Promise<[string, object]>;
    /**
     * Generates a response object from the result.
     * @param {object} result - The result object.
     * @returns {Promise<object>} The generated response object.
     */
    generateResponseObject(result: object): Promise<object>;
}
export type ChatRequest = {
    /**
     * - The tools that the model can call. The model needs to support calling tools.
     */
    tools: import("ai").TOOLS;
    /**
     * - Maximum number of sequential LLM calls (steps), e.g. when you use tool calls. Must be at least 1. By default, it's set to 1, which means that only a single LLM call is made.
     */
    maxSteps: number;
    messages?: Array<import("ai").CoreMessage> | Array<Omit<import("ai").Message, "id">>;
};
export type GenerateRequest = {
    /**
     * - The tools that the model can call. The model needs to support calling tools.
     */
    tools: import("ai").TOOLS;
    /**
     * - Maximum number of sequential LLM calls (steps), e.g. when you use tool calls. Must be at least 1. By default, it's set to 1, which means that only a single LLM call is made.
     */
    maxSteps: number;
    /**
     * - The response schema for the response
     */
    schema: import("zod").ZodType;
    messages?: Array<import("ai").CoreMessage> | Array<Omit<import("ai").Message, "id">>;
};
export type ChatModelSpec = {
    /**
     * - The model provider code
     */
    provider: string;
    /**
     * - Maximum context length in tokens
     */
    contextLength: number;
    /**
     * - Cost per million input tokens (in some currency unit)
     */
    costPerMillionInputTokens: number;
    /**
     * - Cost per million output tokens (in some currency unit)
     */
    costPerMillionOutputTokens: number;
    /**
     * - The AI SDK model implementation
     */
    impl: import("ai").CoreModel;
    /**
     * - A callback that checks whether the model is online and available for use
     */
    isAvailable: () => Promise<any>;
    /**
     * - A callback that checks whether the model is hot, or will need to be loaded
     */
    isHot?: () => Promise<any>;
    /**
     * - A callback that modifies the request, if the provider requires different input vs classic openai
     */
    mangleRequest?: (arg0: ChatRequest) => void;
    /**
     * - Research ability (0-infinity)
     */
    research?: number;
    /**
     * - Reasoning capability score (0-infinity)
     */
    reasoning?: number;
    /**
     * - Intelligence capability score (0-infinity)
     */
    intelligence?: number;
    /**
     * - Speed capability score (0-infinity)
     */
    speed?: number;
    /**
     * - Web search capability score (0-infinity)
     */
    webSearch?: number;
};
