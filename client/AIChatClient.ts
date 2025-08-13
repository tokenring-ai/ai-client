import ChatService from "@token-ring/chat/ChatService";

import { generateObject, generateText, streamText, type LanguageModel, type Tool, type CoreMessage, type Message } from "ai";
import {Registry} from "@token-ring/registry";

export type ChatInputMessage = Omit<Message,'id'>;

export type ChatRequest = {
    tools?: Record<string, Tool>;
    maxSteps?: number;
    messages: ChatInputMessage[];
    temperature?: number;
    topP?: number;
};

export type GenerateRequest = {
    schema: import('zod').ZodTypeAny;
} & ChatRequest;

export type ChatModelSpec = {
    provider: string;
    contextLength: number;
    costPerMillionInputTokens: number;
    costPerMillionOutputTokens: number;
    impl: LanguageModel;
    isAvailable: () => Promise<boolean>;
    isHot?: () => Promise<boolean>;
    mangleRequest?: (req: ChatRequest) => void;
    research?: number;
    reasoning?: number;
    tools?: number;
    intelligence?: number;
    speed?: number;
    webSearch?: number;
    maxCompletionTokens?: number;
};

export type AIResponse = {
    timestamp: number;
    model: string;
    messages: Array<CoreMessage>;
    text?: string;
    object?: any;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cost?: number;
    };
    [key: string]: any;
};

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
 * Chat client that relies on the Vercel AI SDK instead of the OpenAI SDK.
 * It keeps the identical public interface so it can be used as a drop-in
 * replacement for `OpenAIChatCompletionClient`.
 */
export default class AIChatClient {
    private readonly modelSpec: ChatModelSpec;

    constructor(modelSpec: ChatModelSpec) {
        this.modelSpec = modelSpec;
    }

    /**
     * Get the model ID.
     */
    getModelId() {
        return this.modelSpec.impl.modelId;
    }

    /**
     * Calculate the cost for a given usage object (promptTokens, completionTokens)
     * using the pricing info from modelSpec (prefers .pricing, falls back to legacy fields).
     * Returns a number (cost in USD or provider's currency).
     */
    calculateCost({ promptTokens, completionTokens }: { promptTokens: number; completionTokens: number }) {
        if (
            !this.modelSpec ||
            promptTokens === undefined ||
            completionTokens === undefined
        ) {
            return undefined;
        }
        const promptRate = this.modelSpec.costPerMillionInputTokens / 1000000;
        const completionRate = this.modelSpec.costPerMillionOutputTokens / 1000000;

        const inputCost = promptTokens * promptRate;
        const outputCost = completionTokens * completionRate;
        return inputCost + outputCost;
    }

    /**
     * Get the token cost as a formatted string.
     */
    getTokenCost({ promptTokens, completionTokens }: { promptTokens: number; completionTokens: number }) {
        const totalCost = this.calculateCost({ promptTokens, completionTokens });
        if (totalCost === undefined) return "Unknown";
        return `$${totalCost.toFixed(4)}`;
    }

    /**
     * Streams a chat completion via `streamText`, relaying every delta
     * back to the `ChatService`.
     */
    async streamChat(request: ChatRequest, registry: Registry): Promise<[string | undefined, AIResponse]> {
        const chatService = registry.requireFirstServiceByType(ChatService);
        const signal = chatService.getAbortSignal();

        if (this.modelSpec.mangleRequest) {
            request = { ...request };
            this.modelSpec.mangleRequest(request);
        }

        const isHot = this.modelSpec.isHot ? await this.modelSpec.isHot() : true;

        if (!isHot) {
            chatService.systemLine(
                "Model is not hot and will need to be cold started. Setting retries to 15...",
            );
        }

        const result = streamText({
            ...request,
            maxRetries: 15,
            model: this.modelSpec.impl,
            abortSignal: signal,
        });

        let mode = "text";

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
                    throw new Error(part.error as any ?? "Unknown error");
                }
            }
        }

        const response = await this.generateResponseObject(result);

        return [response.text, response];
    }

    /**
     * Sends a chat completion request and returns the full text response.
     */
    async textChat(request: ChatRequest, registry: Registry): Promise<[string, AIResponse]> {
        if (this.modelSpec.mangleRequest) {
            request = { ...request };
            this.modelSpec.mangleRequest(request);
        }

        const chatService = registry.requireFirstServiceByType(ChatService);
        const signal = chatService.getAbortSignal();

        const result = await generateText({
            ...request,
            model: this.modelSpec.impl,
            abortSignal: signal,
        });

        const response = await this.generateResponseObject(result);
        return [response.text as string, response];
    }

    /**
     * Sends a chat completion request and returns the generated object response.
     */
    async generateObject(request: GenerateRequest, registry: Registry): Promise<[any, AIResponse]> {
        if (this.modelSpec.mangleRequest) {
            request = { ...request };
            this.modelSpec.mangleRequest(request);
        }

        const chatService = registry.requireFirstServiceByType(ChatService);
        const signal = chatService.getAbortSignal();

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
    async generateResponseObject(result: any): Promise<AIResponse> {
        const { timestamp, model, messages } = await result.response;

        const response: AIResponse = {
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