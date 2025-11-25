import TokenRingApp from "@tokenring-ai/app";
import {abandon} from "@tokenring-ai/utility/promise/abandon";
import {createOllama} from "ollama-ai-provider-v2";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.js";
import type {EmbeddingModelSpec} from "../client/AIEmbeddingClient.js";
import {ChatModelRegistry, EmbeddingModelRegistry} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

export type OllamaModelConfigFunction = (
  modelInfo: OllamaModelTagItem,
) => ModelConfigResults;

export const OllamaModelProviderConfigSchema = z.object({
  baseURL: z.string(),
  generateModelSpec: z.function({
    input: z.tuple([z.any()]),
    output: z.object({
      type: z.string(),
      capabilities: z.any().optional(),
    }),
  }),
});

export type OllamaModelProviderConfig = z.infer<
  typeof OllamaModelProviderConfigSchema
>;

function defaultModelSpecGenerator(modelInfo: OllamaModelTagItem): ModelConfigResults {
  let {model} = modelInfo;
  let type = "chat";
  if (model.match(/embed/i)) {
    type = "embedding";
  }
  return {type};
}


type ModelConfigResults = {
  type: string;
  capabilities?: any;
};

type OllamaModelTagItem = {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: Record<string, ModelDetails>;
};

type ModelTagResponse = {
  models: OllamaModelTagItem[];
};

type ModelDetails = {
  parent_model: string;
  format: string;
  family: string;
  families: string[];
  parameter_size: string;
  quantization_level: string;
};

type ModelPsItem = {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: Record<string, ModelDetails>;
  expires_at: string;
  size_vram: number;
};

type ModelPsResponse = {
  models: ModelPsItem[];
};

export async function init(
  providerDisplayName: string,
  config: OllamaModelProviderConfig,
  app: TokenRingApp,
) {
  let {baseURL, generateModelSpec} = config;
  if (!baseURL) {
    throw new Error("No config.baseURL provided for Ollama provider.");
  }

  generateModelSpec ??= defaultModelSpecGenerator;

  const chatModelSpecs: ChatModelSpec[] = [];
  const embeddingModelSpecs: EmbeddingModelSpec[] = [];

  const ollama = createOllama({baseURL});
  const getModelList = cachedDataRetriever(`${baseURL}/tags`, {
    headers: {},
    cacheTime: 60000,
    timeout: 1000,
  }) as () => Promise<ModelTagResponse>;
  const getRunningModels = cachedDataRetriever(`${baseURL}/ps`, {
    headers: {},
    cacheTime: 60000,
    timeout: 1000,
  }) as () => Promise<ModelPsResponse>;

  abandon(getRunningModels()); // In background, fetch the list of running models.

  const modelList = await getModelList();
  if (!modelList?.models) return;

  for (const modelInfo of modelList.models) {
    const {type, capabilities = {}} = generateModelSpec(modelInfo);

    if (type === "chat") {
      chatModelSpecs.push({
        modelId: modelInfo.model,
        providerDisplayName: providerDisplayName,
        impl: ollama.chat(modelInfo.model),
        isAvailable: () => getModelList().then((data) => !!data),
        isHot: () =>
          capabilities.alwaysHot ||
          getRunningModels().then((result) =>
            result?.models?.find?.((row) => modelInfo.model === row.model),
          ),
        ...capabilities,
      });
    } else if (type === "embedding") {
      embeddingModelSpecs.push({
        modelId: modelInfo.model,
        providerDisplayName: providerDisplayName,
        impl: ollama.embedding(modelInfo.model),
        contextLength: 2048,
        costPerMillionInputTokens: 0,
        isAvailable: () => getModelList().then((data) => !!data),
        isHot: () =>
          capabilities.alwaysHot ||
          getRunningModels().then((result) =>
            result?.models?.find?.((row) => modelInfo.model === row.model),
          ),
      });
    }
  }

  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs(chatModelSpecs);
  });
  
  app.waitForService(EmbeddingModelRegistry, embeddingModelRegistry => {
    embeddingModelRegistry.registerAllModelSpecs(embeddingModelSpecs);
  });
}
