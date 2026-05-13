import type TokenRingApp from "@tokenring-ai/app";
import deepMerge from "@tokenring-ai/utility/object/deepMerge";
import { z } from "zod";

import AnthropicProvider from "./providers/anthropic.ts";
import CerebrasProvider from "./providers/cerebras.ts";
import DeepSeekProvider from "./providers/deepseek.ts";
import ElevenLabsProvider from "./providers/elevenlabs.ts";
import FalProvider from "./providers/fal.ts";
import GenericAIProvider from "./providers/generic.ts";
import GoogleProvider from "./providers/google.ts";
import GroqProvider from "./providers/groq.ts";
import OpenAIProvider from "./providers/openai.ts";
import OpenRouterProvider from "./providers/openrouter.ts";
import PerplexityProvider from "./providers/perplexity.ts";
import XAIProvider from "./providers/xai.ts";
import type { ModelProvider } from "./ModelProvider.ts";
import type { ParsedAIPackageConfig } from "./schema.ts";

type AnyProviderClass = new (name: string, config: any, app: TokenRingApp) => ModelProvider<any>;

const providerClasses: Record<string, AnyProviderClass> = {
  anthropic: AnthropicProvider,
  cerebras: CerebrasProvider,
  deepseek: DeepSeekProvider,
  elevenlabs: ElevenLabsProvider,
  fal: FalProvider,
  generic: GenericAIProvider,
  google: GoogleProvider,
  groq: GroqProvider,
  openai: OpenAIProvider,
  openrouter: OpenRouterProvider,
  perplexity: PerplexityProvider,
  xai: XAIProvider,
};

/**
 * Registers a key: value object of model specs
 */
export async function reconfigureProviders(config: ParsedAIPackageConfig, app: TokenRingApp): Promise<void> {
  for (const key in process.env) {
    const match = key.match(/^LLAMA_(BASE_URL|API_KEY)(\d*)$/);
    if (match) {
      const n = match[2];
      const name = process.env[`LLAMA_NAME${n}`] ?? `Llama${n}`;
      const baseURL = process.env[`LLAMA_BASE_URL${n}`] ?? "http://127.0.0.1:11434/v1";
      const apiKey = process.env[`LLAMA_API_KEY${n}`] ?? undefined;
      const endpointType = process.env[`LLAMA_ENDPOINT_TYPE${n}`] ?? "openai";
      switch (endpointType) {
        case "openai":
        case "anthropic":
        case "responses":
          break;
        default:
          throw new Error(`Invalid endpoint type for LlamaCPP${n}: ${endpointType}`);
      }
      const defaultContextLength = parseInt(process.env[`LLAMA_CONTEXT_LENGTH${n}`] ?? "128000", 10);
      if (Number.isNaN(defaultContextLength)) {
        throw new Error(`Invalid context length for LlamaCPP${n}: ${process.env[`LLAMA_CONTEXT_LENGTH${n}`]}`);
      }

      if (!config.ai.providers[name]) {
        config = deepMerge(config, {
          ai: {
            providers: {
              [name]: GenericAIProvider.configSchema.parse({
                provider: "generic",
                endpointType,
                baseURL,
                ...(apiKey && { apiKey }),
                defaultContextLength,
              }),
            },
          }
        });
      }
    }
  }

  await Promise.all(
    Object.entries(config.ai.providers).map(async ([providerDisplayName, providerConfig]) => {
      const ProviderClass = providerClasses[providerConfig.provider];
      if (!ProviderClass) return;
      const provider = new ProviderClass(providerDisplayName, providerConfig, app);
      app.addServices(provider);
      await provider.ready();
    }),
  );
}

export const AIProviderConfigSchema = z.discriminatedUnion("provider", [
  AnthropicProvider.configSchema,
  CerebrasProvider.configSchema,
  DeepSeekProvider.configSchema,
  ElevenLabsProvider.configSchema,
  FalProvider.configSchema,
  GenericAIProvider.configSchema,
  GoogleProvider.configSchema,
  GroqProvider.configSchema,
  OpenAIProvider.configSchema,
  OpenRouterProvider.configSchema,
  PerplexityProvider.configSchema,
  XAIProvider.configSchema,
]);
export type AIProviderConfig = z.infer<typeof AIProviderConfigSchema>;
