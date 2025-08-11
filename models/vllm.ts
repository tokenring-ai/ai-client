import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

const providerName = "VLLM";
/**
 * @param {import('../ModelRegistry.ts').default} modelRegistry
 * @param {import("../ModelRegistry.ts").ModelConfig & { generateModelSpec: function}} config
 * @returns {Promise<void>}
 *
 */
import type ModelRegistry from "../ModelRegistry.ts";
import type { ModelConfig } from "../ModelRegistry.ts";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
import type { ModelSpec as EmbeddingModelSpec } from "../client/AIEmbeddingClient.ts";
export async function init(modelRegistry: ModelRegistry, config: ModelConfig & { generateModelSpec: (info: any) => { type: string; capabilities?: any } }) {
	const { baseURL, apiKey, generateModelSpec } = config;
	if (!baseURL) {
		throw new Error("No config.baseURL provided for VLLM provider.");
	}
	if (!generateModelSpec) {
		throw new Error("No config.generateModelSpec provided for VLLM provider.");
	}

 	const chatModelSpecs: Record<string, ChatModelSpec> = {};
	const embeddingModelSpecs: Record<string, EmbeddingModelSpec> = {};

	const openai = createOpenAICompatible({
		name: providerName,
		baseURL,
		apiKey,
	});

	const getModelList = cachedDataRetriever(`${baseURL}/models`, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		cacheTime: 60000,
		timeout: 5000,
	});
	//const getRunningModels = cachedDataRetriever(baseURL + '/ps', { cacheTime: 60000, timeout: 1000 });
	//getRunningModels(); // In background, fetch the list of running models.

	const modelList = await getModelList();
	if (!modelList?.data) return;

	for (const modelInfo of modelList.data) {
		const { type, capabilities = {} } = generateModelSpec(modelInfo);

		if (type === "chat") {
			chatModelSpecs[modelInfo.id] = {
				provider: config.provider ?? providerName,
				name: modelInfo.id,
				impl: openai.chatModel(modelInfo.id),
				isAvailable: () => getModelList().then((data) => !!data),
				isHot: () => Promise.resolve(true),
				//mangleRequest,
				...capabilities,
			};
		} else if (type === "embedding") {
			embeddingModelSpecs[modelInfo.model] = {
				provider: providerName,
				contextLength: capabilities.contextLength || 8192,
				costPerMillionInputTokens: capabilities.costPerMillionInputTokens || 0,
				impl: openai.textEmbeddingModel(modelInfo.model),
				isAvailable: () => getModelList().then((data) => !!data),
				isHot: () => Promise.resolve(true),
			};
		}
	}

	if (Object.keys(chatModelSpecs).length > 0) {
		modelRegistry.chat.registerAllModelSpecs(chatModelSpecs);
	}

	if (Object.keys(embeddingModelSpecs).length > 0) {
		modelRegistry.embedding.registerAllModelSpecs(embeddingModelSpecs);
	}
}

/**
 * Mangles OpenAI-style chat input messages to ensure they follow the required alternating pattern.
 * This function combines consecutive messages from the same role and ensures user/assistant roles alternate.
 *
 * @param {{ messages: Array<{role: string, content: string}>}} request - Array of OpenAI chat messages ({role, content} objects)
 */
function _mangleRequest(request: { messages: Array<{ role: string; content: string }> }): void {
	const { messages } = request;
	if (!messages || messages.length === 0) return;

	// First, combine consecutive messages from the same role
	const combinedMessages = messages.reduce((acc: Array<{ role: string; content: string }>, current: { role: string; content: string }) => {
		if (acc.length === 0 || acc[acc.length - 1].role !== current.role) {
			// Add the message as is if it's the first one or has a different role from the previous one
			acc.push({ ...current });
		} else {
			// Combine with the previous message of the same role
			const lastMessage = acc[acc.length - 1];
			lastMessage.content = `${lastMessage.content}\n\n${current.content}`;
		}
		return acc;
	}, []);

	// Handle system messages separately as they can appear at the beginning
	const systemMessages = combinedMessages.filter(
		(msg: { role: string }) => msg.role === "system",
	);
	const nonSystemMessages = combinedMessages.filter(
		(msg: { role: string }) => msg.role !== "system",
	);

	// If there are no non-system messages, just return what we have
	if (nonSystemMessages.length === 0) {
		request.messages = combinedMessages;
		return;
	}

	// Ensure the first non-system message is from the user
	if (nonSystemMessages[0].role !== "user") {
		nonSystemMessages.unshift({
			role: "user",
			content: "Hello",
		});
	}

	// Create a properly alternating sequence
	const alternatingMessages = [];

	// First add all system messages
	alternatingMessages.push(...systemMessages);

	// Then add alternating user/assistant messages
	let isUserTurn = true;

	for (const message of nonSystemMessages) {
		const expectedRole = isUserTurn ? "user" : "assistant";

		if (message.role === expectedRole) {
			alternatingMessages.push(message);
			isUserTurn = !isUserTurn;
		} else {
			// If the role doesn't match what we expect, insert a placeholder message
			alternatingMessages.push({
				role: expectedRole,
				content: expectedRole === "user" ? "Continue." : "I'll continue.",
			});
			alternatingMessages.push(message);
			isUserTurn = !isUserTurn;
		}
	}

	// Ensure the sequence ends with an assistant message if it ends with a user message
	if (alternatingMessages[alternatingMessages.length - 1].role !== "user") {
		alternatingMessages.push({
			role: "user",
			content: "Continue.",
		});
	}

	request.messages = alternatingMessages;
}
