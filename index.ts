import TokenRingApp from "@tokenring-ai/app"; 
import {AgentCommandService} from "@tokenring-ai/agent";

import * as chatCommands from "@tokenring-ai/chat/chatCommands";
import {TokenRingPlugin} from "@tokenring-ai/app";
import {z} from "zod";
import {
  ChatModelRegistry,
  EmbeddingModelRegistry,
  ImageGenerationModelRegistry,
  SpeechModelRegistry, TranscriptionModelRegistry
} from "./ModelRegistry.ts";
import {AIProviderConfigSchema, registerProviders} from "./providers.js";
import packageJSON from "./package.json" with {type: "json"};

export type {Tool, UserModelMessage} from "ai";
export {tool as chatTool, stepCountIs} from 'ai';

export const AIClientConfigSchema = z.object({
  providers: z.record(z.string(), AIProviderConfigSchema),
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  async install(app: TokenRingApp) {
    app.waitForService(AgentCommandService, agentCommandService =>
      agentCommandService.addAgentCommands(chatCommands)
    );
    app.addServices(new ChatModelRegistry());
    app.addServices(new ImageGenerationModelRegistry());
    app.addServices(new EmbeddingModelRegistry());
    app.addServices(new SpeechModelRegistry());
    app.addServices(new TranscriptionModelRegistry());

    const config = app.getConfigSlice("ai", AIClientConfigSchema);
    if (!config) return;
    await registerProviders(
      config.providers,
      app
    );
  },
} as TokenRingPlugin;

export {default as ChatService} from "@tokenring-ai/chat/ChatService";