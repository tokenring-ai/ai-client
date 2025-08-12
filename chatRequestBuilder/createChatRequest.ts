import ChatMessageStorage from "../ChatMessageStorage.js";
import { addAttentionItems } from "./addAttentionItems.js";
import { addMemories } from "./addMemories.js";
import { addPersonaParameters } from "./addPersonaParameters.js";
import { addTools } from "./addTools.js";
import {Registry} from "@token-ring/registry";
import {ChatInputMessage, ChatRequest} from "../client/AIChatClient.js";


/**
 * Creates a chat request object.
 * @param {Object} params
 * @param {string|ChatInputMessage|ChatInputMessage[]} params.input - The input messages array.
 * @param {string|ChatInputMessage} [params.systemPrompt] - The system prompt
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
        input: string | ChatInputMessage | ChatInputMessage[];
        systemPrompt?: string | ChatInputMessage;
        includeMemories?: boolean;
        includeTools?: boolean;
        includePriorMessages?: boolean;
    },
    registry: Registry
): Promise<ChatRequest> {
    let processedInput: ChatInputMessage[];

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

    let processedSystemPrompt: ChatInputMessage | undefined;
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

    const messages: ChatInputMessage[] = [];
    if (processedSystemPrompt) {
        messages.push(processedSystemPrompt);
    }

    if (includePriorMessages && previousMessage) {
        let previousRequestMessages = (previousMessage?.request?.messages as ChatInputMessage[] | undefined) ?? [];
        if (previousRequestMessages?.[0]?.role === "system") {
            previousRequestMessages = previousRequestMessages.slice(1);
        }

        const previousResponseMessages = (previousMessage?.response?.messages as ChatInputMessage[] | undefined) ?? [];

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