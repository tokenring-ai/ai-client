import {TokenRingPackage} from "@tokenring-ai/agent";

import * as chatCommands from "./chatCommands.ts";
import packageJSON from './package.json' with {type: 'json'};

export const packageInfo: TokenRingPackage = {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  chatCommands: chatCommands,
};

export {default as ChatMessageStorage} from "./ChatMessageStorage.ts";
export {createChatRequest} from "./chatRequestBuilder/createChatRequest.ts";
export {default as EphemeralChatMessageStorage} from "./EphemeralChatMessageStorage.ts";
export {default as ModelRegistry} from "./ModelRegistry.ts";
