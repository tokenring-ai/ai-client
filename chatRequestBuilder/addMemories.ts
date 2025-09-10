import Agent from "@tokenring-ai/agent/Agent";
import {ChatInputMessage} from "../client/AIChatClient.js";

/**
 * Adds memories to the input messages for the initial chat request.
 */
export async function addMemories(messages: ChatInputMessage[], agent: Agent): Promise<void> {
  /*
   * Memories are only included in first chat
   * // TODO: allow new memories to bubble to future chats
   */
  for (const service of agent.team.services.getItems()) {
    if (service.getMemories) {
      for await (const memory of service.getMemories(agent)) {
        if (memory.role === "system") {
          messages.splice(1, 0, memory);
        } else {
          messages.push(memory);
        }
      }
    }
  }
}