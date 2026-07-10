import type { LanguageModelV4CallOptions, LanguageModelV4Message, LanguageModelV4Middleware } from "@ai-sdk/provider";

export const strictMessageOrderMiddleware: LanguageModelV4Middleware = {
  specificationVersion: "v4",
  transformParams({ params }) {
    return Promise.resolve({
      ...params,
      prompt: resequenceMessages(params.prompt),
    });
  },
};

export function resequenceMessages(messages: LanguageModelV4CallOptions["prompt"]) {
  if (messages.length === 0) return messages;

  const combinedMessages = messages.reduce((acc: LanguageModelV4Message[], current) => {
    const lastMessage = acc.length === 0 ? null : acc[acc.length - 1];
    if (lastMessage?.role === "user" && current.role === "user") {
      lastMessage.content = [...lastMessage.content, ...current.content];
    } else {
      acc.push({ ...current });
    }
    return acc;
  }, []);

  // If there are no non-system messages, just return what we have
  if (!combinedMessages[0]) return combinedMessages;

  // Ensure the first non-system message is from the user
  if (combinedMessages[0].role !== "user") {
    combinedMessages.unshift({
      role: "user",
      content: [
        {
          type: "text",
          text: "Hello",
        },
      ],
    });
  }

  // Create a properly alternating sequence
  const alternatingMessages: LanguageModelV4Message[] = [];

  // Then add alternating user/assistant messages
  let isUserTurn = true;

  for (const message of combinedMessages) {
    const expectedRole = isUserTurn ? "user" : "assistant";

    if (message.role === expectedRole) {
      alternatingMessages.push(message);
      isUserTurn = !isUserTurn;
    } else {
      // If the role doesn't match what we expect, insert a placeholder message
      alternatingMessages.push({
        role: expectedRole,
        content: [
          {
            type: "text",
            text: expectedRole === "user" ? "Continue." : "I'll continue.",
          },
        ],
      });
      alternatingMessages.push(message);
      isUserTurn = !isUserTurn;
    }
  }

  // Ensure the sequence ends with an user message if it ends with another type of message
  if (alternatingMessages[alternatingMessages.length - 1]!.role !== "user") {
    alternatingMessages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: "Continue.",
        },
      ],
    });
  }

  return alternatingMessages;
}
