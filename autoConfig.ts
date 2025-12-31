import {AIProviderConfig} from "./providers.ts";
export default function autoConfig() {
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
    };
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
      baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
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
    };
  }
  return config;
}