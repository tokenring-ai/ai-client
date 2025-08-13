import packageJSON from './package.json' with {type: 'json'};

export const name = packageJSON.name;
export const version = packageJSON.version;
export const description = packageJSON.description;

export { default as ChatMessageStorage } from "./ChatMessageStorage.ts";
export * as chatCommands from "./chatCommands.ts";
export { createChatRequest } from "./chatRequestBuilder/createChatRequest.ts";
export { default as EphemeralChatMessageStorage } from "./EphemeralChatMessageStorage.ts";
export { default as ModelRegistry } from "./ModelRegistry.ts";