import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ModelInputCapability} from "./client/modelCapabilities.ts";
import {type AIProviderConfig, AIProviderConfigSchema} from "./providers.ts";
import type {GenericModelListResponse} from "./providers/generic.ts";

export type {TextPart, ImagePart, FilePart, UserModelMessage} from "ai";
export type {ModelInputCapability} from "./client/modelCapabilities.ts";

export type ModelRequirements = {
  /**
   * The name of the provider and model, possibly including wildcards
   */
  nameLike?: string;
}

export type ChatModelRequirements = ModelRequirements & {
  /**
   * Maximum context length in tokens the model allows
   */
  contextLength?: number;
  /**
   * Maximum output tokens the model allows
   */
  maxCompletionTokens?: number;
  image?: ModelInputCapability;
  video?: ModelInputCapability;
  audio?: ModelInputCapability;
  file?: ModelInputCapability;
  tools?: boolean;
  structuredOutput?: boolean;
  /**
   * Web search support
   */
  webSearch?: boolean;
};

export type EmbeddingModelRequirements = ModelRequirements & {
  /**
   * Maximum context length in tokens the model allows
   */
  contextLength?: number;
}

export type ImageModelRequirements = ModelRequirements & {
  /**
   * Maximum context length in tokens the model allows
   */
  contextLength?: number;
}

export type VideoModelRequirements = ModelRequirements & {
  /**
   * Maximum context length in tokens the model allows
   */
  contextLength?: number;
}

export type RerankingModelRequirements = ModelRequirements;

export type SpeechModelRequirements = ModelRequirements;

export type TranscriptionModelRequirements = ModelRequirements;

export interface AIModelProvider<T> {
  providerCode: string;
  configSchema: T;

  init(providerDisplayName: string, config: z.output<T>, app: TokenRingApp): Promise<void>;

  autoConfigure?: () => Promise<z.output<T> | null>;
}

