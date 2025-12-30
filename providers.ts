import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";

import anthropic from "./providers/anthropic.ts";
import azure from "./providers/azure.ts";
import cerebras from "./providers/cerebras.ts";
import deepseek from "./providers/deepseek.ts";
import elevenlabs from "./providers/elevenlabs.ts";
import fal from "./providers/fal.ts";
import google from "./providers/google.ts";
import groq from "./providers/groq.ts";
import llama from "./providers/llama.ts";
import ollama from "./providers/ollama.ts";
import openai from "./providers/openai.ts";
import openaiCompatible from "./providers/openaiCompatible.ts";
import openrouter from "./providers/openrouter.ts";
import perplexity from "./providers/perplexity.ts";
import xai from "./providers/xai.ts";


const providers = {
  anthropic,
  azure,
  cerebras,
  deepseek,
  elevenlabs,
  fal,
  google,
  groq,
  llama,
  ollama,
  openai,
  openaiCompatible,
  openrouter,
  perplexity,
  xai
}

/**
 * Registers a key: value object of model specs
 */
export async function registerProviders(
  config: Record<string, AIProviderConfig>,
  app: TokenRingApp,
): Promise<void> {
  for (const providerDisplayName in config) {
    const providerConfig = config[providerDisplayName];

    if (providerConfig.provider in providers) {
      await providers[providerConfig.provider].init(providerDisplayName, { ...providerConfig } as any, app);
    }
  }
}

export const AIProviderConfigSchema = z.discriminatedUnion("provider", [
  anthropic.configSchema,
  azure.configSchema,
  cerebras.configSchema,
  deepseek.configSchema,
  elevenlabs.configSchema,
  fal.configSchema,
  google.configSchema,
  groq.configSchema,
  llama.configSchema,
  ollama.configSchema,
  openai.configSchema,
  openaiCompatible.configSchema,
  openrouter.configSchema,
  perplexity.configSchema,
  xai.configSchema
]);
export type AIProviderConfig = z.infer<typeof AIProviderConfigSchema>;
