import {openrouter} from "@openrouter/ai-sdk-provider";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import ModelRegistry, {ModelProviderInfo} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

interface ModelData {
  id: string;
  canonical_slug: string;
  hugging_face_id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: {
    modality: string;
    input_modalities: string[];
    output_modalities: string[];
    tokenizer: string;
    instruct_type: string | null;
  };
  pricing: {
    prompt: string;
    completion: string;
    request: string;
    image: string;
    audio: string;
    web_search: string;
    internal_reasoning: string;
  };
  topProvider: {
    context_length: number;
    max_completion_tokens: number | null;
    is_moderated: boolean;
  };
  per_request_limits: any | null; // You may want to define a more specific type based on your use case
  supported_parameters: string[];
}

interface ApiResponse {
  data: ModelData[];
}

export interface OpenRouterModelProviderConfig extends ModelProviderInfo {
  apiKey: string;
  modelFilter?: ModelFilter
}

type ModelFilter = (model: ModelData) => boolean;

const providerName = "OpenRouter";

// Function to safely convert pricing string to number (cost per million tokens)
function parsePricing(priceString: string | null | undefined): number {
  if (
    priceString === null ||
    priceString === undefined ||
    priceString === "0"
  ) {
    return 0;
  }
  const price = Number.parseFloat(priceString);
  return Number.isNaN(price) ? 0 : price * 1000000;
}

async function fetchAndRegisterOpenRouterModels(modelRegistry: ModelRegistry, config: OpenRouterModelProviderConfig) {
  const getModels = cachedDataRetriever("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  }) as () => Promise<ApiResponse | null>;

  const modelsData = await getModels();
  if (modelsData == null) return;

  const isAvailable = async () => true; // Models are available if we got data

  const chatModelsSpec: ChatModelSpec[] = [];

  for (const model of modelsData.data) {
    if (!model.id) {
      continue;
    }

    if (config.modelFilter) {
      if (!config.modelFilter(model)) {
        continue;
      }
    }

    const isChatModel =
      model.architecture?.output_modalities?.includes("text") &&
      model.architecture?.input_modalities?.includes("text");

    if (isChatModel) {
      chatModelsSpec.push({
        modelId: model.id,
        providerDisplayName: config.providerDisplayName,
        impl: openrouter(model.id),
        isAvailable,
        contextLength:
          model.context_length || model.topProvider?.context_length || 4096,
        maxCompletionTokens: model.topProvider?.max_completion_tokens ?? undefined,
        costPerMillionInputTokens: parsePricing(
          model.pricing?.prompt,
        ),
        costPerMillionOutputTokens: parsePricing(
          model.pricing?.completion,
        ),
        //reasoning: model.supported_parameters?.includes('include_reasoning') ? 2 : 0,
        //tools: model.supported_parameters?.includes('tools') ? 2 : 0,
        //webSearch: model.pricing?.web_search && model.pricing?.web_search !== "0" && model.pricing?.web_search !== null ? 1 : 0,
      });
    }
  }

  if (chatModelsSpec.length > 0) {
    modelRegistry.chat.registerAllModelSpecs(chatModelsSpec);
  }
}

export async function init(modelRegistry: ModelRegistry, config: OpenRouterModelProviderConfig) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for OpenRouter provider.");
  }

  await fetchAndRegisterOpenRouterModels(modelRegistry, config);
}
