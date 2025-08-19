import ChatService from "@token-ring/chat/ChatService";
import {Registry} from "@token-ring/registry";
import {ChatInputMessage} from "../client/AIChatClient.js";
import * as runChat from "../runChat.js";

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

  const {inputTokens, cachedInputTokens, outputTokens, reasoningTokens, totalTokens} = response.usage;

  const usage = [
    `Input Tokens: ${inputTokens}${cachedInputTokens ? ` (+${cachedInputTokens} cached)` : ""}`,
    `Output: ${outputTokens}${reasoningTokens ? ` (+${reasoningTokens} reasoning)` : ""}`,
    `Total: ${totalTokens}`
  ];

  chatService.systemLine(`[Chat Complete] ${usage.join(', ')}`)

  const {input, cachedInput, output, reasoning, total} = response.cost;
  if (total) {
    const cost = [
      `Input Cost: \$${input ? input.toFixed(4) : 'unknown'}${cachedInput ? ` (+\$${cachedInput.toFixed(4)} cached)` : ""}`,
      `Output: \$${output ? output.toFixed(4) : 'unknown'}${reasoning ? ` (+\$${reasoning.toFixed(4)} reasoning)` : ""}`,
      `Total: \$${total.toFixed(4)}`
    ];


    chatService.systemLine(`[Chat Complete] ${cost.join(', ')}`)
  }

  const {elapsedMs, tokensPerSec} = response.timing;

  const seconds = (elapsedMs / 1000).toFixed(2);
  const tps = tokensPerSec ? tokensPerSec.toFixed(2) : "N/A";

  chatService.systemLine(
    `[Chat Complete] Time: ${seconds}s, Throughput: ${tps} tokens/sec`,
  );
}

// noinspection JSUnusedGlobalSymbols
export function help(): string[] {
  return [
    "/chat [message]",
    "  - Sends a message to the chat service using current model and system prompt",
    "  - Displays token usage information after completion",
  ];
}
