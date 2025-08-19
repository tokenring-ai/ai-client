import ChatService from "@token-ring/chat/ChatService";
import {Registry} from "@token-ring/registry";
import {ChatInputMessage} from "../client/AIChatClient.js";
import * as runChat from "../runChat.js";
import {outputChatAnalytics} from "../util/outputChatAnalytics.js";

export const description = "/chat [message] - Send a message to the chat service";

export async function execute(remainder: string, registry: Registry): Promise<void> {
  const chatService = registry.requireFirstServiceByType(ChatService);

  if (!remainder?.trim()) {
    chatService.systemLine("Please provide a message to chat with");
    return;
  }

  const currentInput: ChatInputMessage[] = [{role: "user", content: remainder}];
  const [_output, response] = await runChat.execute(
    {
      input: currentInput,
      systemPrompt: chatService.getInstructions(),
      model: chatService.getModel(),
    },
    registry,
  );
  outputChatAnalytics(response, chatService);
}

// noinspection JSUnusedGlobalSymbols
export function help(): string[] {
  return [
    "/chat [message]",
    "  - Sends a message to the chat service using current model and system prompt",
    "  - Displays token usage information after completion",
  ];
}
