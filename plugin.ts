import {TokenRingPlugin} from "@tokenring-ai/app";
import {RpcService} from "@tokenring-ai/rpc";
import {WebHostService} from "@tokenring-ai/web-host";
import JsonRpcResource from "@tokenring-ai/web-host/JsonRpcResource";
import {z} from "zod";
import autoConfig from "./autoConfig.ts";
import {
  ChatModelRegistry,
  EmbeddingModelRegistry,
  ImageGenerationModelRegistry,
  RerankingModelRegistry,
  SpeechModelRegistry,
  TranscriptionModelRegistry
} from "./ModelRegistry.ts";
import packageJSON from "./package.json" with {type: "json"};
import {registerProviders} from "./providers.js";
import aiClientRPC from "./rpc/ai-client.ts";
import {AIClientConfigSchema} from "./schema.ts";

const pluginConfigSchema = z.object({
  ai: AIClientConfigSchema.prefault({})
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    app.addServices(new ChatModelRegistry());
    app.addServices(new ImageGenerationModelRegistry());
    app.addServices(new EmbeddingModelRegistry());
    app.addServices(new SpeechModelRegistry());
    app.addServices(new TranscriptionModelRegistry());
    app.addServices(new RerankingModelRegistry());

    let providerConfig = config.ai.providers;
    if (config.ai.autoConfigure || !providerConfig) {
      providerConfig = autoConfig()
    }

    app.waitForService(RpcService, rpcService => {
      rpcService.registerEndpoint(aiClientRPC);
    });
  },

  async start(app, config): Promise<void> {
    let providerConfig = config.ai.providers;
    if (config.ai.autoConfigure || !providerConfig) {
      providerConfig = autoConfig()
    }

    await registerProviders(
      providerConfig,
      app
    );
  },

  config: pluginConfigSchema
} satisfies TokenRingPlugin<typeof pluginConfigSchema>;
