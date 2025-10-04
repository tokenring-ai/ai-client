import {perplexity} from "@ai-sdk/perplexity";
import {z} from "zod";
import type {ChatInputMessage, ChatModelSpec, ChatRequest,} from "../client/AIChatClient.ts";

import ModelRegistry from "../ModelRegistry.ts";

export const PerplexityModelProviderConfigSchema = z.object({
  apiKey: z.string()
});

export type PerplexityModelProviderConfig = z.infer<typeof PerplexityModelProviderConfigSchema>;

/**
 * Initializes the Perplexity AI provider and registers its chat models with the model agent.
 *
 */
export async function init(
  providerDisplayName: string,
	modelRegistry: ModelRegistry,
	config: PerplexityModelProviderConfig,
) {
	if (!config.apiKey) {
		throw new Error("No config.apiKey provided for Perplexity provider.");
	}

	function generateModelSpec(
		modelId: string,
		modelSpec: Omit<
			ChatModelSpec,
			| "isAvailable"
			| "provider"
			| "providerDisplayName"
			| "impl"
			| "mangleRequest"
			| "modelId"
		>,
	): ChatModelSpec {
		return {
			modelId,
      providerDisplayName: providerDisplayName,
			impl: perplexity(modelId),
			mangleRequest,
			async isAvailable() {
				return true;
			},
			...modelSpec,
		} as ChatModelSpec;
	}

	await modelRegistry.chat.registerAllModelSpecs([
		generateModelSpec("sonar", {
			costPerMillionInputTokens: 1,
			costPerMillionOutputTokens: 1,
			reasoningText: 2,
			intelligence: 3,
			tools: 3,
			speed: 2,
			webSearch: 1,
			contextLength: 128000,
		}),
		generateModelSpec("sonar-pro", {
			costPerMillionInputTokens: 3,
			costPerMillionOutputTokens: 15,
			reasoningText: 2,
			intelligence: 3,
			tools: 3,
			speed: 3,
			webSearch: 1,
			contextLength: 200000,
		}),
		generateModelSpec("sonar-reasoning", {
			costPerMillionInputTokens: 1,
			costPerMillionOutputTokens: 5,
			reasoningText: 3,
			intelligence: 3,
			tools: 3,
			speed: 2,
			webSearch: 1,
			contextLength: 128000,
		}),
		generateModelSpec("sonar-reasoning-pro", {
			costPerMillionInputTokens: 2,
			costPerMillionOutputTokens: 8,
			reasoningText: 4,
			intelligence: 4,
			tools: 4,
			speed: 2,
			webSearch: 1,
			contextLength: 128000,
		}),
		generateModelSpec("sonar-deep-research", {
			costPerMillionInputTokens: 2,
			costPerMillionOutputTokens: 8,
			costPerMillionReasoningTokens: 3,
			research: 3,
			reasoningText: 5,
			intelligence: 5,
			tools: 5,
			speed: 1,
			webSearch: 1,
			contextLength: 128000,
		}),
	]);
}

/**
 * Mangles OpenAI-style chat input messages to ensure they follow the required alternating pattern.
 * This function combines consecutive messages from the same role and ensures user/assistant roles alternate.
 */
function mangleRequest(request: ChatRequest): void {
	const { messages } = request;
	if (!messages || messages.length === 0) return;

	// First, combine consecutive messages from the same role
	const combinedMessages = messages.reduce(
		(acc: ChatInputMessage[], current: ChatInputMessage) => {
			if (acc.length === 0 || acc[acc.length - 1].role !== current.role) {
				// Add the message as is if it's the first one or has a different role from the previous one
				acc.push({ ...current });
			} else {
				// Combine with the previous message of the same role
				const lastMessage = acc[acc.length - 1];
				lastMessage.content = `${lastMessage.content}\n\n${current.content}`;
			}
			return acc;
		},
		[],
	);

	// Handle system messages separately as they can appear at the beginning
	const systemMessages = combinedMessages.filter(
		(msg: any) => msg.role === "system",
	);
	const nonSystemMessages = combinedMessages.filter(
		(msg: any) => msg.role !== "system",
	);

	// If there are no non-system messages, just return what we have
	if (nonSystemMessages.length === 0) {
		request.messages = combinedMessages;
		return undefined;
	}

	// Ensure the first non-system message is from the user
	if (nonSystemMessages[0].role !== "user") {
		nonSystemMessages.unshift({
			role: "user",
			content: "Hello",
		});
	}

	// Create a properly alternating sequence
	const alternatingMessages: ChatInputMessage[] = [];

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
	return;
}
