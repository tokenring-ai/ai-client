import {createOpenAI} from "@ai-sdk/openai";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import {ChatModelRegistry} from "../ModelRegistry.ts";
import {AIModelProvider} from "../schema.ts";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";

const LlamaModelProviderConfigSchema = z.object({
  provider: z.literal('llama'),
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
  config: z.output<typeof LlamaModelProviderConfigSchema>,
  app: TokenRingApp,
) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for Llama provider.");
  }

  const getModels = cachedDataRetriever(
    "https://api.llama.com/compat/v1/models",
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    },
  ) as () => Promise<ModelList | null>;

  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: "https://api.llama.com/compat/v1",
  });

  function generateModelSpec(
    modelId: string,
    modelSpec: Omit<
      ChatModelSpec,
      "isAvailable" | "providerDisplayName" | "impl" | "modelId"
    >,
  ): ChatModelSpec {
    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: openai(modelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some((model) => model.id === modelId);
      },
      ...modelSpec,
    } satisfies ChatModelSpec;
  }

  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs([
    generateModelSpec("Llama-3.3-70B-Instruct", {
      maxContextLength: 131072,
      maxCompletionTokens: 32768,
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
    }),
    generateModelSpec("Llama-3.3-8B-Instruct", {
      maxContextLength: 131072,
      maxCompletionTokens: 131072,
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
    }),
    generateModelSpec("Llama-4-Maverick-17B-128E-Instruct-FP8", {
      maxContextLength: 131072,
      maxCompletionTokens: 32768,
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
    }),
    generateModelSpec("Llama-4-Scout-17B-16E-Instruct-FP8", {
      maxContextLength: 131072,
      maxCompletionTokens: 32768,
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
    }),
    ]);
  });
}

export default {
  providerCode: 'llama',
  configSchema: LlamaModelProviderConfigSchema,
  init
} satisfies AIModelProvider<typeof LlamaModelProviderConfigSchema>;
