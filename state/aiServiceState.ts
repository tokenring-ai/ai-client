import type {ResetWhat} from "@tokenring-ai/agent/AgentEvents";
import type {AgentStateSlice} from "@tokenring-ai/agent/types";
import async from "async";
import type {AIConfig, StoredChatMessage} from "../AIService.js";

export class AIServiceState implements AgentStateSlice {
	name = "AIServiceState";
	readonly initialConfig: AIConfig;
	currentConfig: AIConfig;
	parallelTools = false;

	async runToolMaybeInParallel(
		executeToolFunction: () => Promise<string | object>,
	): Promise<string | object> {
		if (this.parallelTools) {
			return await executeToolFunction();
		} else {
			return await this.toolQueue.push(executeToolFunction);
		}
	}

	toolQueue = async.queue(
		async (task: () => Promise<string | object>) => task(),
		1,
	);

	/** History of chat messages */
	messages: StoredChatMessage[] = [];

	constructor(initialConfig: AIConfig) {
		this.initialConfig = initialConfig;
		this.currentConfig = { ...initialConfig };
	}

	reset(what: ResetWhat[]): void {
		if (what.includes("settings")) {
			this.currentConfig = { ...this.initialConfig };
		}
		if (what.includes("chat")) {
			this.messages = [];
		}
	}

	serialize(): object {
		return {
			currentConfig: this.currentConfig,
			messages: this.messages,
		};
	}

	deserialize(data: any): void {
		this.currentConfig = data.currentConfig || { ...this.initialConfig };
		this.messages = data.messages || [];
	}

  show(): string[] {
    const lines = [
      `Messages: ${this.messages.length}`,
      `Enabled Tools: ${this.currentConfig.enabledTools?.join(", ") || "None"}`,
    ];
    if (this.currentConfig.temperature !== undefined) {
      lines.push(`Temperature: ${this.currentConfig.temperature}`);
    }
    if (this.currentConfig.maxTokens !== undefined) {
      lines.push(`Max Tokens: ${this.currentConfig.maxTokens}`);
    }
    return lines;
  }
}
