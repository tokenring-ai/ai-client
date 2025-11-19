import {AgentCommandService, AgentTeam, TokenRingPackage} from "@tokenring-ai/agent";

import * as chatCommands from "@tokenring-ai/chat/chatCommands";
import {z} from "zod";
import ModelRegistry from "./ModelRegistry.js";
import {ModelProviderConfigSchema, registerModels} from "./models.js";
import packageJSON from "./package.json" with {type: "json"};

export type {Tool, UserModelMessage} from "ai";
export {tool as chatTool, stepCountIs} from 'ai';

export const AIClientConfigSchema = z.object({
  models: z.record(z.string(), ModelProviderConfigSchema),
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  async install(agentTeam: AgentTeam) {
    agentTeam.waitForService(AgentCommandService, agentCommandService =>
      agentCommandService.addAgentCommands(chatCommands)
    );
    agentTeam.addServices(new ModelRegistry());

    const config = agentTeam.getConfigSlice("ai", AIClientConfigSchema);
    if (!config) return;
    await registerModels(
      config.models,
      agentTeam.requireService(ModelRegistry),
    );
  },
} as TokenRingPackage;

export {default as ModelRegistry} from "./ModelRegistry.ts";
export {default as ChatService} from "@tokenring-ai/chat/ChatService";