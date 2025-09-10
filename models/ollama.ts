import {abandon} from "@tokenring-ai/utility/abandon";
import {createOllama} from "ollama-ai-provider";
import {ChatModelSpec} from "../client/AIChatClient.js";
import {EmbeddingModelSpec} from "../client/AIEmbeddingClient.js";
import ModelRegistry, {ModelProviderInfo} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";


export type OllamaModelConfigFunction = (modelInfo: OllamaModelTagItem) => ModelConfigResults;

export interface OllamaModelProviderConfig extends ModelProviderInfo {
  baseURL: string;
  generateModelSpec: OllamaModelConfigFunction;
}

type ModelConfigResults = {
  type: string;
  capabilities?: any;
}

type OllamaModelTagItem = {
  "name": string,
  "model": string,
  "modified_at": string;
  "size": number,
  "digest": string;
  "details": Record<string, ModelDetails>,
}

type ModelTagResponse = {
  "models": OllamaModelTagItem[],
}

type ModelDetails = {
  "parent_model": string,
  "format": string,
  "family": string,
  "families": string[],
  "parameter_size": string,
  "quantization_level": string,
};

type ModelPsItem = {
  "name": string,
  "model": string,
  "size": number,
  "digest": string,
  "details": Record<string, ModelDetails>,
  "expires_at": string,
  "size_vram": number,
}

type ModelPsResponse = {
  "models": ModelPsItem[],
}

export async function init(modelRegistry: ModelRegistry, config: OllamaModelProviderConfig) {
  const {baseURL, generateModelSpec} = config;
  if (!baseURL) {
    throw new Error("No config.baseURL provided for Ollama provider.");
  }
  if (!generateModelSpec) {
    throw new Error(
      "No config.generateModelSpec provided for Ollama provider.",
    );
  }

  const chatModelSpecs: Record<string, ChatModelSpec> = {};
  const embeddingModelSpecs: Record<string, EmbeddingModelSpec> = {};

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
      chatModelSpecs[modelInfo.model] = {
        providerDisplayName: config.providerDisplayName,
        name: modelInfo.model,
        impl: ollama.chat(modelInfo.model),
        isAvailable: () => getModelList().then((data) => !!data),
        isHot: () =>
          capabilities.alwaysHot ||
          getRunningModels().then(result =>
            result?.models?.find?.(row => modelInfo.model === row.model),
          ),
        ...capabilities,
      };
    } else if (type === "embedding") {
      embeddingModelSpecs[modelInfo.model] = {
        providerDisplayName: config.providerDisplayName,
        name: modelInfo.model,
        impl: ollama.embedding(modelInfo.model),
        isAvailable: () => getModelList().then((data) => !!data),
        isHot: () =>
          capabilities.alwaysHot ||
          getRunningModels().then(result =>
            result?.models?.find?.(row => modelInfo.model === row.model),
          ),
      };
    }
  }

  if (Object.keys(chatModelSpecs).length > 0) {
    modelRegistry.chat.registerAllModelSpecs(chatModelSpecs);
  }

  if (Object.keys(embeddingModelSpecs).length > 0) {
    modelRegistry.embedding.registerAllModelSpecs(embeddingModelSpecs);
  }
}
