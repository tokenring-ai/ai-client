import {createCerebras} from "@ai-sdk/cerebras";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import {ChatModelRegistry} from "../ModelRegistry.ts";
import {AIModelProvider} from "../schema.ts";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";

const CerebrasModelProviderConfigSchema = z.object({
  provider: z.literal('cerebras'),
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

async function init(
  providerDisplayName: string,
  config: z.output<typeof CerebrasModelProviderConfigSchema>,
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
    } satisfies ChatModelSpec;
  }

  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs([
    generateModelSpec("llama3.1-8b", {
      costPerMillionInputTokens: 0.10,
      costPerMillionOutputTokens: 0.10,
      maxContextLength: 32000,
    }),
    generateModelSpec("qwen-3-235b-a22b-instruct-2507", {
      costPerMillionInputTokens: 0.6,
      costPerMillionOutputTokens: 1.2,
      maxContextLength: 131000,
    }),

    generateModelSpec("zai-glm-4.7", {
      costPerMillionInputTokens: 2.25,
      costPerMillionOutputTokens: 2.75,
      maxContextLength: 131000,
    }),
    generateModelSpec("gpt-oss-120b", {
      costPerMillionInputTokens: 0.35,
      costPerMillionOutputTokens: 0.75,
      maxContextLength: 131000,
    }),
    ]);
  });
}

export default {
  providerCode: 'cerebras',
  configSchema: CerebrasModelProviderConfigSchema,
  init
} satisfies AIModelProvider<typeof CerebrasModelProviderConfigSchema>;
