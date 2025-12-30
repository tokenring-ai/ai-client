import {createAzure} from "@ai-sdk/azure";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import {ChatModelRegistry} from "../ModelRegistry.ts";
import {AIModelProvider} from "../schema.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

const AzureModelProviderConfigSchema = z.object({
  provider: z.literal('azure'),
  apiKey: z.string(),
  baseURL: z.string(),
});

interface Deployment {
  id: string;
  model: string;
  status: string;
}

interface DeploymentList {
  data: Deployment[];
}

async function init(
  providerDisplayName: string,
  config: z.output<typeof AzureModelProviderConfigSchema>,
  app: TokenRingApp,
) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for Azure provider.");
  }

  if (!config.baseURL) {
    throw new Error("config.baseURL must be provided for Azure provider.");
  }

  const getModels = cachedDataRetriever(
    `${config.baseURL}/openai/deployments?api-version=2023-05-15`,
    {
      headers: {
        "api-key": config.apiKey,
      },
    },
  ) as () => Promise<DeploymentList | null>;

  const azureProvider = createAzure({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  function generateModelSpec(
    deploymentName: string,
    modelSpec: Omit<
      ChatModelSpec,
      "isAvailable" | "provider" | "providerDisplayName" | "impl" | "modelId"
    >,
  ): ChatModelSpec {
    return {
      modelId: deploymentName,
      providerDisplayName: providerDisplayName,
      impl: azureProvider(deploymentName),
      async isAvailable() {
        const deploymentList = await getModels();
        return !!deploymentList?.data.some(
          (deployment) =>
            deployment.id === deploymentName &&
            deployment.status === "succeeded",
        );
      },
      ...modelSpec,
    } satisfies ChatModelSpec;
  }

  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs([
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
  });
}

export default {
  providerCode: 'azure',
  configSchema: AzureModelProviderConfigSchema,
  init
} satisfies AIModelProvider<typeof AzureModelProviderConfigSchema>;
