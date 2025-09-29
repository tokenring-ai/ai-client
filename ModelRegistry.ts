import {TokenRingService} from "@tokenring-ai/agent/types";
import AIChatClient from "./client/AIChatClient.js";
import AIEmbeddingClient from "./client/AIEmbeddingClient.js";
import AIImageGenerationClient from "./client/AIImageGenerationClient.js";
import {ModelTypeRegistry} from "./ModelTypeRegistry.js";


export interface ModelProviderInfo {
  /**
   * The display name of the model provider
   */
  providerDisplayName: string;
}

export type ModelProvider = {
  init: (registry: ModelRegistry, config: ModelProviderInfo) => Promise<void>;
};

export type ModelNameRequirements = {
  /**
   * The model name to match
   */
  model?: string;
};

export type ChatModelRequirements = {
  /**
   * The model name to match against the model specification
   */
  name?: string;
  /**
   * The model provider code, or 'auto' or undefined for any provider
   */
  provider?: string;
  /**
   * The model provider code, or 'auto' or undefined for any provider
   */
  providerDisplayName?: string;
  /**
   * Maximum context length in tokens the model allows
   */
  contextLength?: number;
  /**
   * Maximum output tokens the model allows
   */
  maxCompletionTokens?: number;
  /**
   * Research ability (0-infinity)
   */
  research?: number;
  /**
   * Reasoning capability score (0-infinity)
   */
  reasoningText?: number;
  /**
   * Intelligence capability score (0-infinity)
   */
  intelligence?: number;
  /**
   * Speed capability score (0-infinity)
   */
  speed?: number;
  /**
   * Web search capability score (0-infinity)
   */
  webSearch?: number;
};

/**
 * Class for automatically routing chat requests to the most appropriate model
 * based on specific requirements
 */
export default class ModelRegistry implements TokenRingService {
  name = "ModelRegistry";
  description = "Provides a registry of AI Models";

  chat = new ModelTypeRegistry(AIChatClient);
  embedding = new ModelTypeRegistry(AIEmbeddingClient);
  imageGeneration = new ModelTypeRegistry(AIImageGenerationClient);

  /**
   * Registers a key: value object of model specs
   */
  async initializeModels(
    providers: Record<string, ModelProvider>,
    config: Record<string, ModelProviderInfo | ModelProviderInfo[]>
  ): Promise<void> {
    for (const providerCode in config) {
      const providerConfig = config[providerCode];
      if (typeof providerConfig !== "object") {
        throw new Error(
          `Invalid model provider configuration for '${providerCode}': config must be an object`
        );
      }

      const providerImpl = providers[providerCode];
      if (!providerImpl) {
        throw new Error(
          `Invalid model provider configuration for '${providerCode}': unknown provider '${providerCode}'`
        );
      }

      for (const item of Array.isArray(providerConfig) ? providerConfig : [providerConfig]) {
        await providerImpl.init(this, item);
      }
    }
  }
}