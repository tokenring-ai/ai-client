import {xai} from "@ai-sdk/xai";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import type {ImageModelSpec} from "../client/AIImageGenerationClient.js";
import ModelRegistry, {ModelConfig} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

interface Model {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

interface ModelList {
  object: "list";
  data: Model[];
}

/**
 * The name of the AI provider.
 */
const providerName = "xAI";

export async function init(modelRegistry: ModelRegistry, config: ModelConfig) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for xAI provider.");
  }

  const getModels = cachedDataRetriever("https://api.x.ai/v1/models", {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  }) as () => Promise<ModelList | null>;


  const provider = config.provider || providerName;

  function generateModelSpec(modelId: string, modelSpec: Omit<Omit<Omit<ChatModelSpec, "isAvailable">, "provider">, "impl">): Record<string, ChatModelSpec> {
    return {
      [modelId]: {
        provider,
        impl: xai(modelId),
        async isAvailable() {
          const modelList = await getModels();
          return !!modelList?.data.some((model) => model.id === modelId);
        },
        ...modelSpec,
      },
    }
  }

  /**
   * A collection of xAI chat model specifications.
   * Each key is a model ID, and the value is a `ChatModelSpec` object.
   * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.ts).
   */
  const chatModels: Record<string, ChatModelSpec> = {
    ...generateModelSpec("grok-3", {
      costPerMillionInputTokens: 3,
      costPerMillionOutputTokens: 15.0,
      reasoningText: 5,
      intelligence: 5,
      tools: 5,
      speed: 2,
      contextLength: 131072,
    }),
    ...generateModelSpec("grok-3-mini", {
      costPerMillionInputTokens: 0.3,
      costPerMillionOutputTokens: 0.5,
      reasoningText: 4,
      intelligence: 4,
      tools: 4,
      speed: 3,
      contextLength: 131072,
    }),
    ...generateModelSpec("grok-4-0709", {
      costPerMillionInputTokens: 3,
      costPerMillionOutputTokens: 15.0,
      reasoningText: 6,
      intelligence: 6,
      tools: 6,
      speed: 3,
      contextLength: 256000,
    }),
  };

  modelRegistry.chat.registerAllModelSpecs(chatModels);


  /**
   * A collection of xAI image generation model specifications.
   * Each key is a model ID, and the value is an `ImageModelSpec` object.
   */
  const imageGenerationModels: Record<string, ImageModelSpec> = {
    "grok-2-image-1212": {
      provider,
      impl: xai.imageModel("grok-2-image-1212"),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some((model) => model.id === "grok-2-image-1212");
      },
      calculateImageCost(usage) {
        return 0.07; //TODO - this is a placeholder cost, need to figure out how to get the actual cost from the API
      },
      costPerMillionInputTokens: 0,
    },
  };

  modelRegistry.imageGeneration.registerAllModelSpecs(imageGenerationModels);
}
