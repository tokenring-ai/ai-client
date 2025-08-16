import {Registry} from "@token-ring/registry";
import {ChatInputMessage} from "../client/AIChatClient.js";

/**
 * Adds attention items to the input messages for the chat request.
 * @param {Array} messages - The input messages array to modify.
 * @param {Object} registry - The registry instance.
 */
export async function addAttentionItems(messages: ChatInputMessage[], registry: Registry): Promise<void> {
  for await (const attentionItem of registry.services.getAttentionItems()) {
    messages.push(attentionItem);
  }
}