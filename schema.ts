import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import {type AIProviderConfig, AIProviderConfigSchema} from "./providers.ts";

export type {TextPart, ImagePart, FilePart, UserModelMessage} from "ai";
export type {ModelInputCapability} from "./client/modelCapabilities.ts";
import type {ModelInputCapability} from "./client/modelCapabilities.ts";

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
          provider: "openaiCompatible",
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
          provider: "openaiCompatible",
          apiKey: process.env.META_LLAMA_API_KEY,
          baseURL: 'https://api.llama.com/compat/v1',
          defaultContextLength: 128000
        };
      }

      if (process.env.NVIDIA_NIM_API_KEY) {
        config.Nvidia = {
          provider: "openaiCompatible",
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

      if (process.env.LLAMA_BASE_URL || process.env.LLAMA_API_KEY) {
        config.LLamaCPP = {
          provider: "openaiCompatible",
          baseURL: process.env.LLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
          ...(process.env.LLAMA_API_KEY && {apiKey: process.env.LLAMA_API_KEY}),
          defaultContextLength: 128000
        };
      }

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
          provider: "openaiCompatible",
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
          provider: "openaiCompatible",
          apiKey: process.env.ZAI_API_KEY,
          baseURL: "https://api.z.ai/api/coding/paas/v4",
          defaultContextLength: 200000
        };
      }
      return config;
    }
  ),
});
