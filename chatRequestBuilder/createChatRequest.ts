import Agent from "@tokenring-ai/agent/Agent";
import { stepCountIs, type UserModelMessage } from "ai";
import AIService, { type AIConfig } from "../AIService.js";
import type { ChatInputMessage, ChatRequest } from "../client/AIChatClient.js";

export interface ChatRequestConfig {
	input: string | ChatInputMessage | ChatInputMessage[];
	systemPrompt: AIConfig["systemPrompt"];
	includeContextItems?: boolean;
	includeTools?: boolean;
	includePriorMessages?: boolean;
	maxSteps?: number;
	temperature?: number;
	topP?: number;
	topK?: number;
	stopSequences?: string[];
	presencePenalty?: number;
	frequencyPenalty?: number;
}

/**
 * Creates a chat request object.
 */
export async function createChatRequest(
	{
		input,
		systemPrompt,
		includeContextItems = true,
		includeTools = true,
		includePriorMessages = true,
		maxSteps = 15,
		temperature,
		topP,
		topK,
		stopSequences,
		presencePenalty,
		frequencyPenalty,
	}: ChatRequestConfig,
	agent: Agent,
): Promise<ChatRequest> {
	const aiService = agent.requireServiceByType(AIService);
	const lastMessage = aiService.getCurrentMessage(agent);

	let currentMessages: ChatInputMessage[];

	if (typeof input === "string") {
		currentMessages = [
			{
				role: "user",
				content: input,
			},
		];
	} else if (!Array.isArray(input)) {
		currentMessages = [input];
	} else {
		currentMessages = input;
	}

	if (!(currentMessages?.length > 0)) {
		throw new Error(
			"The input: parameter must be either a single item or an array with a length greater than 0",
		);
	}

	if (typeof systemPrompt === "function") {
		systemPrompt = systemPrompt(agent);
	}

	let systemMessages: ChatInputMessage[] = [
		{
			role: "system",
			content: systemPrompt,
		},
	];

	let priorMessages: ChatInputMessage[] = [];

	if (includePriorMessages && lastMessage) {
		if (lastMessage.request.messages[0]?.role === "system") {
			systemMessages = [lastMessage.request.messages[0]];
			priorMessages = lastMessage.request.messages.slice(1);
		} else {
			priorMessages = [...lastMessage.request.messages];
		}

		// Add the AI response to maintain conversation context
		if (lastMessage.response.messages?.length) {
			priorMessages.push(...lastMessage.response.messages);
		}
	}

	if (includeContextItems) {
		for (const service of agent.team.services.getItems()) {
			if (!service.getContextItems) continue;
			for await (const { content, position } of service.getContextItems(
				agent,
			)) {
				const message = { role: "user", content } as UserModelMessage;

				if (position === "afterSystemMessage") {
					if (
						priorMessages.find(
							(el) => el.role === "user" && el.content === content,
						)
					)
						continue;
					systemMessages.push(message);
				} else if (position === "afterPriorMessages") {
					if (
						priorMessages.find(
							(el) => el.role === "user" && el.content === content,
						)
					)
						continue;
					priorMessages.push(message);
				} else if (position === "afterCurrentMessage") {
					currentMessages.push(message);
				}
			}
		}
	}

	const request: ChatRequest = {
		messages: [...systemMessages, ...priorMessages, ...currentMessages],
		tools: {},
		stopWhen: stepCountIs(maxSteps),
		temperature,
		topP,
		topK,
		stopSequences,
		presencePenalty,
		frequencyPenalty,
	};

	if (includeTools) {
		for (const namedTool of Object.values(agent.tools.getActiveItemEntries())) {
			const sanitizedName = namedTool.name.replace(/[^a-zA-Z0-9_-]/g, "_");
			request.tools[sanitizedName] = namedTool.tool;
		}
	}

	return request;
}
