import Agent from "@tokenring-ai/agent/Agent";
import type {TokenRingService} from "@tokenring-ai/agent/types";
import KeyedRegistry from "@tokenring-ai/utility/KeyedRegistry";
import type {Tool} from "ai";
import type {AIResponse, ChatRequest} from "./client/AIChatClient.js";
import {AIServiceState} from "./state/aiServiceState.js";
import {tokenRingTool} from "./util/tokenRingTool.js";

export type AITool = Tool;

export type NamedTool = {
  name: string;
  tool: AITool;
};
export type AIConfig = {
	systemPrompt: string | ((agent: Agent) => string);
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	topK?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	stopSequences?: string[];
	autoCompact?: boolean;
  enabledTools?: string[];
};

/**
 * Represents a chat message in the storage system
 */
export interface StoredChatMessage {
	/** The AI request */
	request: ChatRequest;
	/** The response from AI */
	response: AIResponse;
	/** The creation time in milliseconds since the epoch format */
	createdAt: number;
	/** The update time in milliseconds since the epoch format */
	updatedAt: number;
}

export type AIServiceOptions = {
	model: string;
};

export type TokenRingToolDefinition = {
  name: string;
  description: string;
  execute: (input: object, agent: Agent) => Promise<string | object>;
  inputSchema: AITool["inputSchema"];
  start?: (agent: Agent) => Promise<void>;
  stop?: (agent: Agent) => Promise<void>;
};
export type TokenRingTool = {
  packageName: string;
} & TokenRingToolDefinition;
export default class AIService implements TokenRingService {
	name = "AIService";
	description = "A service for managing AI configuration";
	model: string;


  private tools = new KeyedRegistry<NamedTool>();

  requireTool = this.tools.requireItemByName;
  registerTool = this.tools.register;
  getAvailableToolNames = this.tools.getAllItemNames;

  getToolNamesLike = this.tools.getItemNamesLike;
  ensureToolNamesLike = this.tools.ensureItemNamesLike;

  constructor(options: AIServiceOptions) {
		this.model = options.model;
	}

	async attach(agent: Agent): Promise<void> {
		agent.initializeState(AIServiceState, agent.options.ai);
	}


  addTools(
    pkgName: string,
    tools: Record<string, TokenRingToolDefinition>,
  ) {
    for (const toolName in tools) {
      const fullName = `${pkgName}/${toolName}`;

      // Check for duplicate tool registration
      if (this.tools.getItemByName(fullName)) {
        throw new Error(`Tool "${fullName}" is already registered`);
      }

      this.tools.register(
        fullName,
        tokenRingTool({...tools[toolName]}),
      );
    }
  }

  /**
	 * Set model for the current agent
	 */
	setModel(model: string): void {
		this.model = model;
	}
	getModel(): string {
		return this.model;
	}

	getAIConfig(agent: Agent): AIConfig {
		return agent.getState(AIServiceState).currentConfig;
	}

	updateAIConfig(aiConfig: Partial<AIConfig>, agent: Agent): void {
		agent.mutateState(AIServiceState, (state) => {
			state.currentConfig = { ...state.currentConfig, ...aiConfig };
		});
	}

	/**
	 * Gets the chat messages.
	 */
	getChatMessages(agent: Agent): StoredChatMessage[] {
		return agent.getState(AIServiceState).messages;
	}

	/**
	 * Gets the current active message.
	 */
	getCurrentMessage(agent: Agent): StoredChatMessage | null {
		const messages = this.getChatMessages(agent);
		if (messages.length > 0) {
			return messages[messages.length - 1];
		}
		return null;
	}

	/**
	 * Pushes a message onto the chat history, moving the previous current message to history if it exists.
	 * This allows for maintaining a stack of messages for undo/redo operations.
	 *
	 */
	pushChatMessage(message: StoredChatMessage, agent: Agent): void {
		agent.mutateState(AIServiceState, (state) => {
			state.messages = [...state.messages, message];
		});
	}

	/**
	 * Clears all chat messages from the given agent's state.
	 *
	 * @param {Agent} agent - The agent instance whose chat messages will be cleared.
	 * @return {void} This method does not return a value.
	 */
	clearChatMessages(agent: Agent): void {
		agent.mutateState(AIServiceState, (state) => {
			state.messages = [];
		});
	}

	/**
	 * Restores the most recent message from history as the current message.
	 * This provides undo functionality by popping the last message from the history stack.
	 *
	 */
	popMessage(agent: Agent): void {
		agent.mutateState(AIServiceState, (state) => {
			if (state.messages.length > 0) {
				state.messages = state.messages.slice(0, state.messages.length - 1);
			}
		});
	}

  getEnabledTools(agent: Agent): string[] {
    return agent.getState(AIServiceState).currentConfig.enabledTools ?? [];
  }

  setEnabledTools(toolNames: string[], agent: Agent): void {
    this.tools.ensureItems(toolNames);

    agent.mutateState(AIServiceState, (state) => {
      state.currentConfig.enabledTools = toolNames;
    })
  }

  enableTools(toolNames: string[], agent: Agent): void {
    this.tools.ensureItems(toolNames);

    agent.mutateState(AIServiceState, (state) => {
      state.currentConfig.enabledTools ??= [];
      for (const tool of toolNames) {
        if (!state.currentConfig.enabledTools.includes(tool)) {
          state.currentConfig.enabledTools.push(tool);
        }
      }
    })
  }

  disableTools(toolNames: string[], agent: Agent): void {
    this.tools.ensureItems(toolNames);
    agent.mutateState(AIServiceState, (state) => {
      state.currentConfig.enabledTools = (state.currentConfig.enabledTools ?? [])
        .filter((tool) =>
          toolNames.includes(tool)
        )
    });
  }
}
