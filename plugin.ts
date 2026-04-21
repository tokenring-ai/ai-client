import type { TokenRingPlugin } from "@tokenring-ai/app";
import { RpcService } from "@tokenring-ai/rpc";
import { z } from "zod";
import {
  ChatModelRegistry,
  EmbeddingModelRegistry,
  ImageGenerationModelRegistry,
  RerankingModelRegistry,
  SpeechModelRegistry,
  TranscriptionModelRegistry,
  VideoGenerationModelRegistry,
} from "./ModelRegistry.ts";
import packageJSON from "./package.json" with { type: "json" };
import { registerProviders } from "./providers.ts";
import aiClientRPC from "./rpc/ai-client.ts";
import { AIClientConfigSchema, addDefaultProviders } from "./schema.ts";

const pluginConfigSchema = z.object({
  ai: AIClientConfigSchema.prefault({}),
});

export default {
  name: packageJSON.name,
  displayName: "AI Client",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, _config) {
    app.addServices(new ChatModelRegistry());
    app.addServices(new ImageGenerationModelRegistry());
    app.addServices(new EmbeddingModelRegistry());
    app.addServices(new SpeechModelRegistry());
    app.addServices(new TranscriptionModelRegistry());
    app.addServices(new RerankingModelRegistry());
    app.addServices(new VideoGenerationModelRegistry());

    app.waitForService(RpcService, rpcService => {
      rpcService.registerEndpoint(aiClientRPC);
    });
  },

  async start(app, config): Promise<void> {
    const providers = config.ai.providers;
    addDefaultProviders(providers);

    await registerProviders(providers, app);
  },
  config: pluginConfigSchema,
} satisfies TokenRingPlugin<typeof pluginConfigSchema>;
