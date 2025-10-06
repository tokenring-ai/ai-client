import {Agent} from "@tokenring-ai/agent";
import type {ChatInputMessage} from "../client/AIChatClient.ts";
import runChat from "../runChat.ts";
import {outputChatAnalytics} from "../util/outputChatAnalytics.ts";

export const description =
	"/chat [message] - Send a message to the chat service";

export async function execute(remainder: string, agent: Agent): Promise<void> {
	if (!remainder?.trim()) {
    agent.infoLine("Please enter a message to send to AI, or type /help for a list of the available commands.");
		return;
	}

	const currentInput: ChatInputMessage[] = [
		{ role: "user", content: remainder },
	];
	const [_output, response] = await runChat(
		{
			input: currentInput,
		},
		agent,
	);
	outputChatAnalytics(response, agent);
}

// noinspection JSUnusedGlobalSymbols
export function help(): string[] {
	return [
		"/chat [message]",
		"  - Sends a message to the chat service using current model and system prompt",
		"  - Displays token usage information after completion",
	];
}
