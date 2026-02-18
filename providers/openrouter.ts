import {openrouter} from "@openrouter/ai-sdk-provider";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import {ChatModelRegistry} from "../ModelRegistry.ts";
import {AIModelProvider} from "../schema.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

const OpenRouterModelProviderConfigSchema = z.object({
  provider: z.literal('openrouter'),
  apiKey: z.string(),
  modelFilter: z
    .function({
      input: z.tuple([z.any()]),
      output: z.boolean(),
    })
    .optional(),
});

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

async function fetchAndRegisterOpenRouterModels(
  providerDisplayName: string,
  config: z.output<typeof OpenRouterModelProviderConfigSchema>,
  app: TokenRingApp,
) {
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
        providerDisplayName: providerDisplayName,
        impl: openrouter(model.id),
        isAvailable,
        contextLength:
          model.context_length || model.topProvider?.context_length || 4096,
        maxCompletionTokens:
          model.topProvider?.max_completion_tokens ?? undefined,
        costPerMillionInputTokens: parsePricing(model.pricing?.prompt),
        costPerMillionOutputTokens: parsePricing(model.pricing?.completion),
        mangleRequest(req, settings) {
          const supported = model.supported_parameters || [];
          
          if (settings.websearch) {
            const plugins = ((req.providerOptions ??= {}).openrouter ??= {}).plugins ??= [];
            const webPlugin: any = { id: "web" };
            
            if (settings.searchEngine) {
              webPlugin.engine = settings.searchEngine;
            }
            if (settings.maxResults) {
              webPlugin.max_results = settings.maxResults;
            }
            if (settings.searchPrompt) {
              webPlugin.search_prompt = settings.searchPrompt;
            }
            
            plugins.push(webPlugin);
          }
          
          if (settings.searchContextSize) {
            const webSearchOptions = (req.providerOptions ??= {}).web_search_options ??= {};
            webSearchOptions.search_context_size = settings.searchContextSize;
          }

          const params: Record<string, any> = {};
          if (supported.includes('frequency_penalty') && settings.frequencyPenalty !== undefined) params.frequency_penalty = settings.frequencyPenalty;
          if (supported.includes('max_tokens') && settings.maxTokens !== undefined) params.max_tokens = settings.maxTokens;
          if (supported.includes('min_p') && settings.minP !== undefined) params.min_p = settings.minP;
          if (supported.includes('presence_penalty') && settings.presencePenalty !== undefined) params.presence_penalty = settings.presencePenalty;
          if (supported.includes('repetition_penalty') && settings.repetitionPenalty !== undefined) params.repetition_penalty = settings.repetitionPenalty;
          if (supported.includes('temperature') && settings.temperature !== undefined) params.temperature = settings.temperature;
          if (supported.includes('top_k') && settings.topK !== undefined) params.top_k = settings.topK;
          if (supported.includes('top_p') && settings.topP !== undefined) params.top_p = settings.topP;
          if (supported.includes('include_reasoning') && settings.includeReasoning !== undefined) params.include_reasoning = settings.includeReasoning;
          if (supported.includes('reasoning') && settings.reasoning !== undefined) params.reasoning = settings.reasoning;

          if (Object.keys(params).length > 0) {
            Object.assign((req.providerOptions ??= {}).openrouter ??= {}, params);
          }
        },
        settings: {
          websearch: { description: "Enables web search plugin", defaultValue: false, type: "boolean" },
          searchEngine: { description: "Search engine (native, exa, or undefined for auto)", defaultValue: undefined, type: "enum", values: ["native", "exa"] },
          maxResults: { description: "Maximum number of search results (default 5)", defaultValue: 5, type: "number", min: 0, max: 100 }, // TODO: The upper bound is not described in the docs
          searchContextSize: { description: "Search context size for native search", defaultValue: "low", type: "enum", values: ["low", "medium", "high"] },
          ...(model.supported_parameters?.includes('frequency_penalty') && { frequencyPenalty: { description: "Frequency penalty", type: "number", min: -2.0, max: 2.0 } }),
          ...(model.supported_parameters?.includes('max_tokens') && { maxTokens: { description: "Max tokens", type: "number", min: 1 } }),
          ...(model.supported_parameters?.includes('min_p') && { minP: { description: "Min P sampling", type: "number", min: 0, max: 1.0 } }),
          ...(model.supported_parameters?.includes('presence_penalty') && { presencePenalty: { description: "Presence penalty", type: "number", min: -2.0, max: 2.0 } }),
          ...(model.supported_parameters?.includes('repetition_penalty') && { repetitionPenalty: { description: "Repetition penalty", type: "number", min: 0, max: 2.0 } }),
          ...(model.supported_parameters?.includes('temperature') && { temperature: { description: "Temperature", type: "number", min: 0, max: 2.0 } }),
          ...(model.supported_parameters?.includes('top_k') && { topK: { description: "Top K sampling", type: "number", min: 0 } }),
          ...(model.supported_parameters?.includes('top_p') && { topP: { description: "Top P sampling", type: "number", min: 0, max: 1.0 } }),
          ...(model.supported_parameters?.includes('include_reasoning') && { includeReasoning: { description: "Include reasoning", type: "boolean" } }),
          ...(model.supported_parameters?.includes('reasoning') && { reasoning: { description: "Reasoning mode", type: "string" } }),
        },
        //reasoning: model.supported_parameters?.includes('include_reasoning') ? 2 : 0,
        //tools: model.supported_parameters?.includes('tools') ? 2 : 0,
        //webSearch: model.pricing?.web_search && model.pricing?.web_search !== "0" && model.pricing?.web_search !== null ? 1 : 0,
      });
    }
  }

  if (chatModelsSpec.length > 0) {
    app.waitForService(ChatModelRegistry, chatModelRegistry => {
      chatModelRegistry.registerAllModelSpecs(chatModelsSpec);
    });
  }
}

async function init(
  providerDisplayName: string,
  config: z.output<typeof OpenRouterModelProviderConfigSchema>,
  app: TokenRingApp,
) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for OpenRouter provider.");
  }

  await fetchAndRegisterOpenRouterModels(
    providerDisplayName,
    config,
    app,
  );
}

export default {
  providerCode: 'openrouter',
  configSchema: OpenRouterModelProviderConfigSchema,
  init
} satisfies AIModelProvider<typeof OpenRouterModelProviderConfigSchema>;
