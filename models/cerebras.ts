import {createCerebras} from "@ai-sdk/cerebras";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
/**
 * @param {import('../ModelRegistry.ts').default} modelRegistry
 * @param {import("../ModelRegistry.ts").ModelConfig} config
 * @returns {Promise<void>}
 *
 */
import ModelRegistry, {ModelConfig} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

/**
 * The name of the AI provider.
 * @type {string}
 */
const providerName = "Cerebras";

export async function init(modelRegistry: ModelRegistry, config: ModelConfig) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for Cerebras provider.");
  }

  const getModels = cachedDataRetriever("https://api.cerebras.ai/v1/models", {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  const isAvailable = () => getModels().then((data) => !!data);

  const provider = config.provider || providerName;

  const cerebrasProvider = createCerebras({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  /**
   * A collection of Cerebras chat model specifications.
   * Each key is a model ID, and the value is a `ChatModelSpec` object.
   * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.ts).
   * @type {Object<string,import("../client/AIChatClient.ts").ChatModelSpec>}
   */
  const chatModels: Record<string, ChatModelSpec> = {
    "deepseek-r1-distill-llama-70b": {
      provider,
      impl: cerebrasProvider("deepseek-r1-distill-llama-70b"),
      isAvailable,
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoning: 1,
      intelligence: 1,
      tools: 1,
      speed: 3,
      contextLength: 100000,
    },
    "llama-4-scout-17b-16e-instruct": {
      provider,
      impl: cerebrasProvider("llama-4-scout-17b-16e-instruct"),
      isAvailable,
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoning: 2,
      intelligence: 2,
      tools: 2,
      speed: 5,
      contextLength: 100000,
    },
    "qwen-3-32b": {
      provider,
      impl: cerebrasProvider("qwen-3-32b"),
      isAvailable,
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoning: 1,
      intelligence: 1,
      tools: 1,
      speed: 5,
      contextLength: 100000,
    },
  };

  await modelRegistry.chat.registerAllModelSpecs(chatModels);
}
