import {createAzure} from "@ai-sdk/azure";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import ModelRegistry, {ModelConfig} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

interface Deployment {
  id: string;
  model: string;
  status: string;
}

interface DeploymentList {
  data: Deployment[];
}

/**
 * The name of the AI provider.
 */
const providerName = "Azure";

export async function init(modelRegistry: ModelRegistry, config: ModelConfig) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for Azure provider.");
  }

  if (!config.baseURL) {
    throw new Error("config.baseURL must be provided for Azure provider.");
  }

  const getModels = cachedDataRetriever(`${config.baseURL}/openai/deployments?api-version=2023-05-15`, {
    headers: {
      "api-key": config.apiKey,
    },
  }) as () => Promise<DeploymentList | null>;

  const provider = config.provider || providerName;

  const azureProvider = createAzure({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  function generateModelSpec(deploymentName: string, modelSpec: Omit<Omit<Omit<ChatModelSpec, "isAvailable">, "provider">, "impl">): Record<string, ChatModelSpec> {
    return {
      [deploymentName]: {
        provider: providerName,
        impl: azureProvider(deploymentName),
        async isAvailable() {
          const deploymentList = await getModels();
          return !!deploymentList?.data.some((deployment) => deployment.id === deploymentName && deployment.status === "succeeded");
        },
        ...modelSpec,
      },
    }
  }

  /**
   * A collection of Azure OpenAI chat model specifications.
   * Each key is a deployment name, and the value is a `ChatModelSpec` object.
   */
  const chatModels: Record<string, ChatModelSpec> = {
    ...generateModelSpec("deepseek-v3-0324", {
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoningText: 6,
      intelligence: 5,
      tools: 4,
      speed: 3,
      contextLength: 65536,
    }),
  };

  await modelRegistry.chat.registerAllModelSpecs(chatModels);
}