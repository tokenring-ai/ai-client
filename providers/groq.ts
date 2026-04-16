import {groq} from "@ai-sdk/groq";
import type TokenRingApp from "@tokenring-ai/app";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import {ChatModelRegistry} from "../ModelRegistry.ts";
import modelConfigs from "../models/groq.yaml" with {type: "yaml"};
import type {AIModelProvider} from "../schema.ts";

const ChatModelSchema = z.object({
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  maxContextLength: z.number(),
  maxCompletionTokens: z.number().optional(),
});

const GroqSchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
});

const parsedModelConfigs = GroqSchema.parse(modelConfigs.models.groq);

const GroqModelProviderConfigSchema = z.object({
  provider: z.literal("groq"),
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

function init(
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

  app.waitForService(ChatModelRegistry, (chatModelRegistry) => {
    chatModelRegistry.registerAllModelSpecs(
      Object.entries(parsedModelConfigs.chat).map(([modelId, config]) =>
        generateModelSpec(modelId, config),
      ),
    );
  });
}

export default {
  providerCode: "groq",
  configSchema: GroqModelProviderConfigSchema,
  init,
} satisfies AIModelProvider<typeof GroqModelProviderConfigSchema>;
