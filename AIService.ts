import Agent, {AgentStateSlice} from "@tokenring-ai/agent/Agent";
import {ResetWhat} from "@tokenring-ai/agent/AgentEvents";
import {TokenRingService} from "@tokenring-ai/agent/types";


export type AIConfig = {
  systemPrompt: string;
  forceModel?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
};

class AIServiceState implements AgentStateSlice {
  readonly initialConfig: AIConfig;
  currentConfig: AIConfig;

  constructor(initialConfig: AIConfig) {
    this.initialConfig = initialConfig;
    this.currentConfig = {...initialConfig};
  }

  reset(what: ResetWhat[]): void {
    if (what.includes("settings")) {
      this.currentConfig = {...this.initialConfig};
    }
  }
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
}
