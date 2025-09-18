import {AgentStateSlice} from "@tokenring-ai/agent/Agent";
import {ResetWhat} from "@tokenring-ai/agent/AgentEvents";
import {AIConfig, StoredChatMessage} from "../AIService.js";

export class AIServiceState implements AgentStateSlice {
  name = "AIServiceState";
  readonly initialConfig: AIConfig;
  currentConfig: AIConfig;

  /** History of chat messages */
  messages: StoredChatMessage[] = [];

  constructor(initialConfig: AIConfig) {
    this.initialConfig = initialConfig;
    this.currentConfig = {...initialConfig};
  }

  reset(what: ResetWhat[]): void {
    if (what.includes("settings")) {
      this.currentConfig = {...this.initialConfig};
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
    this.currentConfig = data.currentConfig || {...this.initialConfig};
    this.messages = data.messages || [];
  }
}