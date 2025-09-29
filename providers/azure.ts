import {createAzure} from "@ai-sdk/azure";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import ModelRegistry, {ModelProviderInfo} from "../ModelRegistry.ts";
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

export interface AzureModelProviderConfig extends ModelProviderInfo {
  apiKey: string;
  baseURL: string;
}

export async function init(modelRegistry: ModelRegistry, config: AzureModelProviderConfig) {
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


  const azureProvider = createAzure({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  function generateModelSpec(deploymentName: string, modelSpec: Omit<ChatModelSpec, "isAvailable" | "provider" | "providerDisplayName" | "impl" | "modelId">): ChatModelSpec {
    return {
      modelId: deploymentName,
      providerDisplayName: config.providerDisplayName,
      impl: azureProvider(deploymentName),
      async isAvailable() {
        const deploymentList = await getModels();
        return !!deploymentList?.data.some((deployment) => deployment.id === deploymentName && deployment.status === "succeeded");
      },
      ...modelSpec,
    } as ChatModelSpec;
  }

  await modelRegistry.chat.registerAllModelSpecs([
    generateModelSpec("deepseek-v3-0324", {
      costPerMillionInputTokens: 0.0,
      costPerMillionOutputTokens: 0.0,
      reasoningText: 6,
      intelligence: 5,
      tools: 4,
      speed: 3,
      contextLength: 65536,
    }),
  ]);
}