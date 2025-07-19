import { groq } from "@ai-sdk/groq";
import cachedDataRetriever from "../util/cachedDataRetriever.js";

/**
 * The name of the AI provider.
 * @type {string}
 */
const providerName = "Groq";

export async function init(modelRegistry, config) {
	if (!config.apiKey) {
		throw new Error("No config.apiKey provided for Groq provider.");
	}

	const getModels = cachedDataRetriever(
		"https://api.groq.com/openai/v1/models",
		{
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
			},
		},
	);

	const isAvailable = () => getModels().then((data) => !!data);

	const provider = config.provider || providerName;

	/**
	 * A collection of Groq chat model specifications.
	 * Each key is a model ID, and the value is a `ChatModelSpec` object.
	 * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.js).
	 * @type {Object<string, import('../ModelRegistry.js').ChatModelSpec>}
	 */
	const chatModels = {
		// Production Models from Groq Docs, with pricing from user feedback
		"gemma2-9b-it": {
			provider,
			name: "Google Gemma 2 9B IT", // User name: Gemma 2 9B 8k
			impl: groq("gemma2-9b-it"),
			isAvailable,
			contextLength: 8192,
			maxCompletionTokens: 8192,
			costPerMillionInputTokens: 0.2,
			costPerMillionOutputTokens: 0.2,
			reasoning: 3,
			intelligence: 3,
			speed: 5, // Groq is fast
			tools: 2,
		},
		"llama-3.1-8b-instant": {
			provider,
			name: "Meta Llama 3.1 8B Instant", // User name: Llama 3.1 8B Instant 128k
			impl: groq("llama-3.1-8b-instant"),
			isAvailable,
			contextLength: 131072,
			maxCompletionTokens: 131072,
			costPerMillionInputTokens: 0.05,
			costPerMillionOutputTokens: 0.08,
			reasoning: 3,
			intelligence: 3,
			speed: 6, // Extra fast for "instant"
			tools: 2,
		},
		"llama-3.3-70b-versatile": {
			provider,
			name: "Meta Llama 3.3 70B Versatile", // User name: Llama 3.3 70B Versatile 128k
			impl: groq("llama-3.3-70b-versatile"),
			isAvailable,
			contextLength: 131072,
			maxCompletionTokens: 32768,
			costPerMillionInputTokens: 0.59,
			costPerMillionOutputTokens: 0.79,
			reasoning: 4,
			intelligence: 4,
			speed: 5,
			tools: 3,
		},
		// Preview Models (use with caution, map prices if available)
		"deepseek-r1-distill-llama-70b": {
			provider,
			name: "DeepSeek R1 Distill Llama 70B", // User name: DeepSeek R1 Distill Llama 70B
			impl: groq("deepseek-r1-distill-llama-70b"),
			isAvailable,
			contextLength: 131072,
			maxCompletionTokens: 131072,
			costPerMillionInputTokens: 0.75,
			costPerMillionOutputTokens: 0.99,
			reasoning: 4,
			intelligence: 4,
			speed: 4,
			tools: 3,
		},
		"meta-llama/llama-4-maverick-17b-128e-instruct": {
			provider,
			name: "Meta Llama 4 Maverick (17Bx128E)", // User name: Llama 4 Maverick (17Bx128E)
			impl: groq("meta-llama/llama-4-maverick-17b-128e-instruct"),
			isAvailable,
			contextLength: 131072,
			maxCompletionTokens: 8192,
			costPerMillionInputTokens: 0.2,
			costPerMillionOutputTokens: 0.6,
			reasoning: 4,
			intelligence: 4,
			speed: 4,
			tools: 3,
		},
		"meta-llama/llama-4-scout-17b-16e-instruct": {
			provider,
			name: "Meta Llama 4 Scout (17Bx16E)", // User name: Llama 4 Scout (17Bx16E)
			impl: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
			isAvailable,
			contextLength: 131072,
			maxCompletionTokens: 8192,
			costPerMillionInputTokens: 0.11,
			costPerMillionOutputTokens: 0.34,
			reasoning: 3,
			intelligence: 3,
			speed: 4,
			tools: 3,
		},
		"mistral-saba-24b": {
			provider,
			name: "Mistral Saba 24B", // User name: Mistral Saba 24B
			impl: groq("mistral-saba-24b"),
			isAvailable,
			contextLength: 32768,
			maxCompletionTokens: 32768,
			costPerMillionInputTokens: 0.79,
			costPerMillionOutputTokens: 0.79,
			reasoning: 3,
			intelligence: 4,
			speed: 4,
			tools: 3,
		},
		"qwen/qwen3-32b": {
			provider,
			name: "Alibaba Qwen3 32B", // User name: Qwen3 32B 131k
			impl: groq("qwen/qwen3-32b"),
			isAvailable,
			contextLength: 131072,
			maxCompletionTokens: 40960,
			costPerMillionInputTokens: 0.29,
			costPerMillionOutputTokens: 0.59,
			reasoning: 4,
			intelligence: 4,
			speed: 4,
			tools: 3,
		},
		"qwen-qwq-32b": {
			// Official ID for "Qwen QwQ 32B (Preview) 128k"
			provider,
			name: "Alibaba Qwen QwQ 32B (Preview)",
			impl: groq("qwen-qwq-32b"),
			isAvailable,
			contextLength: 131072,
			maxCompletionTokens: 131072,
			costPerMillionInputTokens: 0.29,
			costPerMillionOutputTokens: 0.39,
			reasoning: 4,
			intelligence: 4,
			speed: 4,
			tools: 3,
		},
		"kimi-k2-instruct": {
			provider,
			name: "Moonshot AI Kimi K2 Instruct (Preview) 128k",
			impl: groq("moonshotai/kimi-k2-instruct"),
			isAvailable,
			contextLength: 131072,
			maxCompletionTokens: 16384,
			costPerMillionInputTokens: 1,
			costPerMillionOutputTokens: 3,
			reasoning: 4,
			intelligence: 4,
			speed: 5,
			tools: 5,
		},
	};

	await modelRegistry.chat.registerAllModelSpecs(chatModels);
}
