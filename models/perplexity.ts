import { perplexity } from "@ai-sdk/perplexity";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

/**
 * The name of the AI provider.
 * @type {string}
 */
const providerName = "Perplexity";

/**
 * Initializes the Perplexity AI provider and registers its chat models with the model registry.
 *
 * @param {import('../ModelRegistry.ts').default} modelRegistry - The model registry to register chat models with
 * @param {Object} config - Configuration object for the Perplexity provider
 * @param {string} config.apiKey - The API key for accessing Perplexity services
 * @param {string} [config.provider] - Optional provider name override (defaults to "Perplexity")
 * @throws {Error} If no API key is provided in the config
 * @returns {Promise<void>} A promise that resolves when initialization is complete
 */
import type ModelRegistry from "../ModelRegistry.ts";
import type { ModelConfig } from "../ModelRegistry.ts";
import type { ChatModelSpec, ChatRequest } from "../client/AIChatClient.ts";
export async function init(modelRegistry: ModelRegistry, config: ModelConfig) {
	if (!config.apiKey) {
		throw new Error("No config.apiKey provided for Perplexity provider.");
	}

	const getModels = cachedDataRetriever(
		"https://api.perplexity.ai/async/chat/completions",
		{
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
			},
		},
	);

	const isAvailable = () => getModels().then((data) => !!data);

	const provider = config.provider || providerName;

	/**
	 * A collection of Perplexity chat model specifications.
	 * Each key is a model ID, and the value is a `ChatModelSpec` object.
	 * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.ts).
	 * @type {Object<string,import("../client/AIChatClient.ts").ChatModelSpec>}
	 */
	const chatModels: Record<string, ChatModelSpec> = {
		sonar: {
			provider,
			impl: perplexity("sonar"),
			mangleRequest,
			isAvailable,
			costPerMillionInputTokens: 1,
			costPerMillionOutputTokens: 1,
			reasoning: 2,
			intelligence: 3,
			tools: 3,
			speed: 2,
			webSearch: 1,
			contextLength: 128000,
		},
		"sonar-pro": {
			provider,
			impl: perplexity("sonar-pro"),
			mangleRequest,
			isAvailable,
			costPerMillionInputTokens: 3,
			costPerMillionOutputTokens: 15,
			reasoning: 2,
			intelligence: 3,
			tools: 3,
			speed: 3,
			webSearch: 1,
			contextLength: 200000,
		},

		"sonar-reasoning": {
			provider,
			impl: perplexity("sonar-reasoning"),
			mangleRequest,
			isAvailable,
			costPerMillionInputTokens: 1,
			costPerMillionOutputTokens: 5,
			reasoning: 3,
			intelligence: 3,
			tools: 3,
			speed: 2,
			webSearch: 1,
			contextLength: 128000,
		},
		"sonar-reasoning-pro": {
			provider,
			impl: perplexity("sonar-reasoning-pro"),
			mangleRequest,
			isAvailable,
			costPerMillionInputTokens: 2,
			costPerMillionOutputTokens: 8,
			reasoning: 4,
			intelligence: 4,
			tools: 4,
			speed: 2,
			webSearch: 1,
			contextLength: 128000,
		},
		"sonar-deep-research": {
			provider,
			impl: perplexity("sonar-deep-research"),
			mangleRequest,
			isAvailable,
			costPerMillionInputTokens: 2,
			costPerMillionOutputTokens: 8,
			research: 3,
			reasoning: 5,
			intelligence: 5,
			tools: 5,
			speed: 1,
			webSearch: 1,
			contextLength: 128000,
		},
	};

	await modelRegistry.chat.registerAllModelSpecs(chatModels);
}

/**
 * Mangles OpenAI-style chat input messages to ensure they follow the required alternating pattern.
 * This function combines consecutive messages from the same role and ensures user/assistant roles alternate.
 *
 * @param {import('../client/AIChatClient.ts').ChatRequest} request - Array of OpenAI chat messages ({role, content} objects)
 */
function mangleRequest(request: ChatRequest): undefined {
	const { messages } = request;
	if (!messages || messages.length === 0) return undefined;

	// First, combine consecutive messages from the same role
	const combinedMessages = messages.reduce((acc: any[], current: any) => {
		if (acc.length === 0 || acc[acc.length - 1].role !== current.role) {
			// Add the message as is if it's the first one or has a different role from the previous one
			acc.push({ ...current });
		} else {
			// Combine with the previous message of the same role
			const lastMessage = acc[acc.length - 1];
			lastMessage.content = `${lastMessage.content}\n\n${current.content}`;
		}
		return acc;
	}, []);

	// Handle system messages separately as they can appear at the beginning
	const systemMessages = combinedMessages.filter(
		(msg: any) => msg.role === "system",
	);
	const nonSystemMessages = combinedMessages.filter(
		(msg: any) => msg.role !== "system",
	);

	// If there are no non-system messages, just return what we have
	if (nonSystemMessages.length === 0) {
		request.messages = combinedMessages;
		return undefined;
	}

	// Ensure the first non-system message is from the user
	if (nonSystemMessages[0].role !== "user") {
		nonSystemMessages.unshift({
			role: "user",
			content: "Hello",
		});
	}

	// Create a properly alternating sequence
	const alternatingMessages = [];

	// First add all system messages
	alternatingMessages.push(...systemMessages);

	// Then add alternating user/assistant messages
	let isUserTurn = true;

	for (const message of nonSystemMessages) {
		const expectedRole = isUserTurn ? "user" : "assistant";

		if (message.role === expectedRole) {
			alternatingMessages.push(message);
			isUserTurn = !isUserTurn;
		} else {
			// If the role doesn't match what we expect, insert a placeholder message
			alternatingMessages.push({
				role: expectedRole,
				content: expectedRole === "user" ? "Continue." : "I'll continue.",
			});
			alternatingMessages.push(message);
			isUserTurn = !isUserTurn;
		}
	}

	// Ensure the sequence ends with an assistant message if it ends with a user message
	if (alternatingMessages[alternatingMessages.length - 1].role !== "user") {
		alternatingMessages.push({
			role: "user",
			content: "Continue.",
		});
	}

	request.messages = alternatingMessages;
	return undefined;
}
