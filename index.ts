export { default as ChatMessageStorage } from "./ChatMessageStorage.ts";
export * as chatCommands from "./chatCommands.ts";
export { createChatRequest } from "./chatRequestBuilder/createChatRequest.ts";
export { default as EphemeralChatMessageStorage } from "./EphemeralChatMessageStorage.ts";
export { default as ModelRegistry } from "./ModelRegistry.ts";
export { default as runChat } from "./runChat.ts";

export const name = "@token-ring/ai-client";
export const description =
	"Service that routes chat messages to different providers.";
export const version = "0.1.0";
