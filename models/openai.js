import { createOpenAI, openai } from "@ai-sdk/openai";
import cachedDataRetriever from "../util/cachedDataRetriever.js";

/**
 * The name of the AI provider.
 * @type {string}
 */
const providerName = "OpenAI";

export async function init(modelRegistry, { apiKey, baseURL, provider }) {
	if (!apiKey) {
		throw new Error("No config.apiKey provided for OpenAI provider.");
	}
	baseURL ??= "https://api.openai.com/v1";

	const openai = createOpenAI({ apiKey, baseURL, compatibility: "strict" });

	const getModels = cachedDataRetriever(`${baseURL}/models`, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	});

	const isAvailable = () => getModels().then((data) => !!data);

	provider ??= providerName;

	/**
	 * A collection of OpenAI chat model specifications.
	 * Each key is a model ID, and the value is a `ChatModelSpec` object.
	 * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.js).
	 * @type {Object<string,ChatModelSpec>}
	 */
	const chatModels = {
		"gpt-4.1-web-search": {
			provider,
			impl: openai("gpt-4.1"),
			isAvailable,
			mangleRequest(req) {
				req.tools.web_search_preview = openai.tools.webSearchPreview();
			},
			costPerMillionInputTokens: 2.0,
			costPerMillionOutputTokens: 8.0,
			reasoning: 3,
			intelligence: 5,
			tools: 5,
			speed: 3,
			webSearch: 1,
			contextLength: 1000000,
		},
		"gpt-4.1-mini-web-search": {
			provider,
			impl: openai("gpt-4.1-mini"),
			isAvailable,
			mangleRequest(req) {
				req.tools.web_search_preview = openai.tools.webSearchPreview();
			},
			costPerMillionInputTokens: 0.4,
			costPerMillionOutputTokens: 1.6,
			reasoning: 2,
			intelligence: 4,
			tools: 4,
			speed: 4,
			webSearch: 1,
			contextLength: 1000000,
		},
		"gpt-4.1": {
			provider,
			impl: openai("gpt-4.1"),
			isAvailable,
			costPerMillionInputTokens: 2.0,
			costPerMillionOutputTokens: 8.0,
			reasoning: 3,
			intelligence: 5,
			tools: 5,
			speed: 3,
			contextLength: 1000000,
		},
		"gpt-4.1-mini": {
			provider,
			impl: openai("gpt-4.1-mini"),
			isAvailable,
			costPerMillionInputTokens: 0.4,
			costPerMillionOutputTokens: 1.6,
			reasoning: 2,
			intelligence: 4,
			tools: 4,
			speed: 4,
			contextLength: 1000000,
		},
		"gpt-4.1-nano": {
			provider,
			impl: openai("gpt-4.1-nano"),
			isAvailable,
			costPerMillionInputTokens: 0.1,
			costPerMillionOutputTokens: 0.4,
			reasoning: 1,
			intelligence: 2,
			tools: 2,
			speed: 5,
			contextLength: 1000000,
		},
		o3: {
			provider,
			impl: openai("o3"),
			isAvailable,

			costPerMillionInputTokens: 10.0,
			costPerMillionOutputTokens: 40.0,
			reasoning: 6,
			intelligence: 6,
			tools: 6,
			speed: 2,
			webSearch: 1,
			contextLength: 200000,
		},
		"o4-mini": {
			provider,
			impl: openai("o4-mini"),
			isAvailable,
			costPerMillionInputTokens: 1.1,
			costPerMillionOutputTokens: 4.4,
			reasoning: 5,
			intelligence: 5,
			tools: 5,
			speed: 3,
			webSearch: 1,
			contextLength: 200000,
		},
		"o1-pro": {
			provider,
			impl: openai("o1-pro"),
			isAvailable,

			costPerMillionInputTokens: 150.0,
			costPerMillionOutputTokens: 600.0,
			reasoning: 7,
			intelligence: 7,
			speed: 1,
			tools: 5,
			webSearch: 1,
			contextLength: 200000,
		},
	};

	for (const modelName of Object.keys(chatModels)) {
		const model = chatModels[modelName];
		if (model.webSearch) {
			const newModel = {
				...model,
				mangleRequest(req) {
					req.tools.web_search_preview = openai.tools.webSearchPreview();
				},
				costPerMillionInputTokens: model.costPerMillionInputTokens + 0.001, // Adjust the cost slightly so that these models are only used for search
				costPerMillionOutputTokens: model.costPerMillionOutputTokens + 0.001,
			};

			delete model.webSearch;

			chatModels[modelName + "-web-search"] = newModel;
		}
	}

	/**
	 * A collection of OpenAI image generation model specifications.
	 * Each key is a model ID, and the value is an `ImageModelSpec` object.
	 * @type {Object<string,ImageModelSpec>}
	 */
	const imageGenerationModels = {
		"gpt-image-1": {
			provider,
			impl: openai("gpt-image-1"),
			isAvailable,
			costPerMillionInputTokens: 5.0,
			costPerMillionOutputTokens: 40.0,
		},
	};

	await modelRegistry.chat.registerAllModelSpecs(chatModels);
	await modelRegistry.imageGeneration.registerAllModelSpecs(
		imageGenerationModels,
	);
}
