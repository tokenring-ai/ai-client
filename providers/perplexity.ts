import {perplexity} from "@ai-sdk/perplexity";
import type {JSONObject} from "@ai-sdk/provider";
import type TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec, ChatRequest} from "../client/AIChatClient.ts";
import {ChatModelRegistry} from "../ModelRegistry.ts";
import modelConfigs from "../models/perplexity.yaml" with {type: "yaml"};
import type {ChatModelSettings} from "../ModelTypeRegistry.ts";
import type {AIModelProvider} from "../schema.ts";
import {resequenceMessages} from "../util/resequenceMessages.ts";

const ChatModelSchema = z.object({
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  costPerMillionReasoningTokens: z.number().optional(),
  maxContextLength: z.number(),
});

const PerplexitySchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
});

const parsedModelConfigs = PerplexitySchema.parse(modelConfigs.models.perplexity);

const PerplexityModelProviderConfigSchema = z.object({
  provider: z.literal("perplexity"),
  apiKey: z.string(),
});

/**
 * Initializes the Perplexity AI provider and registers its chat models with the model agent.
 *
 */
function init(
  providerDisplayName: string,
  config: z.output<typeof PerplexityModelProviderConfigSchema>,
  app: TokenRingApp,
) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for Perplexity provider.");
  }

  function generateModelSpec(
    modelId: string,
    modelSpec: Omit<
      ChatModelSpec,
      | "isAvailable"
      | "provider"
      | "providerDisplayName"
      | "impl"
      | "mangleRequest"
      | "modelId"
      | "settings"
    >,
  ): ChatModelSpec {
    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: perplexity(modelId),
      mangleRequest,
      isAvailable() {
        return true;
      },
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: true,
          type: "boolean",
        },
        searchContextSize: {
          description:
            "The searchContextSize parameter allows you to control how much search context is retrieved from the web during query resolution",
          defaultValue: "low",
          type: "enum",
          values: ["low", "medium", "high"],
        },
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

/**
 * Mangles OpenAI-style chat input messages to ensure they follow the required alternating pattern.
 * This function combines consecutive messages from the same role and ensures user/assistant roles alternate.
 */
function mangleRequest(
  request: ChatRequest,
  settings: ChatModelSettings,
): void {
  const perplexityOptions = ((request.providerOptions ??= {}).perplexity ??=
    {});
  const webSearchOptions = (perplexityOptions.web_search_options ??=
    {}) as JSONObject;

  if (settings.has("searchContextSize")) {
    webSearchOptions.search_context_size = settings.get(
      "searchContextSize",
    ) as number;
  }

  if (!settings.has("websearch")) {
    perplexityOptions.disable_search = true;
  }

  resequenceMessages(request);
}

export default {
  providerCode: "perplexity",
  configSchema: PerplexityModelProviderConfigSchema,
  init,
} satisfies AIModelProvider<typeof PerplexityModelProviderConfigSchema>;
