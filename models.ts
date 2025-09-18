import {ModelRegistry} from "./index.js";
import {AnthropicModelProviderConfig} from "./providers/anthropic.js";

import * as anthropic from "./providers/anthropic.ts";
import {AzureModelProviderConfig} from "./providers/azure.js";
import * as azure from "./providers/azure.ts";
import {CerebrasModelProviderConfig} from "./providers/cerebras.js";
import * as cerebras from "./providers/cerebras.ts";
import {DeepSeekModelProviderConfig} from "./providers/deepseek.js";
import * as deepseek from "./providers/deepseek.ts";
import {FalModelProviderConfig} from "./providers/fal.js";
import * as fal from "./providers/fal.ts";
import {GoogleModelProviderConfig} from "./providers/google.js";
import * as google from "./providers/google.ts";
import {GroqModelProviderConfig} from "./providers/groq.js";
import * as groq from "./providers/groq.ts";
import {OllamaModelProviderConfig} from "./providers/ollama.js";
import * as ollama from "./providers/ollama.ts";
import {OpenAIModelProviderConfig} from "./providers/openai.js";
import * as openai from "./providers/openai.ts";
import {OAICompatibleModelConfig} from "./providers/openaiCompatible.js";
import * as openaiCompatible from "./providers/openaiCompatible.ts";
import {OpenRouterModelProviderConfig} from "./providers/openrouter.js";
import * as openrouter from "./providers/openrouter.ts";
import {PerplexityModelProviderConfig} from "./providers/perplexity.js";
import * as perplexity from "./providers/perplexity.ts";
import {XAIModelProviderConfig} from "./providers/xai.js";
import * as xai from "./providers/xai.ts";

export type ModelProviderConfig =
  | Omit<AnthropicModelProviderConfig, "providerDisplayName"> & { provider: "anthropic" }
  | Omit<CerebrasModelProviderConfig, "providerDisplayName"> & { provider: "cerebras" }
  | Omit<DeepSeekModelProviderConfig, "providerDisplayName"> & { provider: "deepseek" }
  | Omit<FalModelProviderConfig, "providerDisplayName"> & { provider: "fal" }
  | Omit<GoogleModelProviderConfig, "providerDisplayName"> & { provider: "google" }
  | Omit<GroqModelProviderConfig, "providerDisplayName"> & { provider: "groq" }
  | Omit<OllamaModelProviderConfig, "providerDisplayName"> & { provider: "ollama" }
  | Omit<OpenAIModelProviderConfig, "providerDisplayName"> & { provider: "openai" }
  | Omit<OpenRouterModelProviderConfig, "providerDisplayName"> & { provider: "openrouter" }
  | Omit<PerplexityModelProviderConfig, "providerDisplayName"> & { provider: "perplexity" }
  | Omit<AzureModelProviderConfig, "providerDisplayName"> & { provider: "azure" }
  | Omit<OAICompatibleModelConfig, "providerDisplayName"> & { provider: "openaiCompatible" }
  | Omit<XAIModelProviderConfig, "providerDisplayName"> & { provider: "xai" };

/**
 * Registers a key: value object of model specs
 */
export async function registerModels(config: Record<string, ModelProviderConfig>, modelRegistry: ModelRegistry): Promise<void> {
  for (const providerDisplayName in config) {
    const providerConfig = config[providerDisplayName];

    switch (providerConfig.provider) {
      case "anthropic":
        await anthropic.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      case "cerebras":
        await cerebras.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      case "deepseek":
        await deepseek.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      case "fal":
        await fal.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      case "google":
        await google.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      case "groq":
        await groq.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      case "ollama":
        await ollama.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
      case "openai":
        await openai.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      case "openrouter":
        await openrouter.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      case "perplexity":
        await perplexity.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      case "azure":
        await azure.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      case "openaiCompatible":
        await openaiCompatible.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      case "xai":
        await xai.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      default:
        throw new Error(`Unknown AI provider type: ${(providerConfig as any).provider}`)
    }
  }
}