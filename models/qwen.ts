import { qwen } from "qwen-ai-provider";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

/**
 * The name of the AI provider.
 * @type {string}
 */
const providerName = "Qwen";

/**
 * @param {import('../ModelRegistry.ts').default} modelRegistry
 * @param {import("../ModelRegistry.ts").ModelConfig} config
 * @returns {Promise<void>}
 *
 */
import type ModelRegistry from "../ModelRegistry.ts";
import type { ModelConfig } from "../ModelRegistry.ts";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
export async function init(modelRegistry: ModelRegistry, config: ModelConfig) {
	if (!config.apiKey) {
		throw new Error("No config.apiKey provided for Qwen provider.");
	}

	const getModels = cachedDataRetriever(
		"https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models",
		{
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
				"Content-Type": "application/json",
			},
		},
	);

	const isAvailable = () => getModels().then((data) => !!data);

	const provider = config.provider || providerName;

	/**
	 * A collection of Qwen chat model specifications.
	 * Each key is a model ID, and the value is a `ChatModelSpec` object.
	 * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.ts).
	 * @type {Object<string,import('../client/AIChatClient.ts').ChatModelSpec>}
	 */
	const chatModels = {
		"qwen3-coder-plus": {
			provider,
			impl: qwen("qwen3-coder-plus"),
			isAvailable,
			costPerMillionInputTokens: 1.8,
			costPerMillionOutputTokens: 9,
			reasoning: 0,
			intelligence: 6,
			tools: 6,
			speed: 6,
			contextLength: 1048576,
		},
		"qwen-max": {
			provider,
			impl: qwen("qwen-max"),
			isAvailable,
			costPerMillionInputTokens: 1.6,
			costPerMillionOutputTokens: 6.4,
			reasoning: 3,
			intelligence: 3,
			tools: 3,
			speed: 2,
			contextLength: 32768,
		},
		"qwen-plus": {
			provider,
			impl: qwen("qwen-plus"),
			isAvailable,
			costPerMillionInputTokens: 0.4,
			costPerMillionOutputTokens: 1.2,
			reasoning: 2,
			intelligence: 2,
			tools: 2,
			speed: 3,
			contextLength: 131072,
		},
		"qwen-turbo": {
			provider,
			impl: qwen("qwen-turbo"),
			isAvailable,
			costPerMillionInputTokens: 0.05,
			costPerMillionOutputTokens: 0.2,
			reasoning: 1,
			intelligence: 1,
			tools: 1,
			speed: 5,
			contextLength: 1008192,
		},
		"qwq-plus": {
			provider,
			impl: qwen("qwq-plus"),
			isAvailable,
			costPerMillionInputTokens: 0.8,
			costPerMillionOutputTokens: 2.4,
			reasoning: 3,
			intelligence: 3,
			tools: 2,
			speed: 2,
			contextLength: 131072,
		},
		"qwen2.5-72b-instruct": {
			provider,
			impl: qwen("qwen2.5-72b-instruct"),
			isAvailable,
			costPerMillionInputTokens: 1.4,
			costPerMillionOutputTokens: 5.6,
			reasoning: 2,
			intelligence: 3,
			tools: 2,
			speed: 2,
			contextLength: 131072,
		},
		"qwen2.5-32b-instruct": {
			provider,
			impl: qwen("qwen2.5-32b-instruct"),
			isAvailable,
			costPerMillionInputTokens: 0.7,
			costPerMillionOutputTokens: 2.8,
			reasoning: 2,
			intelligence: 2,
			tools: 2,
			speed: 3,
			contextLength: 131072,
		},
		"qwen2.5-14b-instruct": {
			provider,
			impl: qwen("qwen2.5-14b-instruct"),
			isAvailable,
			costPerMillionInputTokens: 0.35,
			costPerMillionOutputTokens: 1.4,
			reasoning: 2,
			intelligence: 2,
			tools: 2,
			speed: 4,
			contextLength: 131072,
		},
		"qwen2.5-7b-instruct": {
			provider,
			impl: qwen("qwen2.5-7b-instruct"),
			isAvailable,
			costPerMillionInputTokens: 0.175,
			costPerMillionOutputTokens: 0.7,
			reasoning: 1,
			intelligence: 2,
			tools: 1,
			speed: 4,
			contextLength: 131072,
		},
		"qwen3-32b": {
			provider,
			impl: qwen("qwen3-32b"),
			isAvailable,
			costPerMillionInputTokens: 0.7,
			costPerMillionOutputTokens: 2.8,
			reasoning: 3,
			intelligence: 3,
			tools: 3,
			speed: 3,
			contextLength: 131072,
		},
		"qwen3-14b": {
			provider,
			impl: qwen("qwen3-14b"),
			isAvailable,
			costPerMillionInputTokens: 0.35,
			costPerMillionOutputTokens: 1.4,
			reasoning: 2,
			intelligence: 2,
			tools: 2,
			speed: 4,
			contextLength: 131072,
		},
		"qwen3-8b": {
			provider,
			impl: qwen("qwen3-8b"),
			isAvailable,
			costPerMillionInputTokens: 0.18,
			costPerMillionOutputTokens: 0.7,
			reasoning: 2,
			intelligence: 2,
			tools: 2,
			speed: 4,
			contextLength: 131072,
		},
	};

	await modelRegistry.chat.registerAllModelSpecs(chatModels);
}
