import {createAnthropic} from "@ai-sdk/anthropic";
import type {ChatModelSpec} from "../client/AIChatClient.ts";

import ModelRegistry, {ModelProviderInfo} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

interface Model {
  created_at: string;
  display_name: string;
  id: string;
  type: "model";
}

interface ModelsResponse {
  data: Model[];
  first_id: string;
  has_more: boolean;
  last_id: string;
}

export interface AnthropicModelProviderConfig extends ModelProviderInfo {
  apiKey: string;
}


export async function init(modelRegistry: ModelRegistry, config: AnthropicModelProviderConfig) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for Anthropic provider.");
  }

  const getModels = cachedDataRetriever("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
  }) as () => Promise<ModelsResponse | null>;

  const anthropicProvider = createAnthropic({
    apiKey: config.apiKey
  });

  function generateModelSpec(modelId: string, anthropicModelId: string, modelSpec: Omit<ChatModelSpec, "isAvailable" | "provider" | "providerDisplayName" | "impl">): Record<string, ChatModelSpec> {
    return {
      [modelId]: {
        providerDisplayName: config.providerDisplayName,
        impl: anthropicProvider(anthropicModelId),
        async isAvailable() {
          const modelList = await getModels();
          return !!modelList?.data.some((model) => model.id === anthropicModelId);
        },
        ...modelSpec,
      },
    }
  }

  /*/**
   * A collection of Anthropic chat model specifications.
   * Each key is a model ID, and the value is a `ChatModelSpec` object.
   * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.ts).
   */
  const chatModels: Record<string, ChatModelSpec> = {
    ...generateModelSpec("claude-4.1-opus", "claude-opus-4-1-20250805", {
      costPerMillionInputTokens: 15, // Unknown cost
      costPerMillionOutputTokens: 75, // Unknown cost
      reasoningText: 6,
      intelligence: 6,
      tools: 6,
      speed: 2,
      contextLength: 200000,
    }),
    ...generateModelSpec("claude-4-opus", "claude-opus-4-20250514", {
      costPerMillionInputTokens: 15.0, // $15 / MTok
      costPerMillionOutputTokens: 75.0, // $75 / MTok
      reasoningText: 6,
      intelligence: 6,
      tools: 6,
      speed: 2,
      contextLength: 200000,
    }),
    ...generateModelSpec("claude-4-sonnet", "claude-sonnet-4-20250514", {
      costPerMillionInputTokens: 3.0, // $3 / MTok
      costPerMillionOutputTokens: 15.0, // $15 / MTok
      reasoningText: 5,
      intelligence: 5,
      tools: 5,
      speed: 3,
      contextLength: 200000,
    }),
    ...generateModelSpec("claude-3.7-sonnet", "claude-3-7-sonnet-20250219", {
      costPerMillionInputTokens: 3.0, // $3 / MTok
      costPerMillionOutputTokens: 15.0, // $15 / MTok
      reasoningText: 4,
      intelligence: 4,
      tools: 4,
      speed: 3,
      contextLength: 200000,
    }),
    ...generateModelSpec("claude-3.5-sonnet-new", "claude-3-5-sonnet-20241022", {
      costPerMillionInputTokens: 3.0, // $3 / MTok
      costPerMillionOutputTokens: 15.0, // $15 / MTok
      reasoningText: 4,
      intelligence: 4,
      tools: 4,
      speed: 3,
      contextLength: 200000,
    }),
    ...generateModelSpec("claude-3.5-haiku", "claude-3-5-haiku-20241022", {
      costPerMillionInputTokens: 0.8, // $0.80 / MTok
      costPerMillionOutputTokens: 4.0, // $4 / MTok
      reasoningText: 2,
      intelligence: 3,
      tools: 3,
      speed: 4,
      contextLength: 200000,
    }),
    ...generateModelSpec("claude-3.5-sonnet", "claude-3-5-sonnet-20240620", {
      costPerMillionInputTokens: 3.0, // $3 / MTok
      costPerMillionOutputTokens: 15.0, // $15 / MTok
      reasoningText: 3,
      intelligence: 3,
      tools: 3,
      speed: 3,
      contextLength: 200000,
    }),
    ...generateModelSpec("claude-3-haiku", "claude-3-haiku-20240307", {
      costPerMillionInputTokens: 0.25, // $0.25 / MTok
      costPerMillionOutputTokens: 1.25, // $1.25 / MTok
      reasoningText: 2,
      intelligence: 2,
      tools: 2,
      speed: 5,
      contextLength: 200000,
    }),
    ...generateModelSpec("claude-3-opus", "claude-3-opus-20240229", {
      costPerMillionInputTokens: 15.0, // $15 / MTok
      costPerMillionOutputTokens: 75.0, // $75 / MTok
      reasoningText: 5,
      intelligence: 5,
      tools: 5,
      speed: 2,
      contextLength: 200000,
    }),
  };

  modelRegistry.chat.registerAllModelSpecs(chatModels);
}