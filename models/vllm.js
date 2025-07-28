import cachedDataRetriever from "../util/cachedDataRetriever.js";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import fetch from "node-fetch";

const providerName = "VLLM";

export async function init(modelRegistry, config) {
	const { baseURL, apiKey, generateModelSpec } = config;
	if (!baseURL) {
		throw new Error("No config.baseURL provided for VLLM provider.");
	}
	if (!generateModelSpec) {
		throw new Error("No config.generateModelSpec provided for VLLM provider.");
	}

	const chatModelSpecs = {};
	const embeddingModelSpecs = {};

	const openai = createOpenAICompatible({
		baseURL,
		apiKey,
		compatibility: "strict",
	});

	const getModelList = cachedDataRetriever(baseURL + "/models", {
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

	for (let modelInfo of modelList.data) {
		const { type, capabilities = {} } = generateModelSpec(modelInfo);

		if (type === "chat") {
			chatModelSpecs[modelInfo.id] = {
				provider: config.provider ?? providerName,
				name: modelInfo.id,
				impl: openai.chatModel(modelInfo.id),
				isAvailable: () => getModelList().then((data) => !!data),
				isHot: () => true,
				//mangleRequest,
				...capabilities,
			};
		} else if (type === "embedding") {
			embeddingModelSpecs[modelInfo.model] = {
				provider: providerName,
				name: modelInfo.model,
				impl: openai.textEmbeddingModel(modelInfo.model),
				isAvailable: () => getModelList().then((data) => !!data),
				isHot: () => true,
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
function mangleRequest(request) {
	const { messages } = request;
	if (!messages || messages.length === 0) return;

	// First, combine consecutive messages from the same role
	const combinedMessages = messages.reduce((acc, current) => {
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
		(msg) => msg.role === "system",
	);
	const nonSystemMessages = combinedMessages.filter(
		(msg) => msg.role !== "system",
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
