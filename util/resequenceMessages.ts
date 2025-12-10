import type {ChatInputMessage, ChatRequest} from "../client/AIChatClient.ts";

export function resequenceMessages(request: ChatRequest) {
  const {messages} = request;
  if (!messages || messages.length === 0) return;

  // First, combine consecutive messages from the same role
  const combinedMessages = messages.reduce(
    (acc: ChatInputMessage[], current: ChatInputMessage) => {
      if (acc.length === 0 || acc[acc.length - 1].role !== current.role) {
        // Add the message as is if it's the first one or has a different role from the previous one
        acc.push({...current});
      } else {
        // Combine with the previous message of the same role
        const lastMessage = acc[acc.length - 1];
        lastMessage.content = `${lastMessage.content}\n\n${current.content}`;
      }
      return acc;
    },
    [],
  );

  // Handle system messages separately as they can appear at the beginning
  const systemMessages = combinedMessages.filter(
    (msg: any) => msg.role === "system",
  );
  const nonSystemMessages = combinedMessages.filter(
    (msg: any) => msg.role !== "system",
  );

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

  // Ensure the sequence ends with an assistant message if it ends with a user message
  if (alternatingMessages[alternatingMessages.length - 1].role !== "user") {
    alternatingMessages.push({
      role: "user",
      content: "Continue.",
    });
  }

  request.messages = alternatingMessages;
  return;
}