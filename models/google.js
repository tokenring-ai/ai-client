import { google } from "@ai-sdk/google";
import cachedDataRetriever from "../util/cachedDataRetriever.js";
import { openai } from "@ai-sdk/openai";

/**
 * The name of the AI provider.
 * @type {string}
 */
const providerName = "Google";

export async function init(modelRegistry, config) {
	if (!config.apiKey) {
		throw new Error("No config.apiKey provided for Google provider.");
	}

	const getModels = cachedDataRetriever(
		"https://generativelanguage.googleapis.com/v1beta/openai/models",
		{
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
			},
		},
	);

	const isAvailable = () => getModels().then((data) => !!data);

	const provider = config.provider || providerName;

	/**
	 * A collection of Google chat model specifications.
	 * Each key is a model ID, and the value is a `ChatModelSpec` object.
	 * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.js).
	 * @type {Object<string,ChatModelSpec>}
	 */
	const chatModels = {
		"gemini-1.5-pro": {
			provider,
			impl: google("gemini-1.5-pro"),
			isAvailable,
			costPerMillionInputTokens: 7.0,
			costPerMillionOutputTokens: 7.0,
			reasoning: 3,
			intelligence: 3,
			tools: 3,
			speed: 2,
			contextLength: 2000000,
		},
		"gemini-1.5-flash": {
			provider,
			impl: google("gemini-1.5-flash"),
			isAvailable,
			costPerMillionInputTokens: 0.075,
			costPerMillionOutputTokens: 0.3,
			reasoning: 1,
			intelligence: 3,
			tools: 3,
			speed: 5,
			contextLength: 128000,
		},
		"gemini-2.5-pro": {
			provider,
			impl: google("gemini-2.5-pro"),
			isAvailable,
			costPerMillionInputTokens: 4.0,
			costPerMillionOutputTokens: 20.0,
			reasoning: 6,
			intelligence: 6,
			tools: 6,
			speed: 2,
			webSearch: 1,
			contextLength: 1000000,
		},
		"gemini-2.5-flash": {
			provider,
			impl: google("gemini-2.5-flash"),
			isAvailable,
			costPerMillionInputTokens: 0.3,
			costPerMillionOutputTokens: 2.5,
			reasoning: 5,
			intelligence: 4,
			tools: 4,
			speed: 4,
			webSearch: 1,
			contextLength: 1000000,
		},
		"gemini-2.5-flash-lite": {
			provider,
			impl: google("gemini-2.5-flash-lite"),
			isAvailable,
			costPerMillionInputTokens: 0.1,
			costPerMillionOutputTokens: 0.4,
			reasoning: 2,
			intelligence: 3,
			tools: 3,
			speed: 5,
			contextLength: 1000000,
		},
	};

	for (const modelName of Object.keys(chatModels)) {
		const model = chatModels[modelName];
		const newModel = {
			...model,
			impl: google(model.impl.modelId, { useSearchGrounding: true }),
			costPerMillionInputTokens: model.costPerMillionInputTokens + 0.001, // Adjust the cost slightly so that these models are only used for search
			costPerMillionOutputTokens: model.costPerMillionOutputTokens + 0.001,
		};

		delete model.webSearch;

		chatModels[modelName + "-web-search"] = newModel;
	}

	await modelRegistry.chat.registerAllModelSpecs(chatModels);
}
