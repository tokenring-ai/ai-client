import {ModelRegistry} from "./index.js";
import {AnthropicModelProviderConfig} from "./models/anthropic.js";

import * as anthropic from "./models/anthropic.ts";
import {AzureModelProviderConfig} from "./models/azure.js";
import * as azure from "./models/azure.ts";
import {CerebrasModelProviderConfig} from "./models/cerebras.js";
import * as cerebras from "./models/cerebras.ts";
import {DeepSeekModelProviderConfig} from "./models/deepseek.js";
import * as deepseek from "./models/deepseek.ts";
import {FalModelProviderConfig} from "./models/fal.js";
import * as fal from "./models/fal.ts";
import {GoogleModelProviderConfig} from "./models/google.js";
import * as google from "./models/google.ts";
import {GroqModelProviderConfig} from "./models/groq.js";
import * as groq from "./models/groq.ts";
//import {OllamaModelProviderConfig} from "./models/ollama.js";
import {OpenAIModelProviderConfig} from "./models/openai.js";
//import * as ollama from "./models/ollama.ts"; // Currently not supported by AI SDK V5
import * as openai from "./models/openai.ts";
import {OAICompatibleModelConfig} from "./models/openaiCompatible.js";
//import * as qwen from "./models/qwen.ts"; // Currently not supported by AI SDK V5
import * as openaiCompatible from "./models/openaiCompatible.ts";
import {OpenRouterModelProviderConfig} from "./models/openrouter.js";
import * as openrouter from "./models/openrouter.ts";
import {PerplexityModelProviderConfig} from "./models/perplexity.js";
import * as perplexity from "./models/perplexity.ts";
//import {QwenModelProviderConfig} from "./models/qwen.js";
import {XAIModelProviderConfig} from "./models/xai.js";
import * as xai from "./models/xai.ts";

export type ModelProviderConfig =
  | Omit<AnthropicModelProviderConfig, "providerDisplayName"> & { provider: "anthropic" }
  | Omit<CerebrasModelProviderConfig, "providerDisplayName"> & { provider: "cerebras" }
  | Omit<DeepSeekModelProviderConfig, "providerDisplayName"> & { provider: "deepseek" }
  | Omit<FalModelProviderConfig, "providerDisplayName"> & { provider: "fal" }
  | Omit<GoogleModelProviderConfig, "providerDisplayName"> & { provider: "google" }
  | Omit<GroqModelProviderConfig, "providerDisplayName"> & { provider: "groq" }
  //| Omit<OllamaModelProviderConfig, "providerDisplayName"> & { provider: "ollama" }
  | Omit<OpenAIModelProviderConfig, "providerDisplayName"> & { provider: "openai" }
  | Omit<OpenRouterModelProviderConfig, "providerDisplayName"> & { provider: "openrouter" }
  | Omit<PerplexityModelProviderConfig, "providerDisplayName"> & { provider: "perplexity" }
  | Omit<AzureModelProviderConfig, "providerDisplayName"> & { provider: "azure" }
  | Omit<OAICompatibleModelConfig, "providerDisplayName"> & { provider: "openaiCompatible" }
  //| Omit<QwenModelProviderConfig>, "providerDisplayName"> & { provider: "qwen" }
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
      /*case "ollama":
        await ollama.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;*/
      case "openai":
        await openai.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      case "openrouter":
        await openrouter.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      /*case "llama":
        await llama.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
       */
      case "perplexity":
        await perplexity.init(modelRegistry, {providerDisplayName, ...providerConfig});
        break;
      /*case "qwen":
        await qwen.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;*/
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