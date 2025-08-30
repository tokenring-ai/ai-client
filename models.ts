import {ModelRegistry} from "./index.js";
import {AnthropicModelProviderConfig} from "./models/anthropic.js";
import {AzureModelProviderConfig} from "./models/azure.js";
import {CerebrasModelProviderConfig} from "./models/cerebras.js";
import {DeepSeekModelProviderConfig} from "./models/deepseek.js";
import {FalModelProviderConfig} from "./models/fal.js";
import {GoogleModelProviderConfig} from "./models/google.js";
import {GroqModelProviderConfig} from "./models/groq.js";
import {OllamaModelProviderConfig} from "./models/ollama.js";
import {OpenAIModelProviderConfig} from "./models/openai.js";
import {OAICompatibleModelConfig} from "./models/openaiCompatible.js";
import {OpenRouterModelProviderConfig} from "./models/openrouter.js";
import {PerplexityModelProviderConfig} from "./models/perplexity.js";
import {XAIModelProviderConfig} from "./models/xai.js";

import * as anthropic from "./models/anthropic.ts";
import * as cerebras from "./models/cerebras.ts";
import * as deepseek from "./models/deepseek.ts";
import * as fal from "./models/fal.ts";
import * as google from "./models/google.ts";
import * as groq from "./models/groq.ts";
import * as ollama from "./models/ollama.ts";
import * as openai from "./models/openai.ts";
import * as openrouter from "./models/openrouter.ts";
import * as perplexity from "./models/perplexity.ts";
import * as azure from "./models/azure.ts";
//import * as qwen from "./models/qwen.ts"; // Currently not supported by AI SDK V5
import * as openaiCompatible from "./models/openaiCompatible.ts";
import * as xai from "./models/xai.ts";

export type ModelProviderConfig = 
  | Omit<AnthropicModelProviderConfig,"providerDisplayName"> & { provider: "anthropic" }
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
        await anthropic.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
      case "cerebras":
        await cerebras.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
      case "deepseek":
        await deepseek.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
      case "fal":
        await fal.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
      case "google":
        await google.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
      case "groq":
        await groq.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
      case "ollama":
        await ollama.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
      case "openai":
        await openai.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
      case "openrouter":
        await openrouter.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
      /*case "llama":
        await llama.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
       */
      case "perplexity":
        await perplexity.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
      /*case "qwen":
        await qwen.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;*/
      case "azure":
        await azure.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
      case "openaiCompatible":
        await openaiCompatible.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
      case "xai":
        await xai.init(modelRegistry, { providerDisplayName, ...providerConfig});
        break;
      default:
        throw new Error(`Unknown AI provider type: ${(providerConfig as any).provider}`)
    }
  }
}