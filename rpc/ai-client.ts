import type TokenRingApp from "@tokenring-ai/app";
import {createRPCEndpoint} from "@tokenring-ai/rpc/createRPCEndpoint";
import {
  ChatModelRegistry,
  EmbeddingModelRegistry,
  ImageGenerationModelRegistry,
  RerankingModelRegistry,
  SpeechModelRegistry,
  TranscriptionModelRegistry,
} from "../ModelRegistry.ts";
import AIClientRpcSchema from "./schema.ts";

export default createRPCEndpoint(AIClientRpcSchema, {
  async listChatModels(_args, app: TokenRingApp) {
    const registry = app.requireService(ChatModelRegistry);
    const models = await registry.getAllModelsWithOnlineStatus();
    return {models};
  },

  async listChatModelsByProvider(_args, app: TokenRingApp) {
    const registry = app.requireService(ChatModelRegistry);
    const modelsByProvider = await registry.getModelsByProvider();
    return {modelsByProvider};
  },

  async listEmbeddingModels(_args, app: TokenRingApp) {
    const registry = app.requireService(EmbeddingModelRegistry);
    const models = await registry.getAllModelsWithOnlineStatus();
    return {models};
  },

  async listEmbeddingModelsByProvider(_args, app: TokenRingApp) {
    const registry = app.requireService(EmbeddingModelRegistry);
    const modelsByProvider = await registry.getModelsByProvider();
    return {modelsByProvider};
  },

  async listImageGenerationModels(_args, app: TokenRingApp) {
    const registry = app.requireService(ImageGenerationModelRegistry);
    const models = await registry.getAllModelsWithOnlineStatus();
    return {models};
  },

  async listImageGenerationModelsByProvider(_args, app: TokenRingApp) {
    const registry = app.requireService(ImageGenerationModelRegistry);
    const modelsByProvider = await registry.getModelsByProvider();
    return {modelsByProvider};
  },

  async listSpeechModels(_args, app: TokenRingApp) {
    const registry = app.requireService(SpeechModelRegistry);
    const models = await registry.getAllModelsWithOnlineStatus();
    return {models};
  },

  async listSpeechModelsByProvider(_args, app: TokenRingApp) {
    const registry = app.requireService(SpeechModelRegistry);
    const modelsByProvider = await registry.getModelsByProvider();
    return {modelsByProvider};
  },

  async listTranscriptionModels(_args, app: TokenRingApp) {
    const registry = app.requireService(TranscriptionModelRegistry);
    const models = await registry.getAllModelsWithOnlineStatus();
    return {models};
  },

  async listTranscriptionModelsByProvider(_args, app: TokenRingApp) {
    const registry = app.requireService(TranscriptionModelRegistry);
    const modelsByProvider = await registry.getModelsByProvider();
    return {modelsByProvider};
  },

  async listRerankingModels(_args, app: TokenRingApp) {
    const registry = app.requireService(RerankingModelRegistry);
    const models = await registry.getAllModelsWithOnlineStatus();
    return {models};
  },

  async listRerankingModelsByProvider(_args, app: TokenRingApp) {
    const registry = app.requireService(RerankingModelRegistry);
    const modelsByProvider = await registry.getModelsByProvider();
    return {modelsByProvider};
  },
});
