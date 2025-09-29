import {createDeepSeek} from "@ai-sdk/deepseek";
import type {ChatModelSpec} from "../client/AIChatClient.ts";

import ModelRegistry, {ModelProviderInfo} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

export interface DeepSeekModelProviderConfig extends ModelProviderInfo {
  apiKey: string;
}

interface Model {
  id: string;
  object: "model";
  owned_by: string;
}

interface ModelsListResponse {
  object: "list";
  data: Model[];
}

/**
 * The name of the AI provider.
 */
const providerName = "DeepSeek";

let isOffPeak = false;

function calculateOffPeak() {
  const now = new Date();
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();

  isOffPeak = (hours > 16 && minutes < 30) || (hours === 0 && minutes < 20);
  setTimeout(calculateOffPeak, 300000).unref();
}

calculateOffPeak();

export async function init(modelRegistry: ModelRegistry, config: DeepSeekModelProviderConfig) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for DeepSeek provider.");
  }

  const getModels = cachedDataRetriever("https://api.deepseek.com/models", {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  }) as () => Promise<ModelsListResponse | null>;


  const deepseekProvider = createDeepSeek({
    apiKey: config.apiKey
  });

  function generateModelSpecs(modelId: string, modelSpec: Omit<ChatModelSpec, "isAvailable" | "provider" | "providerDisplayName" | "modelId">, offPeakAdjustment: {
    costPerMillionInputTokens: number
    costPerMillionOutputTokens: number,
  }): ChatModelSpec[] {
    return [
      {
        modelId: `${modelId}-peak`,
        providerDisplayName: config.providerDisplayName,
        async isAvailable() {
          if (isOffPeak) return false;
          const modelList = await getModels();
          return !!modelList?.data.some((model) => model.id === modelId);
        },
        ...modelSpec,
      } as ChatModelSpec,
      {
        modelId: `${modelId}-offpeak`,
        providerDisplayName: config.providerDisplayName,
        async isAvailable() {
          if (!isOffPeak) return false;
          const modelList = await getModels();
          return !!modelList?.data.some((model) => model.id === modelId);
        },
        ...modelSpec,
        ...offPeakAdjustment,
      } as ChatModelSpec
    ];
  }

  modelRegistry.chat.registerAllModelSpecs([
    ...generateModelSpecs("deepseek-chat", {
        impl: deepseekProvider("deepseek-chat"),
        costPerMillionInputTokens: 0.27,
        costPerMillionOutputTokens: 1.1,
        reasoningText: 1,
        intelligence: 3,
        tools: 3,
        speed: 2,
        contextLength: 64000,
      },
      {
        costPerMillionInputTokens: 0.135,
        costPerMillionOutputTokens: 0.55
      }),
    ...generateModelSpecs("deepseek-reasoner", {
      impl: deepseekProvider("deepseek-reasoner"),
      costPerMillionInputTokens: 0.55,
      costPerMillionOutputTokens: 2.19,
      reasoningText: 5,
      intelligence: 5,
      tools: 5,
      speed: 2,
      contextLength: 64000,
    }, {
      costPerMillionInputTokens: 0.135,
      costPerMillionOutputTokens: 0.55,
    })
  ]);
}
