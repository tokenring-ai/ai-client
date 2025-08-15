import {createOpenAI} from "@ai-sdk/openai";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";
/**
 * @param {import('../ModelRegistry.ts').default} modelRegistry
 * @param {import("../ModelRegistry.ts").ModelConfig} config
 * @returns {Promise<void>}
 *
 */
import type ModelRegistry from "../ModelRegistry.ts";
import type {ModelConfig} from "../ModelRegistry.ts";
import type {ChatModelSpec, ChatRequest} from "../client/AIChatClient.ts";
import type {ImageModelSpec} from "../client/AIImageGenerationClient.ts";

/**
 * The name of the AI provider.
 * @type {string}
 */
const providerName = "OpenAI";

export async function init(modelRegistry: ModelRegistry, { apiKey, baseURL, provider }: ModelConfig) {
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
	 * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.ts).
	 * @type {Object<string,import("../client/AIChatClient.ts").ChatModelSpec>}
	 */
 const chatModels: Record<string, ChatModelSpec> = {
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
		"gpt-5": {
			provider,
			impl: openai("gpt-5"),
			isAvailable,
			costPerMillionInputTokens: 1.25,
			costPerMillionOutputTokens: 10,
			reasoning: 4,
			intelligence: 6,
			tools: 6,
			speed: 3,
			webSearch: 1,
			contextLength: 400000,
		},
		"gpt-5-mini": {
			provider,
			impl: openai("gpt-5-mini"),
			isAvailable,
			costPerMillionInputTokens: 0.25,
			costPerMillionOutputTokens: 2,
			reasoning: 3,
			intelligence: 5,
			tools: 5,
			speed: 4,
			webSearch: 1,
			contextLength: 400000,
		},
        "gpt-5-nano": {
            provider,
            impl: openai("gpt-5-nano"),
            isAvailable,
            costPerMillionInputTokens: 0.05,
            costPerMillionOutputTokens: 0.4,
            reasoning: 2,
            intelligence: 3,
            tools: 3,
            speed: 5,
            webSearch: 1,
            contextLength: 400000,
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

 for (const modelName in chatModels) {
		const model = chatModels[modelName];
		if (model.webSearch) {
			const newModel = {
				...model,
				mangleRequest(req: any) {
					req.tools.web_search_preview = openai.tools.webSearchPreview();
					return undefined;
				},
				costPerMillionInputTokens: model.costPerMillionInputTokens + 0.001, // Adjust the cost slightly so that these models are only used for search
				costPerMillionOutputTokens: model.costPerMillionOutputTokens + 0.001,
			};

			delete model.webSearch;

			chatModels[`${modelName}-web-search`] = newModel;
		}
	}

	/**
	 * A collection of OpenAI image generation model specifications.
	 * Each key is a model ID, and the value is an `ImageModelSpec` object.
	 * @type {Object<string,import("../client/AIImageGenerationClient.ts").ImageModelSpec>}
	 */
 const imageGenerationModels: Record<string, ImageModelSpec> = {
		"gpt-image-1": {
			provider,
			impl: openai.imageModel("gpt-image-1"),
			isAvailable,
			calculateImageCost(usage) {
				return 0.25; //TODO - this is a placeholder cost, need to figure out how to get the actual cost from the API
			},
			costPerMillionInputTokens: 5.0,
			costPerMillionOutputTokens: 40.0,
		},
	};

	await modelRegistry.chat.registerAllModelSpecs(chatModels);
	await modelRegistry.imageGeneration.registerAllModelSpecs(
		imageGenerationModels,
	);
}
