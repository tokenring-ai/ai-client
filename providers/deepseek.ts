import {createDeepSeek} from "@ai-sdk/deepseek";
import type TokenRingApp from "@tokenring-ai/app";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import {ChatModelRegistry} from "../ModelRegistry.ts";
import type {AIModelProvider} from "../schema.ts";

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

function init(
  providerDisplayName: string,
  config: z.output<typeof DeepSeekModelProviderConfigSchema>,
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
    } satisfies ChatModelSpec;
  }

  app.waitForService(ChatModelRegistry, (chatModelRegistry) => {
    chatModelRegistry.registerAllModelSpecs([
      generateModelSpecs("deepseek-chat", {
        costPerMillionInputTokens: 0.28,
        costPerMillionCachedInputTokens: 0.028,
        costPerMillionOutputTokens: 0.42,
        maxContextLength: 128000,
      }),
      generateModelSpecs("deepseek-reasoner", {
        costPerMillionInputTokens: 0.28,
        costPerMillionCachedInputTokens: 0.028,
        costPerMillionOutputTokens: 0.42,
        maxContextLength: 128000,
      }),
    ]);
  });
}

export default {
  providerCode: "deepseek",
  configSchema: DeepSeekModelProviderConfigSchema,
  init,
} satisfies AIModelProvider<typeof DeepSeekModelProviderConfigSchema>;