export const AIClientConfigSchema = z.object({
  /**
   * Whether to automatically configure AI providers based on environment variables.
   */
  autoConfigure: z.boolean().default(false),
  /**
   * Configuration for AI providers
   */
  providers: z.record(z.string(), AIProviderConfigSchema).default(() => {
      const config: Record<string, AIProviderConfig> = {};

      if (process.env.ANTHROPIC_API_KEY) {
        config.Anthropic = {
          provider: "anthropic",
          apiKey: process.env.ANTHROPIC_API_KEY,
        };
      }

      if (process.env.AZURE_API_KEY && process.env.AZURE_API_ENDPOINT) {
        config.Azure = {
          provider: "azure",
          apiKey: process.env.AZURE_API_KEY,
          baseURL: process.env.AZURE_API_ENDPOINT,
        };
      }
      if (process.env.CEREBRAS_API_KEY) {
        config.Cerebras = {
          provider: "cerebras",
          apiKey: process.env.CEREBRAS_API_KEY,
        };
      }

      if (process.env.CHUTES_API_KEY) {
        config.Chutes = {
          provider: "generic",
          endpointType: "openai",
          apiKey: process.env.CHUTES_API_KEY,
          baseURL: 'https://llm.chutes.ai/v1',
          defaultContextLength: 128000
        };
      }

      if (process.env.DEEPSEEK_API_KEY) {
        config.DeepSeek = {
          provider: "deepseek",
          apiKey: process.env.DEEPSEEK_API_KEY,
        };
      }

      if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        config.Google = {
          provider: "google",
          apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        };
      }

      if (process.env.GROQ_API_KEY) {
        config.Groq = {
          provider: "groq",
          apiKey: process.env.GROQ_API_KEY,
        };
      }

      if (process.env.META_LLAMA_API_KEY) {
        config.LLama = {
          provider: "generic",
          endpointType: "openai",
          apiKey: process.env.META_LLAMA_API_KEY,
          baseURL: 'https://api.llama.com/compat/v1',
          defaultContextLength: 128000
        };
      }

      if (process.env.NVIDIA_NIM_API_KEY) {
        config.Nvidia = {
          provider: "generic",
          endpointType: "openai",
          apiKey: process.env.NVIDIA_NIM_API_KEY,
          baseURL: 'https://integrate.api.nvidia.com/v1',
          defaultContextLength: 32000
        }
      }

      if (process.env.OPENAI_API_KEY) {
        config.OpenAI = {
          provider: "openai",
          apiKey: process.env.OPENAI_API_KEY
        };
      }

      for (const key in process.env) {
        const match = key.match(/^LLAMA_(BASE_URL|API_KEY)(\d*)$/);
        if (match) {
          const n = match[2];
          const name = process.env[`LLAMA_NAME${n}`] ?? `LlamaCPP${n}`
          const baseURL = process.env[`LLAMA_BASE_URL${n}`] ?? "http://127.0.0.1:11434/v1"
          const apiKey = process.env[`LLAMA_API_KEY${n}`] ?? undefined;
          const endpointType = process.env[`LLAMA_ENDPOINT_TYPE${n}`] ?? "openai";
          switch (endpointType) {
            case 'openai':
            case 'anthropic':
            case 'responses':
              break;
            default:
              throw new Error(`Invalid endpoint type for LlamaCPP${n}: ${endpointType}`)
          }
          const defaultContextLength = parseInt(process.env[`LLAMA_CONTEXT_LENGTH${n}`] ?? '128000');
          if (isNaN(defaultContextLength)) {
            throw new Error(`Invalid context length for LlamaCPP${n}: ${process.env[`LLAMA_CONTEXT_LENGTH${n}`]}`);
          }

          config[name] = {
            provider: "generic",
            endpointType,
            baseURL,
            ...(apiKey && {apiKey}),
            defaultContextLength
          };
        }
      }

/*
      for (const key in process.env) {
        const match = key.match(/^RESPONSES_(URL|API_KEY)(\d*)$/);
        if (match) {
          const n = match[2];
          const name = process.env[`RESPONSES_NAME${n}`] ?? `Responses${n}`
          const url = process.env[`RESPONSES_URL${n}`] ?? "http://127.0.0.1:11434/v1"
          const apiKey = process.env[`RESPONSES_API_KEY${n}`] ?? undefined;
          const defaultContextLength = parseInt(process.env[`RESPONSES_CONTEXT_LENGTH${n}`] ?? '128000');
          if (isNaN(defaultContextLength)) {
            throw new Error(`Invalid context length for Responses${n}: ${process.env[`RESPONSES_CONTEXT_LENGTH${n}`]}`);
          }

          config[name] = {
            provider: "openResponses",
            url,
            ...(apiKey && {apiKey}),
            defaultContextLength
          };
        }
      }*/

      if (process.env.OPENROUTER_API_KEY) {
        config.OpenRouter = {
          provider: "openrouter",
          apiKey: process.env.OPENROUTER_API_KEY
        };
      }

      if (process.env.PERPLEXITY_API_KEY) {
        config.Perplexity = {
          provider: "perplexity",
          apiKey: process.env.PERPLEXITY_API_KEY,
        };
      }

      if (process.env.DASHSCOPE_API_KEY) {
        config.Qwen = {
          provider: "generic",
          endpointType: "openai",
          apiKey: process.env.DASHSCOPE_API_KEY,
          baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
          defaultContextLength: 262144
        };
      }

      if (process.env.XAI_API_KEY) {
        config.xAi = {
          provider: "xai",
          apiKey: process.env.XAI_API_KEY,
        };
      }

      if (process.env.ZAI_API_KEY) {
        config.zAi = {
          provider: "generic",
          endpointType: "openai",
          apiKey: process.env.ZAI_API_KEY,
          baseURL: "https://api.z.ai/api/coding/paas/v4",
          modelListUrl: "https://api.z.ai/api/coding/paas/v4/models",
          defaultContextLength: 200000
        };
      }

      if (process.env.MIMO_API_KEY) {
        config.MiMo = {
          provider: "generic",
          endpointType: "openai",
          apiKey: process.env.MIMO_API_KEY,
          baseURL: "https://api.xiaomimimo.com/v1",
          defaultContextLength: 1000000,
        }
      }

      if (process.env.MINIMAX_API_KEY) {
        config.Minimax = {
          provider: "generic",
          endpointType: "anthropic",
          apiKey: process.env.MINIMAX_API_KEY,
          baseURL: "https://api.minimax.io/anthropic/v1",
          defaultContextLength: 204800,
          staticModelList: {
            object: "list",
            data: [
              {
                id: "MiniMax-M2.7",
                object: "model",
                owned_by: "organization",
                created: Date.now(),
              },
              {
                id: "MiniMax-M2.7-highspeed",
                object: "model",
                owned_by: "organization",
                created: Date.now(),
              },
              {
                id: "MiniMax-M2.5",
                object: "model",
                owned_by: "organization",
                created: Date.now(),
              },
              {
                id: "MiniMax-M2.5-highspeed",
                object: "model",
                owned_by: "organization",
                created: Date.now(),
              },
              {
                id: "MiniMax-M2.1",
                object: "model",
                owned_by: "organization",
                created: Date.now(),
              },
              {
                id: "MiniMax-M2.1-highspeed",
                object: "model",
                owned_by: "organization",
                created: Date.now(),
              },
              {
                id: "MiniMax-M2",
                object: "model",
                owned_by: "organization",
                created: Date.now(),
              },
            ]
          } satisfies GenericModelListResponse
        };
      }

      return config;
    }
  ),
});
