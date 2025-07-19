import { createOpenAI } from "@ai-sdk/openai";
import cachedDataRetriever from "../util/cachedDataRetriever.js";

/**
 * The name of the AI provider.
 * @type {string}
 */
const providerName = "Llama";

export async function init(modelRegistry, config) {
	if (!config.apiKey) {
		throw new Error("No config.apiKey provided for Llama provider.");
	}

	const getModels = cachedDataRetriever(
		"https://api.llama.com/compat/v1/models",
		{
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
			},
		},
	);

	const isAvailable = () => getModels().then((data) => !!data);

	const provider = config.provider || providerName;

	const openai = createOpenAI({
		apiKey: config.apiKey,
		baseURL: "https://api.llama.com/compat/v1",
	});

	const chatModels = generateChatModels(openai, provider, isAvailable);

	await modelRegistry.chat.registerAllModelSpecs(chatModels);
}

/**
 * A collection of Llama chat model specifications.
 * Each key is a model ID, and the value is a `ChatModelSpec` object.
 * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.js).
 * @param {*} providerImpl - The provider implementation
 * @param {string} provider - The provider name
 * @param {() => Promise<boolean>} [isAvailable] - Whether the models are available
 * @returns {Object<string, import('../ModelRegistry.js').ChatModelSpec>}
 */
function generateChatModels(providerImpl, provider, isAvailable) {
	return {
		// Updated Llama 3.3 models
		"Llama-3.3-70B-Instruct": {
			provider,
			name: "Meta Llama 3.3 70B Instruct",
			impl: providerImpl("Llama-3.3-70B-Instruct"),
			isAvailable,
			contextLength: 131072,
			maxCompletionTokens: 32768,
			costPerMillionInputTokens: 0,
			costPerMillionOutputTokens: 0,
			reasoning: 5, // 70B model - high reasoning capability
			intelligence: 5, // Large model with strong general intelligence
			speed: 4, // Larger model, moderate speed
			tools: 4, // Good tool use capabilities
		},
		"Llama-3.3-8B-Instruct": {
			provider,
			name: "Meta Llama 3.3 8B Instruct",
			impl: providerImpl("Llama-3.3-8B-Instruct"),
			isAvailable,
			contextLength: 131072,
			maxCompletionTokens: 131072,
			costPerMillionInputTokens: 0,
			costPerMillionOutputTokens: 0,
			reasoning: 3, // Smaller 8B model - decent reasoning
			intelligence: 3, // Good but limited by size
			speed: 6, // Smaller model - faster inference
			tools: 3, // Moderate tool use capabilities
		},
		"Llama-4-Maverick-17B-128E-Instruct-FP8": {
			provider,
			name: "Meta Llama 4 Maverick 17B (128E) Instruct",
			impl: providerImpl("Llama-4-Maverick-17B-128E-Instruct-FP8"),
			isAvailable,
			contextLength: 131072,
			maxCompletionTokens: 32768,
			costPerMillionInputTokens: 0,
			costPerMillionOutputTokens: 0,
			reasoning: 5, // Llama 4 generation with "Maverick" suggesting advanced capabilities
			intelligence: 5, // Next-gen model with 128 experts (128E)
			speed: 4, // FP8 quantization may help with speed, but 17B size is moderate
			tools: 4, // Advanced model likely good with tools
		},
		"Llama-4-Scout-17B-16E-Instruct-FP8": {
			provider,
			name: "Meta Llama 4 Scout 17B (16E) Instruct",
			impl: providerImpl("Llama-4-Scout-17B-16E-Instruct-FP8"),
			isAvailable,
			contextLength: 131072,
			maxCompletionTokens: 32768,
			costPerMillionInputTokens: 0,
			costPerMillionOutputTokens: 0,
			reasoning: 4, // Llama 4 but "Scout" may suggest more specialized/lighter variant
			intelligence: 4, // Still Llama 4 but with fewer experts (16E vs 128E)
			speed: 5, // Fewer experts and FP8 quantization should make it faster
			tools: 4, // Good tool capabilities expected from Llama 4
		},
	};
}
