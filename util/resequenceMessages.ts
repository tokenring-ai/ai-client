import type { ChatInputMessage, ChatRequest } from "../client/AIChatClient.ts";
import type { TextPart } from "../schema.ts";

export function resequenceMessages(request: ChatRequest) {
  const { messages } = request;
  if (!messages || messages.length === 0) return;

  const combinedMessages = messages.reduce((acc: ChatInputMessage[], current: ChatInputMessage) => {
    const lastMessage = acc.length === 0 ? null : acc[acc.length - 1];
    if (lastMessage?.role === "user" && current.role === "user") {
      lastMessage.content = [
        ...(Array.isArray(lastMessage.content) ? lastMessage.content : [{ type: "text", text: lastMessage.content } satisfies TextPart]),
        ...(Array.isArray(current.content) ? current.content : [{ type: "text", text: current.content } satisfies TextPart]),
      ];
    } else {
      acc.push({ ...current });
    }
    return acc;
  }, []);

  // Handle system messages separately as they can appear at the beginning
  const systemMessages = combinedMessages.filter((msg): msg is Extract<ChatInputMessage, { role: "system" }> => msg.role === "system");
  const nonSystemMessages = combinedMessages.filter((msg): msg is Exclude<ChatInputMessage, { role: "system" }> => msg.role !== "system");

  // If there are no non-system messages, just return what we have
  if (nonSystemMessages.length === 0) {
    request.messages = combinedMessages;
    return undefined;
  }

  // Ensure the first non-system message is from the user
  if (nonSystemMessages[0].role !== "user") {
    nonSystemMessages.unshift({
      role: "user",
      content: "Hello",
    });
  }

  // Create a properly alternating sequence
  const alternatingMessages: ChatInputMessage[] = [];

  // First add all system messages
  alternatingMessages.push(...systemMessages);

  // Then add alternating user/assistant messages
  let isUserTurn = true;

  for (const message of nonSystemMessages) {
    const expectedRole = isUserTurn ? "user" : "assistant";

    if (message.role === expectedRole) {
      alternatingMessages.push(message);
      isUserTurn = !isUserTurn;
    } else {
      // If the role doesn't match what we expect, insert a placeholder message
      alternatingMessages.push({
        role: expectedRole,
        content: expectedRole === "user" ? "Continue." : "I'll continue.",
      });
      alternatingMessages.push(message);
      isUserTurn = !isUserTurn;
    }
  }

  // Ensure the sequence ends with an user message if it ends with another type of message
  if (alternatingMessages[alternatingMessages.length - 1].role !== "user") {
    alternatingMessages.push({
      role: "user",
      content: "Continue.",
    });
  }

  request.messages = alternatingMessages;
  return;
}
