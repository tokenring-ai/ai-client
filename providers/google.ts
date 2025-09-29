import {createGoogleGenerativeAI} from "@ai-sdk/google";
import type {ChatModelSpec, ChatRequest} from "../client/AIChatClient.ts";
import type {ImageModelSpec} from "../client/AIImageGenerationClient.ts";
import ModelRegistry, {ModelProviderInfo} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

interface Model {
  name: string;
  displayName: string;
  description: string;
}

interface ModelList {
  models: Model[];
}


export interface GoogleModelProviderConfig extends ModelProviderInfo {
  apiKey: string;
}

export async function init(modelRegistry: ModelRegistry, config: GoogleModelProviderConfig) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for Google provider.");
  }

  const getModels = cachedDataRetriever(
    "https://generativelanguage.googleapis.com/v1beta/models",
    {
      headers: {
        "x-goog-api-key": config.apiKey,
      },
    },
  ) as () => Promise<ModelList | null>;

  const googleProvider = createGoogleGenerativeAI({
    apiKey: config.apiKey
  });

  function generateModelSpec(modelId: string, modelSpec: Omit<ChatModelSpec, "isAvailable" | "provider" | "providerDisplayName" | "impl" | "modelId">): ChatModelSpec {
    return {
      modelId,
      providerDisplayName: config.providerDisplayName,
      impl: googleProvider(modelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.models.some((model) => model.name.includes(modelId));
      },
      ...modelSpec,
    } as ChatModelSpec;
  }


  function generateImageModelSpec(modelId: string, costPerImage: number): ImageModelSpec {
    return {
      modelId,
      providerDisplayName: config.providerDisplayName,
      impl: googleProvider.image(modelId),
      async isAvailable() {
        // TODO: figure out how to get this working
        return true;

        //const modelList = await getModels();
        //return !!modelList?.models.some((model) => model.name.includes(modelId));
      },
      costPerImage
    };
  }

  const chatModels: ChatModelSpec[] = [
    generateModelSpec("gemini-2.5-pro", {
      costPerMillionInputTokens: 4.0,
      costPerMillionOutputTokens: 20.0,
      reasoningText: 6,
      intelligence: 6,
      tools: 6,
      speed: 2,
      webSearch: 1,
      contextLength: 1000000,
    }),
    generateModelSpec("gemini-2.5-flash", {
      costPerMillionInputTokens: 0.3,
      costPerMillionOutputTokens: 2.5,
      reasoningText: 5,
      intelligence: 4,
      tools: 4,
      speed: 4,
      webSearch: 1,
      contextLength: 1000000,
    }),
    generateModelSpec("gemini-2.5-flash-lite", {
      costPerMillionInputTokens: 0.1,
      costPerMillionOutputTokens: 0.4,
      reasoningText: 2,
      intelligence: 3,
      tools: 3,
      speed: 5,
      contextLength: 1000000,
    }),
  ];

  const webSearchModels: ChatModelSpec[] = [];
  
  for (const model of chatModels) {
    if (model.webSearch) {
      const newModel = {
        ...model,
        modelId: `${model.modelId}-web-search`,
        mangleRequest(req: ChatRequest) {
          (req.tools ??= {}).google_search = googleProvider.tools.googleSearch({})
          return undefined;
        },
        costPerMillionInputTokens: model.costPerMillionInputTokens + 0.001, // Adjust the cost slightly so that these models are only used for search
        costPerMillionOutputTokens: model.costPerMillionOutputTokens + 0.001,
      };

      delete model.webSearch;
      webSearchModels.push(newModel);
    }
  }

  modelRegistry.chat.registerAllModelSpecs([...chatModels, ...webSearchModels]);

  modelRegistry.imageGeneration.registerAllModelSpecs([
    generateImageModelSpec("imagen-4.0-ultra-generate-001", 0.06), // $0.06 per image
    generateImageModelSpec("imagen-4.0-generate-001", 0.04), // $0.04 per image
    generateImageModelSpec("imagen-4.0-fast-generate-001", 0.02), // $0.02 per image
  ]);
}
