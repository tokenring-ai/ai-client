import ChatMessageStorage from "../ChatMessageStorage.js";
import { addAttentionItems } from "./addAttentionItems.ts";
import { addMemories } from "./addMemories.ts";
import { addPersonaParameters } from "./addPersonaParameters.ts";
import { addTools } from "./addTools.ts";
import {Registry} from "@token-ring/registry";

export interface ChatInput {
    role: string;
    content: string;
}

export interface ChatRequest {
    maxSteps: number;
    messages: ChatInput[];
    tools: Record<string, any>;
}

/**
 * Creates a chat request object.
 * @param {Object} params
 * @param {string|ChatInput|ChatInput[]} params.input - The input messages array.
 * @param {string|ChatInput} [params.systemPrompt] - The system prompt
 * @param {boolean} [params.includePriorMessages] - Whether to include prior messages
 * @param {boolean} [params.includeTools] - Whether to include tools
 * @param {boolean} [params.includeMemories] - Whether to include memories
 * @param {Registry} registry - The registry instance.
 * @returns {Promise<ChatRequest>} The chat request object.
 */
export async function createChatRequest(
    {
        input,
        systemPrompt,
        includeMemories = true,
        includeTools = true,
        includePriorMessages = true,
    }: {
        input: string | ChatInput | ChatInput[];
        systemPrompt?: string | ChatInput;
        includeMemories?: boolean;
        includeTools?: boolean;
        includePriorMessages?: boolean;
    },
    registry: Registry
): Promise<ChatRequest> {
    let processedInput: ChatInput[];

    if (typeof input === "string") {
        processedInput = [
            {
                role: "user",
                content: input,
            },
        ];
    } else if (!Array.isArray(input)) {
        processedInput = [input];
    } else {
        processedInput = input;
    }

    if (!(processedInput?.length > 0)) {
        throw new Error(
            "The input: parameter must be an array with a length greater than 0"
        );
    }

    let processedSystemPrompt: ChatInput | undefined;
    if (typeof systemPrompt === "string") {
        processedSystemPrompt = {
            role: "system",
            content: systemPrompt,
        };
    } else {
        processedSystemPrompt = systemPrompt;
    }

    const chatMessageStorage = registry.requireFirstServiceByType(
        ChatMessageStorage as unknown as new () => ChatMessageStorage
    );

    const previousMessage = chatMessageStorage.getCurrentMessage();

    const messages: ChatInput[] = [];
    if (processedSystemPrompt) {
        messages.push(processedSystemPrompt);
    }

    if (includePriorMessages && previousMessage) {
        let previousRequestMessages = (previousMessage?.request?.messages as ChatInput[] | undefined) ?? [];
        if (previousRequestMessages?.[0]?.role === "system") {
            previousRequestMessages = previousRequestMessages.slice(1);
        }

        const previousResponseMessages = (previousMessage?.response?.messages as ChatInput[] | undefined) ?? [];

        messages.push(...previousRequestMessages, ...previousResponseMessages);
    } else {
        if (includeMemories) {
            await addMemories(messages, registry);
        }
    }

    messages.push(...processedInput);

    if (includeMemories && !includePriorMessages) {
        const lastMessage = messages.pop();
        await addAttentionItems(messages, registry);
        if (lastMessage) {
            messages.push(lastMessage);
        }
    }

    //messages = compactMessageContext(messages);

    const request: ChatRequest = {
        maxSteps: 15,
        messages,
        tools: {},
    };

    addPersonaParameters(request, registry);

    if (includeTools) {
        await addTools(request, registry);
    }

    return request;
}