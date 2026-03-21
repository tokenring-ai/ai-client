import {groq} from "@ai-sdk/groq";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import {ChatModelRegistry} from "../ModelRegistry.ts";
import {AIModelProvider} from "../schema.ts";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";

const GroqModelProviderConfigSchema = z.object({
  provider: z.literal('groq'),
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
  config: z.output<typeof GroqModelProviderConfigSchema>,
  app: TokenRingApp,
) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for Groq provider.");
  }

  const getModels = cachedDataRetriever(
    "https://api.groq.com/openai/v1/models",
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    },
  ) as () => Promise<ModelList | null>;

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
      impl: groq(modelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some((model) => model.id === modelId);
      },
      ...modelSpec,
    } satisfies ChatModelSpec;
  }

  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs([
    generateModelSpec("llama-3.1-8b-instant", {
      maxContextLength: 131072,
      maxCompletionTokens: 131072,
      costPerMillionInputTokens: 0.05,
      costPerMillionOutputTokens: 0.08,
    }),
    generateModelSpec("llama-3.3-70b-versatile", {
      maxContextLength: 131072,
      maxCompletionTokens: 32768,
      costPerMillionInputTokens: 0.59,
      costPerMillionOutputTokens: 0.79,
    }),
    generateModelSpec("openai/gpt-oss-120b", {
      maxContextLength: 131072,
      maxCompletionTokens: 65536,
      costPerMillionInputTokens: 0.15,
      costPerMillionOutputTokens: 0.6,
    }),
    generateModelSpec("openai/gpt-oss-20b", {
      maxContextLength: 131072,
      maxCompletionTokens: 65536,
      costPerMillionInputTokens: 0.075,
      costPerMillionOutputTokens: 0.3,
    }),
    // Preview Models
    generateModelSpec("meta-llama/llama-4-scout-17b-16e-instruct", {
      maxContextLength: 131072,
      maxCompletionTokens: 8192,
      costPerMillionInputTokens: 0.11,
      costPerMillionOutputTokens: 0.34,
    }),
    generateModelSpec("meta-llama/llama-prompt-guard-2-22m", {
      maxContextLength: 512,
      maxCompletionTokens: 512,
      costPerMillionInputTokens: 0.03,
      costPerMillionOutputTokens: 0.03,
    }),
    generateModelSpec("meta-llama/llama-prompt-guard-2-86m", {
      maxContextLength: 512,
      maxCompletionTokens: 512,
      costPerMillionInputTokens: 0.04,
      costPerMillionOutputTokens: 0.04,
    }),
    generateModelSpec("moonshotai/kimi-k2-instruct-0905", {
      maxContextLength: 262144,
      maxCompletionTokens: 16384,
      costPerMillionInputTokens: 1.0,
      costPerMillionOutputTokens: 3.0,
    }),
    generateModelSpec("openai/gpt-oss-safeguard-20b", {
      maxContextLength: 131072,
      maxCompletionTokens: 65536,
      costPerMillionInputTokens: 0.075,
      costPerMillionOutputTokens: 0.3,
    }),
    generateModelSpec("qwen/qwen3-32b", {
      maxContextLength: 131072,
      maxCompletionTokens: 40960,
      costPerMillionInputTokens: 0.29,
      costPerMillionOutputTokens: 0.59,
    }),
    ]);
  });
}

export default {
  providerCode: 'groq',
  configSchema: GroqModelProviderConfigSchema,
  init
} satisfies AIModelProvider<typeof GroqModelProviderConfigSchema>;