import {createAnthropic} from "@ai-sdk/anthropic";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";

import ModelRegistry from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

export const AnthropicModelProviderConfigSchema = z.object({
  apiKey: z.string(),
});

export type AnthropicModelProviderConfig = z.infer<
  typeof AnthropicModelProviderConfigSchema
>;

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

export async function init(
  providerDisplayName: string,
  modelRegistry: ModelRegistry,
  config: AnthropicModelProviderConfig,
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

  const anthropicProvider = createAnthropic({
    apiKey: config.apiKey,
  });

  function generateModelSpec(
    modelId: string,
    anthropicModelId: string,
    modelSpec: Omit<
      ChatModelSpec,
      "isAvailable" | "providerDisplayName" | "impl" | "modelId" | "features" | "mangleRequest"
    >,
  ): ChatModelSpec {
    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: anthropicProvider(anthropicModelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some((model) => model.id === anthropicModelId);
      },
      mangleRequest(req, features) {
        // Add web search tool if enabled
        if (features.maxSearchUses) {
          (req.tools ??= {}).web_search = anthropicProvider.tools.webSearch_20250305({
            maxUses: features.maxSearchUses as number,
          });
        }
      },
      features: {
        maxSearchUses: {
          description: "Maximum number of web searches Claude can perform (0 to disable)",
          defaultValue: 0,
          type: "number",
          min: 0,
          max: 20,
        },
      },
      ...modelSpec,
    } as ChatModelSpec;
  }

  modelRegistry.chat.registerAllModelSpecs([
    generateModelSpec("claude-4.5-haiku", "claude-haiku-4-5-20251001", {
      costPerMillionInputTokens: 1, // $0.80 / MTok
      costPerMillionOutputTokens: 5.0, // $4 / MTok
      reasoningText: 3,
      intelligence: 4,
      tools: 3,
      speed: 4,
      contextLength: 200000,
    }),
		generateModelSpec("claude-4.1-opus", "claude-opus-4-1-20250805", {
			costPerMillionInputTokens: 15, // Unknown cost
			costPerMillionOutputTokens: 75, // Unknown cost
			reasoningText: 6,
			intelligence: 6,
			tools: 6,
			speed: 2,
			contextLength: 200000,
		}),
		generateModelSpec(
			"claude-4.5-sonnet-long-context",
			"claude-sonnet-4-5-20250929",
			{
				costPerMillionInputTokens: 6.0,
				costPerMillionOutputTokens: 22.5,
				reasoningText: 5,
				intelligence: 5,
				tools: 5,
				speed: 3,
				contextLength: 1000000,
			},
		),
		generateModelSpec("claude-4.5-sonnet", "claude-sonnet-4-5-20250929", {
			costPerMillionInputTokens: 3.0, // $3 / MTok
			costPerMillionOutputTokens: 15.0, // $15 / MTok
			reasoningText: 5,
			intelligence: 5,
			tools: 5,
			speed: 3,
			contextLength: 200000,
		}),
		generateModelSpec("claude-3.5-haiku", "claude-3-5-haiku-20241022", {
			costPerMillionInputTokens: 0.8, // $0.80 / MTok
			costPerMillionOutputTokens: 4.0, // $4 / MTok
			reasoningText: 2,
			intelligence: 3,
			tools: 3,
			speed: 4,
			contextLength: 200000,
		}),
		generateModelSpec("claude-3-haiku", "claude-3-haiku-20240307", {
			costPerMillionInputTokens: 0.25, // $0.25 / MTok
			costPerMillionOutputTokens: 1.25, // $1.25 / MTok
			reasoningText: 2,
			intelligence: 2,
			tools: 2,
			speed: 5,
			contextLength: 200000,
		}),
	]);
}
