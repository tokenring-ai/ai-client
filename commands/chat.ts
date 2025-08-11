import ChatService from "@token-ring/chat/ChatService";
import runChat from "../runChat.ts";

export const description = "/chat [message] - Send a message to the chat service";

export async function execute(remainder: any, registry: any): Promise<void> {
    const chatService = registry.requireFirstServiceByType(ChatService);

    if (!remainder?.trim()) {
        chatService.systemLine("Please provide a message to chat with");
        return;
    }

    const currentInput = [{ role: "user", content: remainder }];
    const [_output, response] = await runChat(
        {
            input: currentInput,
            systemPrompt: chatService.getInstructions(),
            model: chatService.getModel(),
        },
        registry,
    );

    if (response.usage) {
        const { promptTokens, completionTokens, totalTokens } = response.usage;
        const cost = response.tokenCost;
        chatService.systemLine(
            `[Chat Complete] Token usage - promptTokens: ${promptTokens}, completionTokens: ${completionTokens}, totalTokens: ${totalTokens}, cost: ${cost}`,
        );
        if (response.timing) {
            const { elapsedMs, tokensPerSec } = response.timing;
            const seconds = (elapsedMs / 1000).toFixed(2);
            const tps = tokensPerSec !== undefined ? tokensPerSec.toFixed(2) : "N/A";
            chatService.systemLine(
                `[Chat Complete] Time: ${seconds}s, Throughput: ${tps} tokens/sec`,
            );
        }
    } else {
        chatService.systemLine("[Chat Complete] Unknown token usage");
    }
}

export function help(): string[] {
    return [
        "/chat [message]",
        "  - Sends a message to the chat service using current model and system prompt",
        "  - Displays token usage information after completion",
    ];
}