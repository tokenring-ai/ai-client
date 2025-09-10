import {createOpenAICompatible} from "@ai-sdk/openai-compatible";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import type {EmbeddingModelSpec as EmbeddingModelSpec} from "../client/AIEmbeddingClient.ts";
import ModelRegistry, {ModelProviderInfo} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

export type OAICompatibleModelConfigFunction = (modelInfo: ModelListData) => ModelConfigResults;

export type OAICompatibleModelConfig = ModelProviderInfo & {
  apiKey?: string;
  baseURL: string;
  generateModelSpec: OAICompatibleModelConfigFunction
}
type ModelConfigResults = {
  type: string;
  capabilities?: any;
}
type ModelListData = {
  id: string,
  object: "model",
  owned_by: "organization" | "openai",
  created: number,
}

type ModelListResponse = {
  object: "list",
  data: ModelListData[],
}

export async function init(modelRegistry: ModelRegistry, config: OAICompatibleModelConfig) {
  const {baseURL, apiKey, generateModelSpec} = config;
  if (!baseURL) {
    throw new Error("No config.baseURL provided for VLLM provider.");
  }
  if (!generateModelSpec) {
    throw new Error("No config.generateModelSpec provided for VLLM provider.");
  }

  const chatModelSpecs: Record<string, ChatModelSpec> = {};
  const embeddingModelSpecs: Record<string, EmbeddingModelSpec> = {};

  const openai = createOpenAICompatible({
    name: config.providerDisplayName,
    baseURL,
    apiKey,
  });

  const getModelList = cachedDataRetriever(`${baseURL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    cacheTime: 60000,
    timeout: 5000,
  }) as () => Promise<ModelListResponse>;


  getModelList().then(modelList => {
    if (!modelList?.data) return;

    for (const modelInfo of modelList.data) {
      const {type, capabilities = {}} = generateModelSpec(modelInfo);

      if (type === "chat") {
        chatModelSpecs[modelInfo.id] = {
          providerDisplayName: config.providerDisplayName,
          name: modelInfo.id,
          impl: openai.chatModel(modelInfo.id),
          isAvailable: () => getModelList().then((data) => !!data),
          isHot: () => Promise.resolve(true),
          ...capabilities,
        };
      } else if (type === "embedding") {
        embeddingModelSpecs[modelInfo.id] = {
          providerDisplayName: config.providerDisplayName,
          contextLength: capabilities.contextLength || 8192,
          costPerMillionInputTokens: capabilities.costPerMillionInputTokens || 0,
          impl: openai.textEmbeddingModel(modelInfo.id),
          isAvailable: () => getModelList().then((data) => !!data),
          isHot: () => Promise.resolve(true),
        };
      }
    }

    if (Object.keys(chatModelSpecs).length > 0) {
      modelRegistry.chat.registerAllModelSpecs(chatModelSpecs);
    }

    if (Object.keys(embeddingModelSpecs).length > 0) {
      modelRegistry.embedding.registerAllModelSpecs(embeddingModelSpecs);
    }
  }).catch(e => {

  });
}

