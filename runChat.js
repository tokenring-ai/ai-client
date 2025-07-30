import ChatService from "@token-ring/chat/ChatService";
import ChatMessageStorage from "./ChatMessageStorage.js";
import { createChatRequest } from "./chatRequestBuilder/createChatRequest.js";
import { ModelRegistry } from "./index.js";

/**
 * runChat tool: Runs a chat with the AI model, combining streamChat and runChat functionality.
 * @param {Object} args   Tool arguments: { content: string, instructions: string }
 * @param {string|ChatInput|ChatInput[]} args.input
 * @param {string|ChatInput} args.systemPrompt
 * @param {string} args.modelNameOrFilter - either a model name or a filter object
 * @param {TokenRingRegistry} registry - The package registry
 */
export default execute;
export async function execute({ input, systemPrompt, model }, registry) {
	const chatService = registry.requireFirstServiceByType(ChatService);
	const chatMessageStorage =
		registry.requireFirstServiceByType(ChatMessageStorage);
	const modelRegistry = registry.requireFirstServiceByType(ModelRegistry);

	if (!model) {
		throw new Error("[runChat] No model parameter received");
	}

	const currentMessage = chatMessageStorage.getCurrentMessage();
	const request = await createChatRequest({ input, systemPrompt }, registry);

	try {
		chatService.emit("waiting", "Waiting for an an online model to respond...");
		const client = await modelRegistry.chat.getFirstOnlineClient(model);
		chatService.emit("doneWaiting");

		if (!client) throw new Error(`No online client found for model ${model}`);

		chatService.systemLine(`[runChat] Using model ${client.getModelId()}`);

		// --- Timing start ---
		const startTime = Date.now();
		chatService.emit("waiting", "Waiting for response from AI...");
		const [output, response] = await client.streamChat(request, registry);
		chatService.emit("doneWaiting");
		const endTime = Date.now();
		// --- Timing end ---

		// Calculate timing and tokens/sec if possible
		const elapsedMs = endTime - startTime;
		let tokensPerSec = undefined;
		let totalTokens = undefined;
		if (response && response.usage) {
			totalTokens =
				response.usage.totalTokens ||
				(response.usage.promptTokens ?? 0) +
					(response.usage.completionTokens ?? 0);
			if (elapsedMs > 0 && response.usage.completionTokens > 0) {
				//totalTokens !== undefined) {
				tokensPerSec = response.usage.completionTokens / (elapsedMs / 1000);
			}
		}
		response.timing = {
			elapsedMs,
			tokensPerSec,
			totalTokens,
		};

		chatService.emit("doneWaiting");

		// Store the response object (now returned by streamChat)
		const chatMessage = chatMessageStorage.storeChat(
			currentMessage,
			request,
			response,
		);

		// Update the current message to follow up to the previous
		chatMessageStorage.setCurrentMessage(chatMessage);

		// Crop token cost to 4 decimal places if present
		if (response && response.tokenCost !== undefined) {
			response.tokenCost = Number(response.tokenCost.toFixed(4));
		}

		// Run afterChatComplete hooks for all enabled tools
		for (const tool of registry.tools.iterateActiveTools()) {
			if (tool?.afterChatComplete) {
				await tool.afterChatComplete(registry);
			}
		}

		// Run afterTestingComplete hooks for all enabled tools
		for (const tool of registry.tools.iterateActiveTools()) {
			if (tool?.afterTestingComplete) {
				await tool.afterTestingComplete(registry);
			}
		}

		return [output, response]; // Return the full response object
	} catch (err) {
		if (request) {
			chatMessageStorage.storeChat(currentMessage, request, {
				error: err.message,
			});
		}
		chatMessageStorage.setCurrentMessage(currentMessage);
		chatService.warningLine(
			"OpenAI response cancelled, restoring prior chat state.",
		);
		throw err;
	}
}

export const description =
	"Runs a chat with the AI model, combining streamChat and runChat functionality.";
export const parameters = {
	type: "object",
	properties: {
		input: {
			type: "array",
			description:
				"The message content to send to the chat. Can be a string or a properly formatted message array.",
		},
		systemPrompt: {
			type: "string",
			description: "System prompt to send to the AI.",
		},
		model: {
			type: "string",
			description: "AI Model to use",
		},
	},
	required: ["content", "systemPrompt"],
	additionalProperties: false,
};
