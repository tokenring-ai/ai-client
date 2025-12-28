import {TokenRingPlugin} from "@tokenring-ai/app";
import {z} from "zod";
import {AIClientConfigSchema} from "./index.ts";
import {
  ChatModelRegistry,
  EmbeddingModelRegistry,
  ImageGenerationModelRegistry, RerankingModelRegistry,
  SpeechModelRegistry,
  TranscriptionModelRegistry
} from "./ModelRegistry.ts";
import packageJSON from "./package.json" with {type: "json"};
import {registerProviders} from "./providers.js";

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
      await registerProviders(
        config.ai.providers,
        app
      );
    }
  },

  config: pluginConfigSchema
} satisfies TokenRingPlugin<typeof pluginConfigSchema>;
