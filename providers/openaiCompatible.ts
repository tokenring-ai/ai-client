import {createOpenAICompatible} from "@ai-sdk/openai-compatible";
import {xai} from "@ai-sdk/xai";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import type {EmbeddingModelSpec as EmbeddingModelSpec} from "../client/AIEmbeddingClient.ts";
import {ChatModelRegistry, EmbeddingModelRegistry} from "../ModelRegistry.ts";
import type {SettingDefinition} from "../ModelTypeRegistry.ts";
import {AIModelProvider} from "../schema.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

const OAICompatibleModelConfigSchema = z.object({
  provider: z.literal('openaiCompatible'),
  apiKey: z.string().optional(),
  baseURL: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.string()).optional(),
  includeUsage: z.boolean().optional(),
  supportsStructuredOutputs: z.boolean().optional(),
  defaultContextLength: z.number().default(32000),
  generateModelSpec: z.function({
    input: z.tuple([z.any()]),
    output: z.object({
      type: z.string(),
      capabilities: z.record(z.string(), z.any()).optional(),
    })
  }).optional(),
});

function defaultModelSpecGenerator(modelInfo: ModelListData): ModelConfigResults {
  let {id} = modelInfo;
  let type = "chat";
  if (id.match(/embed/i)) {
    type = "embedding";
  }
  return {type};
}

type ModelConfigResults = {
  type: string;
  capabilities?: Record<string, any>;
};
type ModelListData = {
  id: string;
  object: "model";
  owned_by: "organization" | "openai";
  created: number;
  max_model_len?: number;
  permission?: { allow_sampling?: boolean}[],
  meta?: {
    n_ctx_train?: 131072;
  };
};

type ModelListResponse = {
  object: "list";
  data: ModelListData[];
};

type PropsResponse = {
  default_generation_settings?: {
    n_ctx?: number;
    "params"?: {
      "top_k"? : number,
      "min_p"? : number,
      "repetition_penalty"? : number,
      "length_penalty"? : number,
      "min_tokens"? : number,
    }
  };
};

