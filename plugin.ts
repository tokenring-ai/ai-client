import type { TokenRingPlugin } from "@tokenring-ai/app";
import { RpcService } from "@tokenring-ai/rpc";
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
import { reconfigureProviders } from "./providers.ts";
import aiClientRPC from "./rpc/ai-client.ts";
import { AIPackageConfigSchema } from "./schema.server.ts";

export default {
  name: packageJSON.name,
  displayName: "AI Client",
  version: packageJSON.version,
  description: packageJSON.description,
  async install(app, config) {
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

    await reconfigureProviders(config, app);
  },
  config: AIPackageConfigSchema,
} satisfies TokenRingPlugin<typeof AIPackageConfigSchema>;
