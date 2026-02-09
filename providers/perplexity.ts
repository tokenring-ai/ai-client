import {perplexity} from "@ai-sdk/perplexity";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec, ChatRequest,} from "../client/AIChatClient.ts";
import {ChatModelRegistry} from "../ModelRegistry.ts";
import {FeatureOptions} from "../ModelTypeRegistry.ts";
import {AIModelProvider} from "../schema.ts";
import {resequenceMessages} from "../util/resequenceMessages.ts";

const PerplexityModelProviderConfigSchema = z.object({
  provider: z.literal('perplexity'),
  apiKey: z.string(),
});

/**
 * Initializes the Perplexity AI provider and registers its chat models with the model agent.
 *
 */
async function init(
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
      | "features"
    >,
  ): ChatModelSpec {
    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: perplexity(modelId),
      mangleRequest,
      async isAvailable() {
        return true;
      },
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: true,
          type: "boolean",
        },
        searchContextSize: {
          description: "The searchContextSize parameter allows you to control how much search context is retrieved from the web during query resolution",
          defaultValue: "low",
          type: "enum",
          values: ["low", "medium", "high"],
        },
      },
      ...modelSpec,
    } satisfies ChatModelSpec;
  }

  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs([
    generateModelSpec("sonar", {
      costPerMillionInputTokens: 1,
      costPerMillionOutputTokens: 1,
      reasoningText: 2,
      intelligence: 3,
      tools: 3,
      speed: 2,
      contextLength: 128000,
    }),
    generateModelSpec("sonar-pro", {
      costPerMillionInputTokens: 3,
      costPerMillionOutputTokens: 15,
      reasoningText: 2,
      intelligence: 3,
      tools: 3,
      speed: 3,
      contextLength: 200000,
    }),
    generateModelSpec("sonar-reasoning", {
      costPerMillionInputTokens: 1,
      costPerMillionOutputTokens: 5,
      reasoningText: 3,
      intelligence: 3,
      tools: 3,
      speed: 2,
      contextLength: 128000,
    }),
    generateModelSpec("sonar-reasoning-pro", {
      costPerMillionInputTokens: 2,
      costPerMillionOutputTokens: 8,
      reasoningText: 4,
      intelligence: 4,
      tools: 4,
      speed: 2,
      contextLength: 128000,
    }),
    generateModelSpec("sonar-deep-research", {
      costPerMillionInputTokens: 2,
      costPerMillionOutputTokens: 8,
      costPerMillionReasoningTokens: 3,
      research: 3,
      reasoningText: 5,
      intelligence: 5,
      tools: 5,
      speed: 1,
      contextLength: 128000,
    }),
    ]);
  });
}

/**
 * Mangles OpenAI-style chat input messages to ensure they follow the required alternating pattern.
 * This function combines consecutive messages from the same role and ensures user/assistant roles alternate.
 */
function mangleRequest(request: ChatRequest, features: FeatureOptions ): void {
  const perplexityOptions = (request.providerOptions ??= {}).perplexity ??= {};
  const webSearchOptions = perplexityOptions.web_search_options ??= {};

  if (features.searchContextSize) {
    webSearchOptions.search_context_size = features.searchContextSize;
  }

  if (!features?.websearch) {
    perplexityOptions.disable_search = true;
  }

  resequenceMessages(request);
}

export default {
  providerCode: 'perplexity',
  configSchema: PerplexityModelProviderConfigSchema,
  init
} satisfies AIModelProvider<typeof PerplexityModelProviderConfigSchema>;
