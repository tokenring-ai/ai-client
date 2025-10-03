import Agent from "@tokenring-ai/agent/Agent";
import { compactContext } from "../util/compactContext.js";

export const description =
	"/compact - Compact conversation context by summarizing prior messages";

export async function execute(remainder: string, agent: Agent): Promise<void> {
	agent.systemMessage("Compacting context...");
	await compactContext(agent);
}

export function help(): string[] {
	return [
		"/compact",
		"  - Compacts the conversation context by creating a summary of all prior messages",
		"  - Helps reduce token usage when conversations get long",
	];
}
