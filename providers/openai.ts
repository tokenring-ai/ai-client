import {createOpenAI} from "@ai-sdk/openai";
import type {ChatModelSpec, ChatRequest} from "../client/AIChatClient.ts";
import type {ImageModelSpec, ImageRequest} from "../client/AIImageGenerationClient.ts";
import ModelRegistry, {ModelProviderInfo} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

type ModelListData = {
  id: string,
  object: "model",
  owned_by: "organization" | "openai",
  created: number,
}

type ModelList = {
  object: "list",
  data: ModelListData[],
}

/**
 * The name of the AI provider.
 */
const providerName = "OpenAI";

export interface OpenAIModelProviderConfig extends ModelProviderInfo {
  apiKey: string;
}

export async function init(modelRegistry: ModelRegistry, config: OpenAIModelProviderConfig) {
  let {apiKey} = config;
  if (!apiKey) {
    throw new Error("No config.apiKey provided for OpenAI provider.");
  }

  const openai = createOpenAI({apiKey});

  const getModels = cachedDataRetriever(`https://api.openai.com/v1/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  }) as () => Promise<ModelList | null>;


  function generateModelSpec(modelId: string, modelSpec: Omit<ChatModelSpec, "isAvailable" | "provider" | "providerDisplayName" | "impl">): Record<string, ChatModelSpec> {
    return {
      [modelId]: {
        providerDisplayName: config.providerDisplayName,
        impl: openai(modelId),
        async isAvailable() {
          const modelList = await getModels();
          return !!modelList?.data.some((model) => model.id === modelId);
        },
        ...modelSpec,
      },
    }
  }


  function generateImageModelSpec(modelId: string, variantId: string, modelSpec: Omit<ImageModelSpec, "isAvailable" | "provider" | "providerDisplayName" | "impl">): Record<string, ImageModelSpec> {
    return {
      [variantId]: {
        providerDisplayName: config.providerDisplayName,
        impl: openai.imageModel(modelId),
        async isAvailable() {
          const modelList = await getModels();
          return !!modelList?.data.some((model) => model.id === modelId);
        },
        ...modelSpec,
      },
    }
  }

  /**
   * A collection of OpenAI chat model specifications.
   * Each key is a model ID, and the value is a `ChatModelSpec` object.
   * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.ts).
   */
  const chatModels: Record<string, ChatModelSpec> = {
    ...generateModelSpec("gpt-4.1", {
      costPerMillionInputTokens: 2.0,
      costPerMillionOutputTokens: 8.0,
      costPerMillionCachedInputTokens: 0.50,
      reasoningText: 3,
      intelligence: 5,
      tools: 5,
      speed: 3,
      contextLength: 1000000,
    }),
    ...generateModelSpec("gpt-4.1-mini", {
      costPerMillionInputTokens: 0.4,
      costPerMillionOutputTokens: 1.6,
      costPerMillionCachedInputTokens: 0.10,
      reasoningText: 2,
      intelligence: 4,
      tools: 4,
      speed: 4,
      contextLength: 1000000,
    }),
    ...generateModelSpec("gpt-4.1-nano", {
      costPerMillionInputTokens: 0.1,
      costPerMillionOutputTokens: 0.4,
      costPerMillionCachedInputTokens: 0.025,
      reasoningText: 1,
      intelligence: 2,
      tools: 2,
      speed: 5,
      contextLength: 1000000,
    }),
    ...generateModelSpec("gpt-5", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      reasoningText: 4,
      intelligence: 6,
      tools: 6,
      speed: 3,
      webSearch: 1,
      contextLength: 400000,
    }),
    ...generateModelSpec("gpt-5-mini", {
      costPerMillionInputTokens: 0.25,
      costPerMillionOutputTokens: 2,
      costPerMillionCachedInputTokens: 0.025,
      reasoningText: 3,
      intelligence: 5,
      tools: 5,
      speed: 4,
      webSearch: 1,
      contextLength: 400000,
    }),
    ...generateModelSpec("gpt-5-nano", {
      costPerMillionInputTokens: 0.05,
      costPerMillionOutputTokens: 0.4,
      costPerMillionCachedInputTokens: 0.005,
      reasoningText: 2,
      intelligence: 3,
      tools: 3,
      speed: 5,
      webSearch: 1,
      contextLength: 400000,
    }),
    ...generateModelSpec("o3", {
      costPerMillionInputTokens: 10.0,
      costPerMillionOutputTokens: 40.0,
      reasoningText: 6,
      intelligence: 6,
      tools: 6,
      speed: 2,
      webSearch: 1,
      contextLength: 200000,
    }),
    ...generateModelSpec("o4-mini", {
      costPerMillionInputTokens: 1.1,
      costPerMillionOutputTokens: 4.4,
      costPerMillionCachedInputTokens: 0.275,
      reasoningText: 5,
      intelligence: 5,
      tools: 5,
      speed: 3,
      webSearch: 1,
      contextLength: 200000,
    }),
  };

  for (const modelName in chatModels) {
    const model = chatModels[modelName];
    if (model.webSearch) {
      const newModel = {
        ...model,
        mangleRequest(req: ChatRequest) {
          (req.tools ??= {}).web_search_preview = openai.tools.webSearchPreview({});
          return undefined;
        },
        costPerMillionInputTokens: model.costPerMillionInputTokens + 0.001, // Adjust the cost slightly so that these models are only used for search
        costPerMillionOutputTokens: model.costPerMillionOutputTokens + 0.001,
      };

      delete model.webSearch;

      chatModels[`${modelName}-web-search`] = newModel;
    }
  }

  /**
   * A collection of OpenAI image generation model specifications.
   * Each key is a model ID, and the value is an `ImageModelSpec` object.
   */
  const imageGenerationModels: Record<string, ImageModelSpec> = {
    ...generateImageModelSpec("gpt-image-1", "gpt-image-1-high", {
      mangleRequest(req: ImageRequest) {
        req.quality = 'high';
      },
      costPerMillionInputTokens: 10,
      costPerMegapixel: 0.067
    }),
    ...generateImageModelSpec("gpt-image-1", "gpt-image-1-medium", {
      mangleRequest(req: ImageRequest) {
        req.quality = 'medium';
      },
      costPerMillionInputTokens: 10,
      costPerMegapixel: 0.042
    }),
    ...generateImageModelSpec("gpt-image-1", "gpt-image-1-low", {
      mangleRequest(req: ImageRequest) {
        req.quality = 'low';
      },
      costPerMillionInputTokens: 10,
      costPerMegapixel: 0.011
    })
  };

  modelRegistry.chat.registerAllModelSpecs(chatModels);
  modelRegistry.imageGeneration.registerAllModelSpecs(
    imageGenerationModels,
  );
}