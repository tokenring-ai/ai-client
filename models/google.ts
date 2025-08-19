import {createGoogleGenerativeAI} from "@ai-sdk/google";
import type {ChatModelSpec, ChatRequest} from "../client/AIChatClient.ts";
import ModelRegistry, {ModelConfig} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

interface Model {
  name: string;
  displayName: string;
  description: string;
}

interface ModelList {
  models: Model[];
}

/**
 * The name of the AI provider.
 */
const providerName = "Google";

export async function init(modelRegistry: ModelRegistry, config: ModelConfig) {
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
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  function generateModelSpec(modelId: string, modelSpec: Omit<Omit<Omit<ChatModelSpec, "isAvailable">, "provider">, "impl">): Record<string, ChatModelSpec> {
    return {
      [modelId]: {
        provider: providerName,
        impl: googleProvider(modelId),
        async isAvailable() {
          const modelList = await getModels();
          return !!modelList?.models.some((model) => model.name.includes(modelId));
        },
        ...modelSpec,
      },
    }
  }

  const chatModels: Record<string, ChatModelSpec> = {
    ...generateModelSpec("gemini-1.5-pro", {
      costPerMillionInputTokens: 7.0,
      costPerMillionOutputTokens: 7.0,
      reasoningText: 3,
      intelligence: 3,
      tools: 3,
      speed: 2,
      contextLength: 2000000,
    }),
    ...generateModelSpec("gemini-1.5-flash", {
      costPerMillionInputTokens: 0.075,
      costPerMillionOutputTokens: 0.3,
      reasoningText: 1,
      intelligence: 3,
      tools: 3,
      speed: 5,
      contextLength: 128000,
    }),
    ...generateModelSpec("gemini-2.5-pro", {
      costPerMillionInputTokens: 4.0,
      costPerMillionOutputTokens: 20.0,
      reasoningText: 6,
      intelligence: 6,
      tools: 6,
      speed: 2,
      webSearch: 1,
      contextLength: 1000000,
    }),
    ...generateModelSpec("gemini-2.5-flash", {
      costPerMillionInputTokens: 0.3,
      costPerMillionOutputTokens: 2.5,
      reasoningText: 5,
      intelligence: 4,
      tools: 4,
      speed: 4,
      webSearch: 1,
      contextLength: 1000000,
    }),
    ...generateModelSpec("gemini-2.5-flash-lite", {
      costPerMillionInputTokens: 0.1,
      costPerMillionOutputTokens: 0.4,
      reasoningText: 2,
      intelligence: 3,
      tools: 3,
      speed: 5,
      contextLength: 1000000,
    }),
  };

  for (const modelName of Object.keys(chatModels)) {
    const model = chatModels[modelName];
    const newModel = {
      ...model,
      mangleRequest(req: ChatRequest) {
        (req.tools ??= {}).google_search = googleProvider.tools.googleSearch({})
        return undefined;
      },
      costPerMillionInputTokens: model.costPerMillionInputTokens + 0.001, // Adjust the cost slightly so that these models are only used for search
      costPerMillionOutputTokens: model.costPerMillionOutputTokens + 0.001,
    };

    delete model.webSearch;

    chatModels[`${modelName}-web-search`] = newModel;
  }

  await modelRegistry.chat.registerAllModelSpecs(chatModels);
}
