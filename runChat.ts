import ChatService from "@token-ring/chat/ChatService";
import ChatMessageStorage from "./ChatMessageStorage.ts";
import { createChatRequest, type ChatInput } from "./chatRequestBuilder/createChatRequest.ts";
import { ModelRegistry } from "./index.ts";
import type { Registry as TokenRingRegistry } from "@token-ring/registry";
import {abandon} from "@token-ring/utility/abandon";

/**
 * Types for the chat parameters
 */
interface ExecuteParams {
    input: string | ChatInput | ChatInput[];
    systemPrompt: string | ChatInput;
    model: string;
}


interface ChatResponse {
    usage?: {
        totalTokens?: number;
        promptTokens?: number;
        completionTokens?: number;
    };
    timing?: {
        elapsedMs: number;
        tokensPerSec?: number;
        totalTokens?: number;
    };
    tokenCost?: number;
    error?: string;
}


/**
 * runChat tool: Runs a chat with the AI model, combining streamChat and runChat functionality.
 * @param {ExecuteParams} args Tool arguments: { input, systemPrompt, model }
 * @param {TokenRingRegistry} registry - The package registry
 */
export async function execute(
    { input, systemPrompt, model }: ExecuteParams,
    registry: TokenRingRegistry
): Promise<[string, ChatResponse]> {
    const chatService = registry.requireFirstServiceByType<ChatService>(ChatService);
    const chatMessageStorage = registry.requireFirstServiceByType<ChatMessageStorage>(ChatMessageStorage);
    const modelRegistry = registry.requireFirstServiceByType<ModelRegistry>(ModelRegistry);

    if (!model) {
        throw new Error("[runChat] No model parameter received");
    }

    const currentMessage = chatMessageStorage.getCurrentMessage();
    const request = await createChatRequest({ input, systemPrompt }, registry);

    try {
        chatService.emit("waiting", "Waiting for an an online model to respond...");
        const client = await modelRegistry.chat.getFirstOnlineClient(model);
        chatService.emit("doneWaiting", null);

        if (!client) throw new Error(`No online client found for model ${model}`);

        chatService.systemLine(`[runChat] Using model ${client.getModelId()}`);

        // --- Timing start ---
        const startTime = Date.now();
        chatService.emit("waiting", "Waiting for response from AI...");
        const [output, response] = await client.streamChat(request, registry);
        chatService.emit("doneWaiting", null);
        const endTime = Date.now();
        // --- Timing end ---

        // Calculate timing and tokens/sec if possible
        const elapsedMs = endTime - startTime;
        let tokensPerSec: number | undefined;
        let totalTokens: number | undefined;
        if (response?.usage) {
            totalTokens =
                response.usage.totalTokens ||
                (response.usage.promptTokens ?? 0) +
                (response.usage.completionTokens ?? 0);
            if (elapsedMs > 0 && response.usage.completionTokens > 0) {
                tokensPerSec = response.usage.completionTokens / (elapsedMs / 1000);
            }
        }
        response.timing = {
            elapsedMs,
            tokensPerSec,
            totalTokens,
        };

        chatService.emit("doneWaiting", null);

        // Store the response object (now returned by streamChat)
        const chatMessage = await chatMessageStorage.storeChat(
            currentMessage,
            request,
            response
        );

        // Update the current message to follow up to the previous
        chatMessageStorage.setCurrentMessage(chatMessage);

        // Crop token cost to 4 decimal places if present
        if (response && response.tokenCost !== undefined) {
            response.tokenCost = Number(response.tokenCost.toFixed(4));
        }

        // Run afterChatComplete hooks for all enabled tools
        for (const tool of registry.tools.iterateActiveTools()) {
            if (tool?.afterChatComplete) {
                await tool.afterChatComplete(registry);
            }
        }

        // Run afterTestingComplete hooks for all enabled tools
        for (const tool of registry.tools.iterateActiveTools()) {
            if (tool?.afterTestingComplete) {
                await tool.afterTestingComplete(registry);
            }
        }

        const finalOutput: string = output ?? "";
        return [finalOutput, response]; // Return the full response object
    } catch (err: any) {
        if (request) {
            abandon(chatMessageStorage.storeChat(currentMessage, request, {
                error: err.message,
            }));
        }
        chatMessageStorage.setCurrentMessage(currentMessage);
        chatService.warningLine(
            "OpenAI response cancelled, restoring prior chat state."
        );
        throw err;
    }
}

export default execute;

export const description =
    "Runs a chat with the AI model, combining streamChat and runChat functionality.";

export const parameters = {
    type: "object",
    properties: {
        input: {
            type: "array",
            description:
                "The message content to send to the chat. Can be a string or a properly formatted message array.",
        },
        systemPrompt: {
            type: "string",
            description: "System prompt to send to the AI.",
        },
        model: {
            type: "string",
            description: "AI Model to use",
        },
    },
    required: ["content", "systemPrompt"],
    additionalProperties: false,
};