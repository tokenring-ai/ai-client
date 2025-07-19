export { default as ModelRegistry } from "./ModelRegistry.js";
export { default as ChatMessageStorage } from "./ChatMessageStorage.js";
export { default as EphemeralChatMessageStorage } from "./EphemeralChatMessageStorage.js";

export * as chatCommands from "./chatCommands.js";
export { createChatRequest } from "./chatRequestBuilder/createChatRequest.js";

export const name = "@token-ring/ai-client";
export const description =
	"Service that routes chat messages to different providers.";
export const version = "0.1.0";
