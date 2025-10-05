import { z } from "zod";
import { ModelRegistry } from "./index.js";
import { AnthropicModelProviderConfigSchema } from "./providers/anthropic.js";

import * as anthropic from "./providers/anthropic.ts";
import { AzureModelProviderConfigSchema } from "./providers/azure.js";
import * as azure from "./providers/azure.ts";
import { CerebrasModelProviderConfigSchema } from "./providers/cerebras.js";
import * as cerebras from "./providers/cerebras.ts";
import { DeepSeekModelProviderConfigSchema } from "./providers/deepseek.js";
import * as deepseek from "./providers/deepseek.ts";
import { FalModelProviderConfigSchema } from "./providers/fal.js";
import * as fal from "./providers/fal.ts";
import { GoogleModelProviderConfigSchema } from "./providers/google.js";
import * as google from "./providers/google.ts";
import { GroqModelProviderConfigSchema } from "./providers/groq.js";
import * as groq from "./providers/groq.ts";
import { LlamaModelProviderConfigSchema } from "./providers/llama.js";
import { OllamaModelProviderConfigSchema } from "./providers/ollama.js";
import * as ollama from "./providers/ollama.ts";
import { OpenAIModelProviderConfigSchema } from "./providers/openai.js";
import * as openai from "./providers/openai.ts";
import { OAICompatibleModelConfigSchema } from "./providers/openaiCompatible.js";
import * as openaiCompatible from "./providers/openaiCompatible.ts";
import { OpenRouterModelProviderConfigSchema } from "./providers/openrouter.js";
import * as openrouter from "./providers/openrouter.ts";
import { PerplexityModelProviderConfigSchema } from "./providers/perplexity.js";
import * as perplexity from "./providers/perplexity.ts";
import { XAIModelProviderConfigSchema } from "./providers/xai.js";
import * as xai from "./providers/xai.ts";

/**
 * Registers a key: value object of model specs
 */
export async function registerModels(
	config: Record<string, ModelProviderConfig>,
	modelRegistry: ModelRegistry,
): Promise<void> {
	for (const providerDisplayName in config) {
		const providerConfig = config[providerDisplayName];

		switch (providerConfig.provider) {
			case "anthropic":
				await anthropic.init(providerDisplayName, modelRegistry, {
					...providerConfig,
				});
				break;
			case "cerebras":
				await cerebras.init(providerDisplayName, modelRegistry, {
					...providerConfig,
				});
				break;
			case "deepseek":
				await deepseek.init(providerDisplayName, modelRegistry, {
					...providerConfig,
				});
				break;
			case "fal":
				await fal.init(providerDisplayName, modelRegistry, {
					...providerConfig,
				});
				break;
			case "google":
				await google.init(providerDisplayName, modelRegistry, {
					...providerConfig,
				});
				break;
			case "groq":
				await groq.init(providerDisplayName, modelRegistry, {
					...providerConfig,
				});
				break;
			case "ollama":
				await ollama.init(providerDisplayName, modelRegistry, {
					...providerConfig,
				});
				break;
			case "openai":
				await openai.init(providerDisplayName, modelRegistry, {
					...providerConfig,
				});
				break;
			case "openrouter":
				await openrouter.init(providerDisplayName, modelRegistry, {
					...providerConfig,
				});
				break;
			case "perplexity":
				await perplexity.init(providerDisplayName, modelRegistry, {
					...providerConfig,
				});
				break;
			case "azure":
				await azure.init(providerDisplayName, modelRegistry, {
					...providerConfig,
				});
				break;
			case "openaiCompatible":
				await openaiCompatible.init(providerDisplayName, modelRegistry, {
					...providerConfig,
				});
				break;
			case "xai":
				await xai.init(providerDisplayName, modelRegistry, {
					...providerConfig,
				});
				break;
			default:
				throw new Error(
					`Unknown AI provider type: ${(providerConfig as any).provider}`,
				);
		}
	}
}

export const ModelProviderConfigSchema = z.discriminatedUnion("provider", [
	AnthropicModelProviderConfigSchema.extend({
		provider: z.literal("anthropic"),
	}),
	CerebrasModelProviderConfigSchema.extend({ provider: z.literal("cerebras") }),
	DeepSeekModelProviderConfigSchema.extend({ provider: z.literal("deepseek") }),
	FalModelProviderConfigSchema.extend({ provider: z.literal("fal") }),
	GoogleModelProviderConfigSchema.extend({ provider: z.literal("google") }),
	GroqModelProviderConfigSchema.extend({ provider: z.literal("groq") }),
	LlamaModelProviderConfigSchema.extend({ provider: z.literal("llama") }),
	OllamaModelProviderConfigSchema.extend({ provider: z.literal("ollama") }),
	OpenAIModelProviderConfigSchema.extend({ provider: z.literal("openai") }),
	OpenRouterModelProviderConfigSchema.extend({
		provider: z.literal("openrouter"),
	}),
	PerplexityModelProviderConfigSchema.extend({
		provider: z.literal("perplexity"),
	}),
	AzureModelProviderConfigSchema.extend({ provider: z.literal("azure") }),
	OAICompatibleModelConfigSchema.extend({
		provider: z.literal("openaiCompatible"),
	}),
	XAIModelProviderConfigSchema.extend({ provider: z.literal("xai") }),
]);
export type ModelProviderConfig = z.infer<typeof ModelProviderConfigSchema>;
