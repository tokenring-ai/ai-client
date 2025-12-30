import {TokenRingPlugin} from "@tokenring-ai/app";
import {z} from "zod";
import autoConfig from "./autoConfig.ts";
import {
  ChatModelRegistry,
  EmbeddingModelRegistry,
  ImageGenerationModelRegistry, RerankingModelRegistry,
  SpeechModelRegistry,
  TranscriptionModelRegistry
} from "./ModelRegistry.ts";
import packageJSON from "./package.json" with {type: "json"};
import {registerProviders} from "./providers.js";
import {AIClientConfigSchema} from "./schema.ts";

const pluginConfigSchema = z.object({
  ai: AIClientConfigSchema.optional(),
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  async install(app, config) {
    app.addServices(new ChatModelRegistry());
    app.addServices(new ImageGenerationModelRegistry());
    app.addServices(new EmbeddingModelRegistry());
    app.addServices(new SpeechModelRegistry());
    app.addServices(new TranscriptionModelRegistry());
    app.addServices(new RerankingModelRegistry());

    if (config.ai) {
      let providerConfig = config.ai.providers;
      if (config.ai.autoConfigure || !providerConfig) {
        providerConfig = autoConfig()
      }

      await registerProviders(
        providerConfig,
        app
      );
    }
  },

  config: pluginConfigSchema
} satisfies TokenRingPlugin<typeof pluginConfigSchema>;
