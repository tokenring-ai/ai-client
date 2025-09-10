import Agent from "@tokenring-ai/agent/Agent";
import {AIResponse} from "../client/AIChatClient.js";

export function outputChatAnalytics(response: AIResponse, agent: Agent, pkgName: string = "Chat Complete") {
  const {inputTokens, cachedInputTokens, outputTokens, reasoningTokens, totalTokens} = response.usage;

  const usage = [
    `Input Tokens: ${inputTokens}${cachedInputTokens ? ` (+${cachedInputTokens} cached)` : ""}`,
    `Output: ${outputTokens}${reasoningTokens ? ` (+${reasoningTokens} reasoning)` : ""}`,
    `Total: ${totalTokens}`
  ];

  agent.infoLine(`[${pkgName}] ${usage.join(', ')}`)

  const {input, cachedInput, output, reasoning, total} = response.cost;
  if (total) {
    const cost = [
      `Input Cost: \$${input ? input.toFixed(4) : 'unknown'}${cachedInput ? ` (+\$${cachedInput.toFixed(4)} cached)` : ""}`,
      `Output: \$${output ? output.toFixed(4) : 'unknown'}${reasoning ? ` (+\$${reasoning.toFixed(4)} reasoning)` : ""}`,
      `Total: \$${total.toFixed(4)}`
    ];


    agent.infoLine(`[${pkgName}] ${cost.join(', ')}`)
  }

  const {elapsedMs, tokensPerSec} = response.timing;

  const seconds = (elapsedMs / 1000).toFixed(2);
  const tps = tokensPerSec ? tokensPerSec.toFixed(2) : "N/A";

  agent.infoLine(
    `[${pkgName}] Time: ${seconds}s, Throughput: ${tps} tokens/sec`,
  );
}