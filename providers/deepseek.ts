import { createDeepSeek } from "@ai-sdk/deepseek";
import type TokenRingApp from "@tokenring-ai/app";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import { z } from "zod";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
import { ChatModelRegistry } from "../ModelRegistry.ts";
import modelConfigs from "../models/deepseek.yaml" with { type: "yaml" };
import type { AIModelProvider } from "../schema.ts";

const ChatModelSchema = z.object({
  costPerMillionInputTokens: z.number(),
  costPerMillionCachedInputTokens: z.number().exactOptional(),
  costPerMillionOutputTokens: z.number(),
  maxContextLength: z.number(),
});

const DeepSeekSchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
});

const parsedModelConfigs = DeepSeekSchema.parse(modelConfigs.models.deepseek);

const DeepSeekModelProviderConfigSchema = z.object({
  provider: z.literal("deepseek"),
  apiKey: z.string(),
});

interface Model {
  id: string;
  object: "model";
  owned_by: string;
}

interface ModelsListResponse {
  object: "list";
  data: Model[];
}

function init(providerDisplayName: string, config: z.output<typeof DeepSeekModelProviderConfigSchema>, app: TokenRingApp) {
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
    modelSpec: Omit<ChatModelSpec, "impl" | "isAvailable" | "provider" | "providerDisplayName" | "modelId">,
  ): ChatModelSpec {
    return {
      modelId,
      impl: deepseekProvider(modelId),
      providerDisplayName: providerDisplayName,
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some(model => model.id === modelId);
      },
      ...modelSpec,
    } satisfies ChatModelSpec;
  }

  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs(Object.entries(parsedModelConfigs.chat).map(([modelId, config]) => generateModelSpecs(modelId, config)));
  });
}

export default {
  providerCode: "deepseek",
  configSchema: DeepSeekModelProviderConfigSchema,
  init,
} satisfies AIModelProvider<typeof DeepSeekModelProviderConfigSchema>;
