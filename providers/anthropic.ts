import {createAnthropic} from "@ai-sdk/anthropic";
import type TokenRingApp from "@tokenring-ai/app";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import {ChatModelRegistry} from "../ModelRegistry.ts";
import modelConfigs from "../models/anthropic.yaml" with {type: "yaml"};
import type {AIModelProvider} from "../schema.ts";

const ChatModelSchema = z.object({
  providerModelId: z.string(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  maxContextLength: z.number(),
});

const AnthropicSchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
});

const parsedModelConfigs = AnthropicSchema.parse(modelConfigs.models.anthropic);

const AnthropicModelProviderConfigSchema = z.object({
  provider: z.literal("anthropic"),
  apiKey: z.string(),
});

interface Model {
  created_at: string;
  display_name: string;
  id: string;
  type: "model";
}

interface ModelsResponse {
  data: Model[];
  first_id: string;
  has_more: boolean;
  last_id: string;
}

function init(
  providerDisplayName: string,
  config: z.output<typeof AnthropicModelProviderConfigSchema>,
  app: TokenRingApp,
) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for Anthropic provider.");
  }

  const getModels = cachedDataRetriever("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
  }) as () => Promise<ModelsResponse | null>;

  const anthropicClient = createAnthropic({
    apiKey: config.apiKey,
  });

  function generateModelSpec(
    modelId: string,
    anthropicModelId: string,
    modelSpec: Omit<
      ChatModelSpec,
      | "isAvailable"
      | "providerDisplayName"
      | "impl"
      | "modelId"
      | "settings"
      | "mangleRequest"
    >,
  ): ChatModelSpec {
    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: anthropicClient(anthropicModelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some((model) => model.id === anthropicModelId);
      },
      mangleRequest(req, settings) {
        const anthropicProvider = ((req.providerOptions ??= {}).anthropic ??=
          {});
        if (settings.get("caching") as boolean) {
          anthropicProvider.cacheControl = {type: "ephemeral"};
        }

        // Add web search tool if enabled
        if (settings.get("websearch") as boolean) {
          (req.tools ??= {}).web_search =
            anthropicClient.tools.webSearch_20250305({
              maxUses: (settings.get("maxSearchUses") as number) ?? 5,
            });
        }
      },
      settings: {
        caching: {
          description: "Enable context caching for this model",
          defaultValue: true,
          type: "boolean",
        },
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        },
        maxSearchUses: {
          description:
            "Maximum number of web searches Claude can perform (0 to disable)",
          defaultValue: 5,
          type: "number",
          min: 1,
          max: 20,
        },
      },
      inputCapabilities: {
        image: true,
        file: true,
      },
      ...modelSpec,
    } satisfies ChatModelSpec;
  }

  const chatModelRegistry = app.requireService(ChatModelRegistry);
  chatModelRegistry.registerAllModelSpecs(
    Object.entries(parsedModelConfigs.chat).map(([modelId, config]) =>
      generateModelSpec(modelId, config.providerModelId, {
        costPerMillionInputTokens: config.costPerMillionInputTokens,
        costPerMillionOutputTokens: config.costPerMillionOutputTokens,
        maxContextLength: config.maxContextLength,
      }),
    ),
  );
}

export default {
  providerCode: "anthropic",
  configSchema: AnthropicModelProviderConfigSchema,
  init,
} satisfies AIModelProvider<typeof AnthropicModelProviderConfigSchema>;
