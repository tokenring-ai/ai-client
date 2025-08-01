import { anthropic } from "@ai-sdk/anthropic";
import cachedDataRetriever from "../util/cachedDataRetriever.js";

/**
 * The name of the AI provider.
 * @type {string}
 */
const providerName = "Anthropic";

export async function init(modelRegistry, config) {
	if (!config.apiKey) {
		throw new Error("No config.apiKey provided for Anthropic provider.");
	}

	const getModels = cachedDataRetriever("https://api.anthropic.com/v1/models", {
		headers: {
			"x-api-key": config.apiKey,
			"anthropic-version": "2023-06-01",
		},
	});

	const isAvailable = () => getModels().then((data) => !!data);

	const provider = config.provider || providerName;

	/**
	 * A collection of Anthropic chat model specifications.
	 * Each key is a model ID, and the value is a `ChatModelSpec` object.
	 * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.js).
	 * @type {Object<string,ChatModelSpec>}
	 */
	const chatModels = {
		"claude-4-opus": {
			provider,
			impl: anthropic("claude-opus-4-20250514"),
			isAvailable,
			costPerMillionInputTokens: 15.0, // $15 / MTok
			costPerMillionOutputTokens: 75.0, // $75 / MTok
			reasoning: 6,
			intelligence: 6,
			tools: 6,
			speed: 2,
			contextLength: 200000,
		},
		"claude-4-sonnet": {
			provider,
			impl: anthropic("claude-sonnet-4-20250514"),
			isAvailable,
			costPerMillionInputTokens: 3.0, // $3 / MTok
			costPerMillionOutputTokens: 15.0, // $15 / MTok
			reasoning: 5,
			intelligence: 5,
			tools: 5,
			speed: 3,
			contextLength: 200000,
		},
		"claude-3.7-sonnet": {
			provider,
			impl: anthropic("claude-3-7-sonnet-20250219"),
			isAvailable,
			costPerMillionInputTokens: 3.0, // $3 / MTok
			costPerMillionOutputTokens: 15.0, // $15 / MTok
			reasoning: 4,
			intelligence: 4,
			tools: 4,
			speed: 3,
			contextLength: 200000,
		},
		"claude-3.5-sonnet": {
			provider,
			impl: anthropic("claude-3-5-sonnet-20240620"),
			isAvailable,
			costPerMillionInputTokens: 3.0, // $3 / MTok
			costPerMillionOutputTokens: 15.0, // $15 / MTok
			reasoning: 3,
			intelligence: 3,
			tools: 3,
			speed: 3,
			contextLength: 200000,
		},
		"claude-3.5-haiku": {
			provider,
			impl: anthropic("claude-3-5-haiku-20241022"),
			isAvailable,
			costPerMillionInputTokens: 0.8, // $0.80 / MTok
			costPerMillionOutputTokens: 4.0, // $4 / MTok
			reasoning: 2,
			intelligence: 3,
			tools: 3,
			speed: 4,
			contextLength: 200000,
		},
	};

	await modelRegistry.chat.registerAllModelSpecs(chatModels);
}
