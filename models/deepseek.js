import { deepseek } from "@ai-sdk/deepseek";
import cachedDataRetriever from "../util/cachedDataRetriever.js";

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
 * @param {ModelRegistry} modelRegistry
 * @param {ModelConfig} config
 * @returns {Promise<void>}
 *
 */
export async function init(modelRegistry, config) {
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

	/**
	 * A collection of DeepSeek chat model specifications.
	 * Each key is a model ID, and the value is a `ChatModelSpec` object.
	 * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.js).
	 * @type {Object<string,ChatModelSpec>}
	 */
	const chatModels = {
		"deepseek-chat": {
			provider,
			impl: deepseek("deepseek-chat"),
			isAvailable: isOffPeak ? false : isAvailable,
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
			impl: deepseek("deepseek-reasoner"),
			isAvailable: isOffPeak ? false : isAvailable,
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
			impl: deepseek("deepseek-chat"),
			isAvailable: isOffPeak ? isAvailable : false,
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
			impl: deepseek("deepseek-reasoner"),
			isAvailable: isOffPeak ? isAvailable : false,
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
