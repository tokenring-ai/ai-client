import {createDeepSeek} from "@ai-sdk/deepseek";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import {ChatModelRegistry} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

export const DeepSeekModelProviderConfigSchema = z.object({
  apiKey: z.string(),
});

export type DeepSeekModelProviderConfig = z.infer<
  typeof DeepSeekModelProviderConfigSchema
>;

interface Model {
  id: string;
  object: "model";
  owned_by: string;
}

interface ModelsListResponse {
  object: "list";
  data: Model[];
}

export async function init(
  providerDisplayName: string,
  config: DeepSeekModelProviderConfig,
  app: TokenRingApp,
) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for DeepSeek provider.");
  }

  const getModels = cachedDataRetriever("https://api.deepseek.com/models", {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  }) as () => Promise<ModelsListResponse | null>;

  const deepseekProvider = createDeepSeek({
    apiKey: config.apiKey,
  });

  function generateModelSpecs(
    modelId: string,
    modelSpec: Omit<
      ChatModelSpec,
      "impl" | "isAvailable" | "provider" | "providerDisplayName" | "modelId"
    >,
  ): ChatModelSpec {
    return {
      modelId,
      impl: deepseekProvider(modelId),
      providerDisplayName: providerDisplayName,
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some((model) => model.id === modelId);
      },
      ...modelSpec,
    } as ChatModelSpec;
  }

  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs([
    generateModelSpecs("deepseek-chat", {
      costPerMillionInputTokens: 0.28,
      costPerMillionOutputTokens: 0.42,
      reasoningText: 1,
      intelligence: 3,
      tools: 3,
      speed: 2,
      contextLength: 128000,
    }),
    generateModelSpecs("deepseek-reasoner", {
      costPerMillionInputTokens: 0.28,
      costPerMillionOutputTokens: 0.42,
      reasoningText: 5,
      intelligence: 5,
      tools: 5,
      speed: 2,
      contextLength: 128000,
    }),
    ]);
  });
}
