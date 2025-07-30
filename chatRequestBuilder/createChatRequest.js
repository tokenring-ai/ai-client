import ChatMessageStorage from "../ChatMessageStorage.js";
import { addAttentionItems } from "./addAttentionItems.js";
import { addMemories } from "./addMemories.js";
import { addPersonaParameters } from "./addPersonaParameters.js";
import { addTools } from "./addTools.js";

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
export async function createChatRequest(
	{
		input,
		systemPrompt,
		includeMemories = true,
		includeTools = true,
		includePriorMessages = true,
	},
	registry,
) {
	if (typeof input === "string") {
		input = [
			{
				role: "user",
				content: input,
			},
		];
	}

	if (!Array.isArray(input)) {
		input = [input];
	}

	if (!input?.length > 0) {
		throw new Error(
			"The input: parameter must be an array with a length greater than 0",
		);
	}

	if (typeof systemPrompt === "string") {
		systemPrompt = {
			role: "system",
			content: systemPrompt,
		};
	}

	const chatMessageStorage =
		registry.requireFirstServiceByType(ChatMessageStorage);

	const previousMessage = chatMessageStorage.getCurrentMessage();

	const messages = [];
	if (systemPrompt) {
		messages.push(systemPrompt);
	}

	if (includePriorMessages && previousMessage) {
		let previousRequestMessages = previousMessage?.request?.messages ?? [];
		if (previousRequestMessages?.[0]?.role === "system") {
			previousRequestMessages = previousRequestMessages.slice(1);
		}

		const previousResponseMessages = previousMessage?.response?.messages ?? [];

		messages.push(...previousRequestMessages, ...previousResponseMessages);
	} else {
		if (includeMemories) {
			await addMemories(messages, registry);
		}
	}

	messages.push(...input);

	if (includeMemories && !includePriorMessages) {
		const lastMessage = messages.pop();
		await addAttentionItems(messages, registry);
		messages.push(lastMessage);
	}

	//messages = compactMessageContext(messages);

	const request = {
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
