import TokenRingApp, {TokenRingPlugin} from "@tokenring-ai/app";
import {z} from "zod";
import {
  ChatModelRegistry,
  EmbeddingModelRegistry,
  ImageGenerationModelRegistry,
  SpeechModelRegistry,
  TranscriptionModelRegistry
} from "./ModelRegistry.ts";
import packageJSON from "./package.json" with {type: "json"};
import {AIProviderConfigSchema, registerProviders} from "./providers.js";

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