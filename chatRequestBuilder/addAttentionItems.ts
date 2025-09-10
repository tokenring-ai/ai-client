import Agent from "@tokenring-ai/agent/Agent";
import {ChatInputMessage} from "../client/AIChatClient.js";

/**
 * Adds attention items to the input messages for the chat request.
 */
export async function addAttentionItems(messages: ChatInputMessage[], agent: Agent): Promise<void> {
  for (const service of agent.team.services.getItems()) {
    if (service.getAttentionItems) {
      for await (const attentionItem of service.getAttentionItems(agent)) {
        messages.push(attentionItem);
      }
    }
  }
}