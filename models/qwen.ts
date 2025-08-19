import {qwen} from "qwen-ai-provider";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
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
const providerName = "Qwen";

export async function init(modelRegistry: ModelRegistry, config: ModelConfig) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for Qwen provider.");
  }

  const getModels = cachedDataRetriever(
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models",
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    },
  ) as () => Promise<ModelList | null>;

  const provider = config.provider || providerName;

  function generateModelSpec(modelId: string, modelSpec: Omit<Omit<Omit<ChatModelSpec, "isAvailable">, "provider">, "impl">): Record<string, ChatModelSpec> {
    return {
      [modelId]: {
        provider,
        impl: qwen(modelId),
        async isAvailable() {
          const modelList = await getModels();
          return !!modelList?.data.some((model) => model.id === modelId);
        },
        ...modelSpec,
      },
    }
  }

  /**
   * A collection of Qwen chat model specifications.
   * Each key is a model ID, and the value is a `ChatModelSpec` object.
   */
  const chatModels: Record<string, ChatModelSpec> = {
    ...generateModelSpec("qwen3-coder-plus", {
      costPerMillionInputTokens: 1.8,
      costPerMillionOutputTokens: 9,
      reasoningText: 0,
      intelligence: 6,
      tools: 6,
      speed: 6,
      contextLength: 1048576,
    }),
    ...generateModelSpec("qwen-max", {
      costPerMillionInputTokens: 1.6,
      costPerMillionOutputTokens: 6.4,
      reasoningText: 3,
      intelligence: 3,
      tools: 3,
      speed: 2,
      contextLength: 32768,
    }),
    ...generateModelSpec("qwen-plus", {
      costPerMillionInputTokens: 0.4,
      costPerMillionOutputTokens: 1.2,
      reasoningText: 2,
      intelligence: 2,
      tools: 2,
      speed: 3,
      contextLength: 131072,
    }),
    ...generateModelSpec("qwen-turbo", {
      costPerMillionInputTokens: 0.05,
      costPerMillionOutputTokens: 0.2,
      reasoningText: 1,
      intelligence: 1,
      tools: 1,
      speed: 5,
      contextLength: 1008192,
    }),
    ...generateModelSpec("qwq-plus", {
      costPerMillionInputTokens: 0.8,
      costPerMillionOutputTokens: 2.4,
      reasoningText: 3,
      intelligence: 3,
      tools: 2,
      speed: 2,
      contextLength: 131072,
    }),
    ...generateModelSpec("qwen2.5-72b-instruct", {
      costPerMillionInputTokens: 1.4,
      costPerMillionOutputTokens: 5.6,
      reasoningText: 2,
      intelligence: 3,
      tools: 2,
      speed: 2,
      contextLength: 131072,
    }),
    ...generateModelSpec("qwen2.5-32b-instruct", {
      costPerMillionInputTokens: 0.7,
      costPerMillionOutputTokens: 2.8,
      reasoningText: 2,
      intelligence: 2,
      tools: 2,
      speed: 3,
      contextLength: 131072,
    }),
    ...generateModelSpec("qwen2.5-14b-instruct", {
      costPerMillionInputTokens: 0.35,
      costPerMillionOutputTokens: 1.4,
      reasoningText: 2,
      intelligence: 2,
      tools: 2,
      speed: 4,
      contextLength: 131072,
    }),
    ...generateModelSpec("qwen2.5-7b-instruct", {
      costPerMillionInputTokens: 0.175,
      costPerMillionOutputTokens: 0.7,
      reasoningText: 1,
      intelligence: 2,
      tools: 1,
      speed: 4,
      contextLength: 131072,
    }),
    ...generateModelSpec("qwen3-32b", {
      costPerMillionInputTokens: 0.7,
      costPerMillionOutputTokens: 2.8,
      reasoningText: 3,
      intelligence: 3,
      tools: 3,
      speed: 3,
      contextLength: 131072,
    }),
    ...generateModelSpec("qwen3-14b", {
      costPerMillionInputTokens: 0.35,
      costPerMillionOutputTokens: 1.4,
      reasoningText: 2,
      intelligence: 2,
      tools: 2,
      speed: 4,
      contextLength: 131072,
    }),
    ...generateModelSpec("qwen3-8b", {
      costPerMillionInputTokens: 0.18,
      costPerMillionOutputTokens: 0.7,
      reasoningText: 2,
      intelligence: 2,
      tools: 2,
      speed: 4,
      contextLength: 131072,
    }),
  };

  await modelRegistry.chat.registerAllModelSpecs(chatModels);
}
