import {createOpenAI} from "@ai-sdk/openai";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import {ChatModelRegistry} from "../ModelRegistry.ts";
import {AIModelProvider} from "../schema.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

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
      contextLength: 131072,
      maxCompletionTokens: 32768,
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
      reasoningText: 5, // 70B model - high reasoning capability
      intelligence: 5, // Large model with strong general intelligence
      speed: 4, // Larger model, moderate speed
      tools: 4, // Good tool use capabilities
    }),
    generateModelSpec("Llama-3.3-8B-Instruct", {
      contextLength: 131072,
      maxCompletionTokens: 131072,
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
      reasoningText: 3, // Smaller 8B model - decent reasoning
      intelligence: 3, // Good but limited by size
      speed: 6, // Smaller model - faster inference
      tools: 3, // Moderate tool use capabilities
    }),
    generateModelSpec("Llama-4-Maverick-17B-128E-Instruct-FP8", {
      contextLength: 131072,
      maxCompletionTokens: 32768,
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
      reasoningText: 5, // Llama 4 generation with "Maverick" suggesting advanced capabilities
      intelligence: 5, // Next-gen model with 128 experts (128E)
      speed: 4, // FP8 quantization may help with speed, but 17B size is moderate
      tools: 4, // Advanced model likely good with tools
    }),
    generateModelSpec("Llama-4-Scout-17B-16E-Instruct-FP8", {
      contextLength: 131072,
      maxCompletionTokens: 32768,
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
      reasoningText: 4, // Llama 4 but "Scout" may suggest more specialized/lighter variant
      intelligence: 4, // Still Llama 4 but with fewer experts (16E vs 128E)
      speed: 5, // Fewer experts and FP8 quantization should make it faster
      tools: 4, // Good tool capabilities expected from Llama 4
    }),
    ]);
  });
}

export default {
  providerCode: 'llama',
  configSchema: LlamaModelProviderConfigSchema,
  init
} satisfies AIModelProvider<typeof LlamaModelProviderConfigSchema>;
