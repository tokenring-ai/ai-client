import TokenRingApp from "@tokenring-ai/app";
import {createJsonRPCEndpoint} from "@tokenring-ai/web-host/jsonrpc/createJsonRPCEndpoint";
import {
  ChatModelRegistry,
  EmbeddingModelRegistry,
  ImageGenerationModelRegistry,
  RerankingModelRegistry,
  SpeechModelRegistry,
  TranscriptionModelRegistry
} from "../ModelRegistry.ts";
import AIClientRpcSchema from "./schema.ts";

export default createJsonRPCEndpoint(AIClientRpcSchema, {
  async listChatModels(args, app: TokenRingApp) {
    const registry = app.requireService(ChatModelRegistry);
    const models = await registry.getAllModelsWithOnlineStatus();
    return { models };
  },

  async listChatModelsByProvider(args, app: TokenRingApp) {
    const registry = app.requireService(ChatModelRegistry);
    const modelsByProvider = await registry.getModelsByProvider();
    return { modelsByProvider };
  },

  async listEmbeddingModels(args, app: TokenRingApp) {
    const registry = app.requireService(EmbeddingModelRegistry);
    const models = await registry.getAllModelsWithOnlineStatus();
    return { models };
  },

  async listEmbeddingModelsByProvider(args, app: TokenRingApp) {
    const registry = app.requireService(EmbeddingModelRegistry);
    const modelsByProvider = await registry.getModelsByProvider();
    return { modelsByProvider };
  },

  async listImageGenerationModels(args, app: TokenRingApp) {
    const registry = app.requireService(ImageGenerationModelRegistry);
    const models = await registry.getAllModelsWithOnlineStatus();
    return { models };
  },

  async listImageGenerationModelsByProvider(args, app: TokenRingApp) {
    const registry = app.requireService(ImageGenerationModelRegistry);
    const modelsByProvider = await registry.getModelsByProvider();
    return { modelsByProvider };
  },

  async listSpeechModels(args, app: TokenRingApp) {
    const registry = app.requireService(SpeechModelRegistry);
    const models = await registry.getAllModelsWithOnlineStatus();
    return { models };
  },

  async listSpeechModelsByProvider(args, app: TokenRingApp) {
    const registry = app.requireService(SpeechModelRegistry);
    const modelsByProvider = await registry.getModelsByProvider();
    return { modelsByProvider };
  },

  async listTranscriptionModels(args, app: TokenRingApp) {
    const registry = app.requireService(TranscriptionModelRegistry);
    const models = await registry.getAllModelsWithOnlineStatus();
    return { models };
  },

  async listTranscriptionModelsByProvider(args, app: TokenRingApp) {
    const registry = app.requireService(TranscriptionModelRegistry);
    const modelsByProvider = await registry.getModelsByProvider();
    return { modelsByProvider };
  },

  async listRerankingModels(args, app: TokenRingApp) {
    const registry = app.requireService(RerankingModelRegistry);
    const models = await registry.getAllModelsWithOnlineStatus();
    return { models };
  },

  async listRerankingModelsByProvider(args, app: TokenRingApp) {
    const registry = app.requireService(RerankingModelRegistry);
    const modelsByProvider = await registry.getModelsByProvider();
    return { modelsByProvider };
  }
});
