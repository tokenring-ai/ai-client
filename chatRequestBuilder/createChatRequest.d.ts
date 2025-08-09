/**
 * Creates a chat request object.
 * @param {Object} params
 * @param {string|ChatInput|ChatInput[]} params.input - The input messages array.
 * @param {string|ChatInput} [params.systemPrompt] - The system prompt
 * @param {boolean} [params.includePriorMessages] - Whether to include prior messages
 * @param {boolean} [params.includeTools] - Whether to include tools
 * @param {boolean} [params.includeMemories] - Whether to include memories
 * @param {TokenRingRegistry} registry - The registry instance.
 * @returns {Promise<Object>} The chat request object.
 */
export function createChatRequest({ input, systemPrompt, includeMemories, includeTools, includePriorMessages, }: {
    input: string | ChatInput | ChatInput[];
    systemPrompt?: string | ChatInput;
    includePriorMessages?: boolean;
    includeTools?: boolean;
    includeMemories?: boolean;
}, registry: TokenRingRegistry): Promise<any>;
