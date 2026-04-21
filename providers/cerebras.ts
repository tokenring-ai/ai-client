import { createCerebras } from "@ai-sdk/cerebras";
import type TokenRingApp from "@tokenring-ai/app";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import { z } from "zod";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
import { ChatModelRegistry } from "../ModelRegistry.ts";
import modelConfigs from "../models/cerebras.yaml" with { type: "yaml" };
import type { AIModelProvider } from "../schema.ts";

const ChatModelSchema = z.object({
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  maxContextLength: z.number(),
});

const CerebrasSchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
});

const parsedModelConfigs = CerebrasSchema.parse(modelConfigs.models.cerebras);

const CerebrasModelProviderConfigSchema = z.object({
  provider: z.literal("cerebras"),
  apiKey: z.string(),
});
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

function init(providerDisplayName: string, config: z.output<typeof CerebrasModelProviderConfigSchema>, app: TokenRingApp) {
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
    modelSpec: Omit<ChatModelSpec, "isAvailable" | "provider" | "providerDisplayName" | "impl" | "modelId">,
  ): ChatModelSpec {
    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: cerebrasProvider(modelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some(model => model.id === modelId);
      },
      ...modelSpec,
    } satisfies ChatModelSpec;
  }

  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs(Object.entries(parsedModelConfigs.chat).map(([modelId, config]) => generateModelSpec(modelId, config)));
  });
}

export default {
  providerCode: "cerebras",
  configSchema: CerebrasModelProviderConfigSchema,
  init,
} satisfies AIModelProvider<typeof CerebrasModelProviderConfigSchema>;
