import {abandon} from "@token-ring/utility/abandon";
import {createOllama} from "ollama-ai-provider";
import ModelRegistry, {ModelConfig} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

const providerName = "Ollama";

export type OllamaModelConfigFunction = (modelInfo: OllamaModelTagItem) => ModelConfigResults;

export type OllamaModelConfig = ModelConfig & {
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

export async function init(modelRegistry: ModelRegistry, config: ModelConfig) {
  const {baseURL, generateModelSpec} = config as OllamaModelConfig;
  if (!baseURL) {
    throw new Error("No config.baseURL provided for Ollama provider.");
  }
  if (!generateModelSpec) {
    throw new Error(
      "No config.generateModelSpec provided for Ollama provider.",
    );
  }

  const chatModelSpecs: Record<string, any> = {};
  const embeddingModelSpecs: Record<string, any> = {};

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

  const modelList = await getModelList() as ModelTagResponse;
  if (!modelList?.models) return;

  for (const modelInfo of modelList.models) {
    const {type, capabilities = {}} = generateModelSpec(modelInfo);

    if (type === "chat") {
      chatModelSpecs[modelInfo.model] = {
        provider: config.provider ?? providerName,
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
        provider: providerName,
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
