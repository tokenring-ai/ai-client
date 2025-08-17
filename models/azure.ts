import { createAzure } from "@ai-sdk/azure";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
import ModelRegistry, { ModelConfig } from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

/**
 * The name of the AI provider.
 * @type {string}
 */
const providerName = "Azure";

export async function init(modelRegistry: ModelRegistry, config: ModelConfig) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for Azure provider.");
  }

  if (!!config.baseURL) {
    throw new Error("Either config.resourceName or config.baseURL must be provided for Azure provider.");
  }

  // For Azure, we'll need to construct the models endpoint URL
  const baseURL = config.baseURL;

  const getModels = cachedDataRetriever(`${baseURL}/openai/deployments?api-version=preview`, {
    headers: {
      "api-key": config.apiKey,
    },
  });

  const isAvailable = () => getModels().then((data) => !!data);

  const provider = config.provider || providerName;

  const azureProvider = createAzure({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  /**
   * A collection of Azure OpenAI chat model specifications.
   * Each key is a model ID, and the value is a `ChatModelSpec` object.
   * Note: Azure uses deployment names, so these should be configured based on your deployments.
   * @type {Object<string,ChatModelSpec>}
   */
  const chatModels: Record<string, ChatModelSpec> = {
    "deepseek-v3-0324": {
      provider,
      impl: azureProvider("DeepSeek-V3-0324"), // deployment name
      isAvailable,
      costPerMillionInputTokens: 0.0, // $0.14 / MTok
      costPerMillionOutputTokens: 0.0, // $0.28 / MTok
      reasoning: 6,
      intelligence: 5,
      tools: 4,
      speed: 3,
      contextLength: 65536,
    },
  };

  await modelRegistry.chat.registerAllModelSpecs(chatModels);
}