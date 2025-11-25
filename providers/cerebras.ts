import {createCerebras} from "@ai-sdk/cerebras";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import {ChatModelRegistry} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

export const CerebrasModelProviderConfigSchema = z.object({
  apiKey: z.string(),
});

export type CerebrasModelProviderConfig = z.infer<
  typeof CerebrasModelProviderConfigSchema
>;

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

export async function init(
  providerDisplayName: string,
  config: CerebrasModelProviderConfig,
  app: TokenRingApp,
) {
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
  });

  function generateModelSpec(
    modelId: string,
    modelSpec: Omit<
      ChatModelSpec,
      "isAvailable" | "provider" | "providerDisplayName" | "impl" | "modelId"
    >,
  ): ChatModelSpec {
    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: cerebrasProvider(modelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some((model) => model.id === modelId);
      },
      ...modelSpec,
    } as ChatModelSpec;
  }

  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs([
    generateModelSpec("llama3.1-8b", {
      costPerMillionInputTokens: 0.10,
      costPerMillionOutputTokens: 0.10,
      reasoningText: 1,
      intelligence: 2,
      tools: 2,
      speed: 10,
      contextLength: 32000,
    }),
    generateModelSpec("llama-3.3-70b", {
      costPerMillionInputTokens: 0.85,
      costPerMillionOutputTokens: 1.2,
      reasoningText: 3,
      intelligence: 3,
      tools: 3,
      speed: 10,
      contextLength: 128000,
    }),
    generateModelSpec("qwen-3-32b", {
      costPerMillionInputTokens: 0.4,
      costPerMillionOutputTokens: 0.8,
      reasoningText: 1,
      intelligence: 1,
      tools: 1,
      speed: 10,
      contextLength: 131000,
    }),
    generateModelSpec("qwen-3-235b-a22b-instruct-2507", {
      costPerMillionInputTokens: 0.6,
      costPerMillionOutputTokens: 1.2,
      reasoningText: 4,
      intelligence: 4,
      tools: 4,
      speed: 10,
      contextLength: 131000,
    }),

    generateModelSpec("zai-glm-4.6", {
      costPerMillionInputTokens: 2.25,
      costPerMillionOutputTokens: 2.75,
      reasoningText: 4,
      intelligence: 4,
      tools: 4,
      speed: 10,
      contextLength: 131000,
    }),
    generateModelSpec("gpt-oss-120b", {
      costPerMillionInputTokens: 0.35,
      costPerMillionOutputTokens: 0.75,
      reasoningText: 3,
      intelligence: 3,
      tools: 3,
      speed: 10,
      contextLength: 131000,
    }),
    ]);
  });
}
