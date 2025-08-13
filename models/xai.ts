import {xai} from "@ai-sdk/xai";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";
/**
 * @param {import('../ModelRegistry.ts').default} modelRegistry
 * @param {import("../ModelRegistry.ts").ModelConfig} config
 * @returns {Promise<void>}
 *
 */
import type ModelRegistry from "../ModelRegistry.ts";
import type {ModelConfig} from "../ModelRegistry.ts";
import type {ChatModelSpec} from "../client/AIChatClient.ts";

/**
 * The name of the AI provider.
 * @type {string}
 */
const providerName = "xAI";

export async function init(modelRegistry: ModelRegistry, config: ModelConfig) {
	if (!config.apiKey) {
		throw new Error("No config.apiKey provided for xAI provider.");
	}

	const getModels = cachedDataRetriever("https://api.xai.com/v1/models", {
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
		},
	});

	const isAvailable = () => getModels().then((data) => !!data);

	const provider = config.provider || providerName;

	/**
	 * A collection of xAI chat model specifications.
	 * Each key is a model ID, and the value is a `ChatModelSpec` object.
	 * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.ts).
	 * @type {Object<string,import("../client/AIChatClient.ts").ChatModelSpec>}
	 */
	const chatModels: Record<string, ChatModelSpec> = {
		"grok-2": {
			provider,
			impl: xai("grok-2"),
			isAvailable,
			costPerMillionInputTokens: 2,
			costPerMillionOutputTokens: 10,
			reasoning: 2,
			intelligence: 3,
			tools: 3,
			speed: 3,
			contextLength: 131072,
		},
		"grok-3": {
			provider,
			impl: xai("grok-3"),
			isAvailable,
			costPerMillionInputTokens: 3,
			costPerMillionOutputTokens: 15.0,
			reasoning: 5,
			intelligence: 5,
			tools: 5,
			speed: 2,
			contextLength: 131072,
		},
		"grok-3-mini": {
			provider,
			impl: xai("grok-3-mini"),
			isAvailable,
			costPerMillionInputTokens: 0.3,
			costPerMillionOutputTokens: 0.5,
			reasoning: 4,
			intelligence: 4,
			tools: 4,
			speed: 3,
			contextLength: 131072,
		},
		"grok-4": {
			provider,
			impl: xai("grok-4-0709"),
			isAvailable,
			costPerMillionInputTokens: 3,
			costPerMillionOutputTokens: 15.0,
			reasoning: 6,
			intelligence: 6,
			tools: 6,
			speed: 3,
			contextLength: 256000,
		},
	};

	await modelRegistry.chat.registerAllModelSpecs(chatModels);
}