async function init(
  providerDisplayName: string,
  config: z.output<typeof OAICompatibleModelConfigSchema>,
  app: TokenRingApp,
) {
  let {
    baseURL,
    apiKey,
    generateModelSpec,
    supportsStructuredOutputs = true,
    queryParams,
    includeUsage = true,
    headers
  } = config;
  if (!baseURL) {
    throw new Error(
      `No config.baseURL provided for ${providerDisplayName} provider.`,
    );
  }
  generateModelSpec ??= defaultModelSpecGenerator;

  const chatModelSpecs: ChatModelSpec[] = [];
  const embeddingModelSpecs: EmbeddingModelSpec[] = [];

  const openai = createOpenAICompatible({
    name: providerDisplayName,
    baseURL,
    apiKey,
    supportsStructuredOutputs,
    queryParams,
    includeUsage,
    headers,
  });

  const getModelList = cachedDataRetriever(`${baseURL}/models`, {
    headers: {
      ...(apiKey && {Authorization: `Bearer ${apiKey}`}),
      ...headers,
      "Content-Type": "application/json",
    },
    cacheTime: 60000,
    timeout: 5000,
  }) as () => Promise<ModelListResponse>;

  const getProps = cachedDataRetriever(`${baseURL.replace("/v1", "")}/props`, {
    headers: {
      ...(apiKey && {Authorization: `Bearer ${apiKey}`}),
      ...headers,
      "Content-Type": "application/json",
    },
    cacheTime: 60000,
    timeout: 5000,
  }) as () => Promise<PropsResponse>;

  const modelList = await getModelList();
  if (!modelList?.data) return;

  let propsResponse = await getProps().catch(() => undefined);

  for (const modelInfo of modelList.data) {
    const {type, capabilities = {}} = generateModelSpec(modelInfo);

    if (type === "chat") {
      // Context length priority: max_model_len > n_ctx from props > 32000 fallback
      const maxContextLength =
        modelInfo.max_model_len ??
        propsResponse?.default_generation_settings?.n_ctx ??
        config.defaultContextLength;

      const isVLLMAndAllowsSampling = modelInfo.permission?.[0]?.allow_sampling;

      const settings: Record<string, SettingDefinition> = {
        temperature: {
          description: "What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.",
          type: "number",
          min: 0,
          max: 2,
        },
        top_p: {
          description: "An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.",
          type: "number",
          min: 0,
          max: 1,
        },
        frequency_penalty: {
          description: "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.",
          type: "number",
          min: -2,
          max: 2,
        },
        presence_penalty: {
          description: "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.",
          type: "number",
          min: -2,
          max: 2,
        },
        seed: {
          description: "Seed for the model generation. Setting this value allows consistent results across API calls.",
          type: "number",
        }
      };


      if (isVLLMAndAllowsSampling || propsResponse?.default_generation_settings?.params?.top_k) {
        settings.top_k = {
          description: "Reduces the probability of generating nonsense. A higher value (e.g. 100) will give more diverse answers, while a lower value (e.g. 10) will be more conservative.",
          type: "number",
          min: 0,
          max: 100,
        };
      }
      if (isVLLMAndAllowsSampling || propsResponse?.default_generation_settings?.params?.min_p) {
        settings.min_p = {
          description: "Sets a minimum probability threshold for tokens relative to the most likely token. Helps filter out low-probability noise.",
          type: "number",
          min: 0,
          max: 1,
        };
      }
      if (isVLLMAndAllowsSampling || propsResponse?.default_generation_settings?.params?.repetition_penalty) {
        settings.repetition_penalty = {
          description: "Sets how strongly to penalize tokens based on their existing presence in the text. 1.0 is neutral, higher values discourage repetition.",
          type: "number",
          min: 1,
          max: 2,
        };
      }
      if (isVLLMAndAllowsSampling || propsResponse?.default_generation_settings?.params?.length_penalty) {
        settings.length_penalty = {
          description: "Adjusts the probability of shorter or longer completions. Values > 1.0 favor longer sequences.",
          type: "number",
          min: 0,
          max: 5,
        };
      }
      if (isVLLMAndAllowsSampling || propsResponse?.default_generation_settings?.params?.min_tokens) {
        settings.min_tokens = {
          description: "The minimum number of tokens the model must generate before it can stop.",
          type: "number",
          min: 0,
        }
      }

      chatModelSpecs.push({
        modelId: modelInfo.id,
        providerDisplayName: providerDisplayName,
        impl: openai.chatModel(modelInfo.id),
        isAvailable: () => getModelList().then((data) => !!data),
        isHot: () => Promise.resolve(true),
        costPerMillionInputTokens: 0,
        costPerMillionOutputTokens: 0,
        maxContextLength,
        settings,
        mangleRequest(req, settings) {
          // General OpenAI settings
          const providerOptions = req.providerOptions ??= {};
          const ourOptions = providerOptions[providerDisplayName] ??= {};
          if (settings.has("temperature")) req.temperature = settings.get("temperature") as number;
          if (settings.has("top_p")) req.topP = settings.get("top_p") as number;
          if (settings.has("presence_penalty")) req.presencePenalty = settings.get("presence_penalty") as number;
          if (settings.has("frequency_penalty")) req.frequencyPenalty = settings.get("frequency_penalty") as number;
          if (settings.has("seed")) req.seed = settings.get("seed") as number;

          // VLLM Specific settings
          if (settings.has("top_k")) req.topK = settings.get("top_k") as number;
          if (settings.has("min_p")) ourOptions.min_p = settings.get("min_p") as number;
          if (settings.has("repetition_penalty")) ourOptions.repetition_penalty = settings.get("repetition_penalty") as number;
          if (settings.has("length_penalty")) ourOptions.length_penalty = settings.get("length_penalty") as number;
          if (settings.has("min_tokens")) ourOptions.min_tokens = settings.get("min_tokens") as number;
        },
        ...capabilities,
      });
    } else if (type === "embedding") {
      embeddingModelSpecs.push({
        modelId: modelInfo.id,
        providerDisplayName: providerDisplayName,
        contextLength: capabilities.contextLength || 8192,
        costPerMillionInputTokens:
          capabilities.costPerMillionInputTokens || 0,
        impl: openai.embeddingModel(modelInfo.id),
        isAvailable: () => getModelList().then((data) => !!data),
        isHot: () => Promise.resolve(true),
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

export default {
  providerCode: 'openaiCompatible',
  configSchema: OAICompatibleModelConfigSchema,
  init
} satisfies AIModelProvider<typeof OAICompatibleModelConfigSchema>;
