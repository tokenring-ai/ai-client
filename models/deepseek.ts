import { deepseek, createDeepSeek } from "@ai-sdk/deepseek";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

/**
 * The name of the AI provider.
 * @type {string}
 */
const providerName = "DeepSeek";

let isOffPeak = false;
function calculateOffPeak() {
	const now = new Date();
	const hours = now.getUTCHours();
	const minutes = now.getUTCMinutes();

	isOffPeak = (hours > 16 && minutes < 30) || (hours === 0 && minutes < 20);
	setTimeout(calculateOffPeak, 300000);
}

calculateOffPeak();

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
		throw new Error("No config.apiKey provided for DeepSeek provider.");
	}

	const getModels = cachedDataRetriever("https://api.deepseek.com/models", {
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
		},
	});

	const isAvailable = () => getModels().then((data) => !!data);

	const provider = config.provider || providerName;

	const deepseekProvider = createDeepSeek({
		apiKey: config.apiKey,
		baseURL: config.baseURL,
	});

	/**
	 * A collection of DeepSeek chat model specifications.
	 * Each key is a model ID, and the value is a `ChatModelSpec` object.
	 * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.ts).
	 * @type {Object<string,import("../client/AIChatClient.ts").ChatModelSpec>}
	 */
	const chatModels: Record<string, ChatModelSpec> = {
		"deepseek-chat": {
			provider,
			impl: deepseekProvider("deepseek-chat"),
			isAvailable: isOffPeak ? falsePromise : isAvailable,
			costPerMillionInputTokens: 0.27,
			costPerMillionOutputTokens: 1.1,
			reasoning: 1,
			intelligence: 3,
			tools: 3,
			speed: 2,
			contextLength: 64000,
		},
		"deepseek-reasoner": {
			provider,
			impl: deepseekProvider("deepseek-reasoner"),
			isAvailable: isOffPeak ? falsePromise : isAvailable,
			costPerMillionInputTokens: 0.55,
			costPerMillionOutputTokens: 2.19,
			reasoning: 5,
			intelligence: 5,
			tools: 5,
			speed: 2,
			contextLength: 64000,
		},
		"deepseek-chat-offpeak": {
			provider,
			impl: deepseekProvider("deepseek-chat"),
			isAvailable: isOffPeak ? isAvailable : falsePromise,
			costPerMillionInputTokens: 0.135,
			costPerMillionOutputTokens: 0.55,
			reasoning: 1,
			intelligence: 3,
			tools: 3,
			speed: 2,
			contextLength: 64000,
		},
		"deepseek-reasoner-offpeak": {
			provider,
			impl: deepseekProvider("deepseek-reasoner"),
			isAvailable: isOffPeak ? isAvailable : falsePromise,
			costPerMillionInputTokens: 0.135,
			costPerMillionOutputTokens: 0.55,
			reasoning: 5,
			intelligence: 5,
			tools: 5,
			speed: 2,
			contextLength: 64000,
		},
	};

	await modelRegistry.chat.registerAllModelSpecs(chatModels);
}

async function falsePromise() {
	return false;
}
