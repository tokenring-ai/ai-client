import TokenRingApp, {TokenRingPlugin} from "@tokenring-ai/app";
import {AIClientConfigSchema} from "./index.ts";
import {
  ChatModelRegistry,
  EmbeddingModelRegistry,
  ImageGenerationModelRegistry,
  SpeechModelRegistry,
  TranscriptionModelRegistry
} from "./ModelRegistry.ts";
import packageJSON from "./package.json" with {type: "json"};
import {registerProviders} from "./providers.js";


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
} satisfies TokenRingPlugin;
