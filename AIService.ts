import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingService} from "@tokenring-ai/agent/types";
import {AIResponse, ChatRequest} from "./client/AIChatClient.js";
import {AIServiceState} from "./state/aiServiceState.js";


export type AIConfig = {
  systemPrompt: string|((agent: Agent) => string);
  forceModel?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  autoCompact?: boolean;
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
}

export default class AIService implements TokenRingService {
  name = "AIService";
  description = "A service for managing AI configuration";
  model: string;

  constructor(options: AIServiceOptions) {
    this.model = options.model;
  }

  async attach(agent: Agent): Promise<void> {
    agent.initializeState(AIServiceState, agent.options.ai);
  }

  /**
   * Set model for the current persona or global model
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
      state.currentConfig = {...state.currentConfig, ...aiConfig};
    })
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
      state.messages.push(message);
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
    })
  }

  /**
   * Restores the most recent message from history as the current message.
   * This provides undo functionality by popping the last message from the history stack.
   *
   */
  popMessage(agent: Agent): void {
    agent.mutateState(AIServiceState, (state) => {
      if (state.messages.length > 0) state.messages.pop();
    });
  }

}
