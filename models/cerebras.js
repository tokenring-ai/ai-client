import { cerebras } from "@ai-sdk/cerebras";
import cachedDataRetriever from "../util/cachedDataRetriever.js";

/**
 * The name of the AI provider.
 * @type {string}
 */
const providerName = "Cerebras";

export async function init(modelRegistry, config) {
	if (!config.apiKey) {
		throw new Error("No config.apiKey provided for Cerebras provider.");
	}

	const getModels = cachedDataRetriever("https://api.cerebras.ai/v1/models", {
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
			"Content-Type": "application/json",
		},
	});

	const isAvailable = () => getModels().then((data) => !!data);

	const provider = config.provider || providerName;

	/**
	 * A collection of Cerebras chat model specifications.
	 * Each key is a model ID, and the value is a `ChatModelSpec` object.
	 * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.js).
	 * @type {Object<string,ChatModelSpec>}
	 */
	const chatModels = {
		"deepseek-r1-distill-llama-70b": {
			provider,
			impl: cerebras("deepseek-r1-distill-llama-70b"),
			isAvailable,
			costPerMillionInputTokens: 0.0,
			costPerMillionOutputTokens: 0.0,
			reasoning: 1,
			intelligence: 1,
			tools: 1,
			speed: 3,
			contextLength: 100000,
		},
		"llama-4-scout-17b-16e-instruct": {
			provider,
			impl: cerebras("llama-4-scout-17b-16e-instruct"),
			isAvailable,
			costPerMillionInputTokens: 0.0,
			costPerMillionOutputTokens: 0.0,
			reasoning: 2,
			intelligence: 2,
			tools: 2,
			speed: 5,
			contextLength: 100000,
		},
		"qwen-3-32b": {
			provider,
			impl: cerebras("qwen-3-32b"),
			isAvailable,
			costPerMillionInputTokens: 0.0,
			costPerMillionOutputTokens: 0.0,
			reasoning: 1,
			intelligence: 1,
			tools: 1,
			speed: 5,
			contextLength: 100000,
		},
	};

	await modelRegistry.chat.registerAllModelSpecs(chatModels);
}
