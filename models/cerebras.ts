import {createCerebras} from "@ai-sdk/cerebras";
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
const providerName = "Cerebras";

export async function init(modelRegistry: ModelRegistry, config: ModelConfig) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for Cerebras provider.");
  }

  const getModels = cachedDataRetriever("https://api.cerebras.ai/v1/models", {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
  }) as () => Promise<ModelList | null>;

  const cerebrasProvider = createCerebras({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  function generateModelSpec(modelId: string, modelSpec: Omit<Omit<Omit<ChatModelSpec, "isAvailable">, "provider">, "impl">): Record<string, ChatModelSpec> {
    return {
      [modelId]: {
        provider: providerName,

        impl: cerebrasProvider(modelId),
        async isAvailable() {
          const modelList = await getModels();
          return !!modelList?.data.some((model) => model.id === modelId);

        },
        ...modelSpec,
      },
    }
  }

  /**
   * A collection of Cerebras chat model specifications.
   * Each key is a model ID, and the value is a `ChatModelSpec` object.
   * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.ts).
   */
  const chatModels: Record<string, ChatModelSpec> = {
    ...generateModelSpec("deepseek-r1-distill-llama-70b", {
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoningText: 1,
      intelligence: 1,
      tools: 1,
      speed: 3,
      contextLength: 100000,
    }),
    ...generateModelSpec("llama-4-scout-17b-16e-instruct", {
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoningText: 2,
      intelligence: 2,
      tools: 2,
      speed: 5,
      contextLength: 100000,
    }),
    ...generateModelSpec("llama3.1-8b", {
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoningText: 1,
      intelligence: 2,
      tools: 2,
      speed: 5,
      contextLength: 128000,
    }),
    ...generateModelSpec("llama-3.3-70b", {
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoningText: 3,
      intelligence: 3,
      tools: 3,
      speed: 4,
      contextLength: 128000,
    }),
    ...generateModelSpec("llama-4-maverick-17b-128e-instruct", {
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoningText: 2,
      intelligence: 2,
      tools: 2,
      speed: 5,
      contextLength: 100000,
    }),
    ...generateModelSpec("qwen-3-32b", {
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoningText: 1,
      intelligence: 1,
      tools: 1,
      speed: 5,
      contextLength: 100000,
    }),
    ...generateModelSpec("qwen-3-235b-a22b-instruct-2507", {
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoningText: 4,
      intelligence: 4,
      tools: 4,
      speed: 2,
      contextLength: 100000,
    }),
    ...generateModelSpec("qwen-3-235b-a22b-thinking-2507", {
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoningText: 5,
      intelligence: 4,
      tools: 3,
      speed: 1,
      contextLength: 100000,
    }),
    ...generateModelSpec("qwen-3-coder-480b", {
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoningText: 4,
      intelligence: 4,
      tools: 5,
      speed: 1,
      contextLength: 100000,
    }),
    ...generateModelSpec("gpt-oss-120b", {
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoningText: 3,
      intelligence: 3,
      tools: 3,
      speed: 3,
      contextLength: 100000,
    }),
  };

  await modelRegistry.chat.registerAllModelSpecs(chatModels);
}