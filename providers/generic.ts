import { setTimeout as delay } from "node:timers/promises";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenResponses } from "@ai-sdk/open-responses";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { EmbeddingModelV3, LanguageModelV3 } from "@ai-sdk/provider";
import type TokenRingApp from "@tokenring-ai/app";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import type { MaybePromise } from "bun";
import { z } from "zod";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
import type { EmbeddingModelSpec } from "../client/AIEmbeddingClient.ts";
import { ChatModelRegistry, EmbeddingModelRegistry } from "../ModelRegistry.ts";
import type { SettingDefinition } from "../ModelTypeRegistry.ts";
import type { AIModelProvider } from "../schema.ts";

const GenericModelConfigSchema = z.object({
  provider: z.literal("generic"),
  endpointType: z.enum(["openai", "anthropic", "responses"]).default("openai"),
  apiKey: z.string().exactOptional(),
  baseURL: z.string(),
  chatEndpointURL: z.string().exactOptional(),
  modelListUrl: z.string().exactOptional(),
  modelPropsUrl: z.string().exactOptional(),
  headers: z.record(z.string(), z.string()).exactOptional(),
  queryParams: z.record(z.string(), z.string()).exactOptional(),
  includeUsage: z.boolean().exactOptional(),
  supportsStructuredOutputs: z.boolean().exactOptional(),
  defaultContextLength: z.number().default(32000),
  generateModelSpec: z
    .function({
      input: z.tuple([z.any()]),
      output: z.object({
        type: z.string(),
        capabilities: z.record(z.string(), z.any()).exactOptional(),
      }),
    })
    .exactOptional(),
  staticModelList: z.any().exactOptional(),
});

type EndpointType = "openai" | "anthropic" | "responses";

interface UnderlyingProvider {
  type: EndpointType;

  getLanguageModel(modelId: string): LanguageModelV3;

  getEmbeddingModel(modelId: string): EmbeddingModelV3 | null;

  buildSettings(modelInfo: GenericModelListData, propsResponse: PropsResponse | null): Record<string, SettingDefinition>;

  mangleRequest: (req: any, settings: Map<string, unknown>) => void;

  inputCapabilities?: { image?: boolean; file?: boolean };
}

function defaultModelSpecGenerator(modelInfo: GenericModelListData): GenericModelConfigResults {
  const { id } = modelInfo;
  let type = "chat";
  if (id.match(/embed/i)) {
    type = "embedding";
  }
  return { type };
}

export type GenericModelConfigResults = {
  type: string;
  capabilities?: Record<string, any>;
};

export type GenericModelListData = {
  id: string;
  object: "model";
  owned_by: string;
  created: number;
  display_name?: string;
  max_model_len?: number;
  permission?: { allow_sampling?: boolean | undefined }[];
  meta?: {
    n_ctx_train?: number;
  };
};

export type GenericModelListResponse = {
  object?: "list";
  data: GenericModelListData[];
  first_id?: string;
  has_more?: boolean;
  last_id?: string;
};

type PropsResponse = {
  default_generation_settings?: {
    n_ctx?: number;
    params?: {
      top_k?: number;
      min_p?: number;
      repetition_penalty?: number;
      length_penalty?: number;
      min_tokens?: number;
    };
  };
};

/**
 * Resolves the chat endpoint URL based on the endpoint type and base URL.
 */
function resolveChatEndpointURL(baseURL: string, endpointType: EndpointType, chatEndpointURL?: string): string {
  if (chatEndpointURL) return chatEndpointURL;

  const base = baseURL.replace(/\/+$/, "");

  switch (endpointType) {
    case "openai":
      return `${base}/chat/completions`;
    case "responses":
      return `${base}/responses`;
    case "anthropic":
      return `${base}/messages`;
  }
}

/**
 * Builds OpenAI-compatible settings based on model info and props response.
 */
function buildOpenAISettings(modelInfo: GenericModelListData, propsResponse: PropsResponse | null): Record<string, SettingDefinition> {
  const allowsSampling = modelInfo.permission?.[0]?.allow_sampling;

  const settings: Record<string, SettingDefinition> = {
    temperature: {
      description:
        "What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.",
      type: "number",
      min: 0,
      max: 2,
    },
    top_p: {
      description:
        "An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.",
      type: "number",
      min: 0,
      max: 1,
    },
    frequency_penalty: {
      description:
        "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.",
      type: "number",
      min: -2,
      max: 2,
    },
    presence_penalty: {
      description:
        "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.",
      type: "number",
      min: -2,
      max: 2,
    },
    seed: {
      description: "Seed for the model generation. Setting this value allows consistent results across API calls.",
      type: "number",
    },
  };

  if (allowsSampling || propsResponse?.default_generation_settings?.params?.top_k) {
    settings.top_k = {
      description:
        "Reduces the probability of generating nonsense. A higher value (e.g. 100) will give more diverse answers, while a lower value (e.g. 10) will be more conservative.",
      type: "number",
      min: 0,
      max: 100,
    };
  }
  if (allowsSampling || propsResponse?.default_generation_settings?.params?.min_p) {
    settings.min_p = {
      description: "Sets a minimum probability threshold for tokens relative to the most likely token. Helps filter out low-probability noise.",
      type: "number",
      min: 0,
      max: 1,
    };
  }
  if (allowsSampling || propsResponse?.default_generation_settings?.params?.repetition_penalty) {
    settings.repetition_penalty = {
      description: "Sets how strongly to penalize tokens based on their existing presence in the text. 1.0 is neutral, higher values discourage repetition.",
      type: "number",
      min: 1,
      max: 2,
    };
  }
  if (allowsSampling || propsResponse?.default_generation_settings?.params?.length_penalty) {
    settings.length_penalty = {
      description: "Adjusts the probability of shorter or longer completions. Values > 1.0 favor longer sequences.",
      type: "number",
      min: 0,
      max: 5,
    };
  }
  if (allowsSampling || propsResponse?.default_generation_settings?.params?.min_tokens) {
    settings.min_tokens = {
      description: "The minimum number of tokens the model must generate before it can stop.",
      type: "number",
      min: 0,
    };
  }

  if (modelInfo.owned_by === "vllm") {
    settings.enable_thinking = {
      description: "Enables thinking mode, which allows the model to generate longer sequences by leveraging the context it has seen so far.",
      type: "boolean",
    };
  }

  return settings;
}

/**
 * Creates the underlying AI SDK provider with all endpoint-specific behavior.
 */
function createUnderlyingProvider(
  providerDisplayName: string,
  endpointType: EndpointType,
  config: z.output<typeof GenericModelConfigSchema>,
): UnderlyingProvider {
  const { baseURL, apiKey, headers, queryParams, includeUsage = true, supportsStructuredOutputs = true } = config;
  const chatEndpointURL = resolveChatEndpointURL(baseURL, endpointType, config.chatEndpointURL);

  switch (endpointType) {
    case "openai": {
      const provider = createOpenAICompatible(
        stripUndefinedKeys({
          name: providerDisplayName,
          baseURL,
          apiKey,
          supportsStructuredOutputs,
          queryParams,
          includeUsage,
          headers,
        }),
      );

      return {
        type: "openai",
        getLanguageModel: modelId => provider.chatModel(modelId),
        getEmbeddingModel: modelId => provider.embeddingModel(modelId),
        buildSettings: buildOpenAISettings,
        mangleRequest(req, settings) {
          const providerOptions = (req.providerOptions ??= {});
          const ourOptions = (providerOptions[providerDisplayName] ??= {});
          if (settings.has("temperature")) req.temperature = settings.get("temperature") as number;
          if (settings.has("top_p")) req.topP = settings.get("top_p") as number;
          if (settings.has("presence_penalty")) req.presencePenalty = settings.get("presence_penalty") as number;
          if (settings.has("frequency_penalty")) req.frequencyPenalty = settings.get("frequency_penalty") as number;
          if (settings.has("seed")) req.seed = settings.get("seed") as number;
          if (settings.has("top_k")) req.topK = settings.get("top_k") as number;
          if (settings.has("min_p")) ourOptions.min_p = settings.get("min_p") as number;
          if (settings.has("repetition_penalty")) ourOptions.repetition_penalty = settings.get("repetition_penalty") as number;
          if (settings.has("length_penalty")) ourOptions.length_penalty = settings.get("length_penalty") as number;
          if (settings.has("min_tokens")) ourOptions.min_tokens = settings.get("min_tokens") as number;
          if (settings.has("enable_thinking")) ourOptions.enable_thinking = !!settings.get("enable_thinking");
        },
      };
    }

    case "responses": {
      const provider = createOpenResponses(
        stripUndefinedKeys({
          name: providerDisplayName,
          url: chatEndpointURL,
          apiKey,
          headers,
        }),
      );

      return {
        type: "responses",
        getLanguageModel: modelId => provider.languageModel(modelId),
        getEmbeddingModel: () => null,
        buildSettings: buildOpenAISettings,
        mangleRequest(req, settings) {
          const providerOptions = (req.providerOptions ??= {});
          const ourOptions = (providerOptions[providerDisplayName] ??= {});
          if (settings.has("temperature")) req.temperature = settings.get("temperature") as number;
          if (settings.has("top_p")) req.topP = settings.get("top_p") as number;
          if (settings.has("presence_penalty")) req.presencePenalty = settings.get("presence_penalty") as number;
          if (settings.has("frequency_penalty")) req.frequencyPenalty = settings.get("frequency_penalty") as number;
          if (settings.has("seed")) req.seed = settings.get("seed") as number;
          if (settings.has("top_k")) req.topK = settings.get("top_k") as number;
          if (settings.has("min_p")) ourOptions.min_p = settings.get("min_p") as number;
          if (settings.has("repetition_penalty")) ourOptions.repetition_penalty = settings.get("repetition_penalty") as number;
          if (settings.has("length_penalty")) ourOptions.length_penalty = settings.get("length_penalty") as number;
          if (settings.has("min_tokens")) ourOptions.min_tokens = settings.get("min_tokens") as number;
          if (settings.has("enable_thinking")) ourOptions.enable_thinking = !!settings.get("enable_thinking");
        },
      };
    }

    case "anthropic": {
      const provider = createAnthropic(
        stripUndefinedKeys({
          apiKey,
          baseURL: chatEndpointURL.replace(/\/messages$/, ""),
          headers,
        }),
      );

      return {
        type: "anthropic",
        getLanguageModel: modelId => provider(modelId),
        getEmbeddingModel: () => null,
        inputCapabilities: { image: true, file: true },
        buildSettings() {
          return {
            caching: {
              description: "Enable context caching for this model",
              defaultValue: true,
              type: "boolean",
            },
            websearch: {
              description: "Enables web search",
              defaultValue: false,
              type: "boolean",
            },
            maxSearchUses: {
              description: "Maximum number of web searches Claude can perform (0 to disable)",
              defaultValue: 5,
              type: "number",
              min: 1,
              max: 20,
            },
          };
        },
        mangleRequest(req, settings) {
          const anthropicOptions = ((req.providerOptions ??= {}).anthropic ??= {});
          if (settings.get("caching") as boolean) {
            anthropicOptions.cacheControl = { type: "ephemeral" };
          }
          if (settings.get("websearch") as boolean) {
            (req.tools ??= {}).web_search = provider.tools.webSearch_20250305({
              maxUses: (settings.get("maxSearchUses") as number) ?? 5,
            });
          }
        },
      };
    }
  }
}

function createModelRegistryKey(providerDisplayName: string, modelId: string): string {
  return `${providerDisplayName}:${modelId}`.toLowerCase();
}

/**
 * Builds a chat model spec for registration
 */
function buildChatModelSpec(
  modelInfo: GenericModelListData,
  providerDisplayName: string,
  underlyingProvider: UnderlyingProvider,
  getModelList: () => MaybePromise<GenericModelListResponse | null>,
  propsResponse: PropsResponse | null,
  config: z.output<typeof GenericModelConfigSchema>,
  generateModelSpec: (modelInfo: GenericModelListData) => GenericModelConfigResults,
): ChatModelSpec | null {
  const { type, capabilities = {} } = generateModelSpec(modelInfo);

  if (type !== "chat") {
    return null;
  }

  const maxContextLength = modelInfo.max_model_len ?? propsResponse?.default_generation_settings?.n_ctx ?? config.defaultContextLength;

  const impl = underlyingProvider.getLanguageModel(modelInfo.id);
  if (!impl) return null;

  return {
    modelId: modelInfo.id,
    providerDisplayName,
    impl,
    isAvailable: async () => {
      const data = await getModelList();
      return !!data?.data?.some(m => m.id === modelInfo.id);
    },
    isHot: () => true,
    costPerMillionInputTokens: 0,
    costPerMillionOutputTokens: 0,
    maxContextLength,
    settings: underlyingProvider.buildSettings(modelInfo, propsResponse),
    mangleRequest: underlyingProvider.mangleRequest,
    ...(underlyingProvider.inputCapabilities && {
      inputCapabilities: underlyingProvider.inputCapabilities,
    }),
    ...capabilities,
  };
}

/**
 * Builds an embedding model spec for registration (only for openai endpoint type)
 */
function buildEmbeddingModelSpec(
  modelInfo: GenericModelListData,
  providerDisplayName: string,
  underlyingProvider: UnderlyingProvider,
  getModelList: () => MaybePromise<GenericModelListResponse | null>,
  generateModelSpec: (modelInfo: GenericModelListData) => GenericModelConfigResults,
): EmbeddingModelSpec | null {
  const { type, capabilities = {} } = generateModelSpec(modelInfo);

  if (type !== "embedding") {
    return null;
  }

  const impl = underlyingProvider.getEmbeddingModel(modelInfo.id);
  if (!impl) return null;

  return {
    modelId: modelInfo.id,
    providerDisplayName,
    contextLength: capabilities.contextLength || 8192,
    costPerMillionInputTokens: capabilities.costPerMillionInputTokens || 0,
    impl,
    isAvailable: async () => {
      const data = await getModelList();
      return !!data;
    },
    isHot: () => true,
  };
}

async function init(providerDisplayName: string, config: z.output<typeof GenericModelConfigSchema>, app: TokenRingApp) {
  let { baseURL, apiKey, endpointType, generateModelSpec, headers, staticModelList, modelListUrl, modelPropsUrl } = config;

  if (!baseURL) {
    throw new Error(`No config.baseURL provided for ${providerDisplayName} provider.`);
  }

  endpointType ??= "openai";
  generateModelSpec ??= defaultModelSpecGenerator;

  const underlyingProvider = createUnderlyingProvider(providerDisplayName, endpointType, config);

  // --- Model list retrieval ---
  let getModelList: () => MaybePromise<GenericModelListResponse | null>;

  if (staticModelList) {
    getModelList = () => staticModelList;
  } else {
    if (!modelListUrl) {
      if (endpointType === "anthropic") {
        const base = baseURL.replace(/\/+$/, "");
        modelListUrl = `${base}/models`;
      } else {
        const match = baseURL.match(/(.*\/v1\/?)/) || baseURL.match(/(.*)\/$/);
        modelListUrl = `${match ? match[1] : baseURL}/models`;
      }
    }

    const modelListHeaders: Record<string, string> = {
      ...headers,
      "Content-Type": "application/json",
    };

    if (endpointType === "anthropic") {
      if (apiKey) modelListHeaders["x-api-key"] = apiKey;
      modelListHeaders["anthropic-version"] = "2023-06-01";
    } else {
      if (apiKey) modelListHeaders.Authorization = `Bearer ${apiKey}`;
    }

    getModelList = cachedDataRetriever(modelListUrl, {
      headers: modelListHeaders,
      cacheTime: 60000,
      timeout: 5000,
    });
  }

  // --- Props retrieval (for openai/responses context length discovery) ---
  let getProps: (() => MaybePromise<PropsResponse | null>) | undefined;

  if (endpointType !== "anthropic") {
    if (!modelPropsUrl) {
      const match = baseURL.match(/(.*\/v1\/?)/) || baseURL.match(/(.*\/)/);
      if (match) {
        modelPropsUrl = `${match[1].replace(/\/+$/, "").replace(/\/v1$/, "")}/props`;
      }
    }

    if (modelPropsUrl) {
      getProps = cachedDataRetriever(modelPropsUrl, {
        headers: {
          ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
          ...headers,
          "Content-Type": "application/json",
        },
        cacheTime: 60000,
        timeout: 5000,
      });
    }
  }

  const modelList = await getModelList();
  if (!modelList?.data) return;

  const propsResponse = getProps ? await Promise.resolve(getProps()).catch(() => undefined) : undefined;

  const chatModelSpecs: ChatModelSpec[] = [];
  const embeddingModelSpecs: EmbeddingModelSpec[] = [];
  const registeredChatModels = new Set<string>();
  const registeredEmbeddingModels = new Set<string>();

  for (const modelInfo of modelList.data) {
    const chatSpec = buildChatModelSpec(modelInfo, providerDisplayName, underlyingProvider, getModelList, propsResponse ?? null, config, generateModelSpec);

    if (chatSpec) {
      chatModelSpecs.push(chatSpec);
      registeredChatModels.add(createModelRegistryKey(providerDisplayName, modelInfo.id));
    }

    if (underlyingProvider.type === "openai") {
      const embeddingSpec = buildEmbeddingModelSpec(modelInfo, providerDisplayName, underlyingProvider, getModelList, generateModelSpec);

      if (embeddingSpec) {
        embeddingModelSpecs.push(embeddingSpec);
        registeredEmbeddingModels.add(createModelRegistryKey(providerDisplayName, modelInfo.id));
      }
    }
  }

  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs(chatModelSpecs);
  });

  if (embeddingModelSpecs.length > 0) {
    app.waitForService(EmbeddingModelRegistry, embeddingModelRegistry => {
      embeddingModelRegistry.registerAllModelSpecs(embeddingModelSpecs);
    });
  }

  // --- Periodic new model discovery ---
  const checkForNewModels = async () => {
    const freshModelList = await getModelList();
    if (!freshModelList?.data) return;

    const freshPropsResponse = getProps ? await Promise.resolve(getProps()).catch(() => undefined) : undefined;

    for (const modelInfo of freshModelList.data) {
      const modelKey = createModelRegistryKey(providerDisplayName, modelInfo.id);

      if (registeredChatModels.has(modelKey) || registeredEmbeddingModels.has(modelKey)) {
        continue;
      }

      const chatSpec = buildChatModelSpec(
        modelInfo,
        providerDisplayName,
        underlyingProvider,
        getModelList,
        freshPropsResponse ?? null,
        config,
        generateModelSpec,
      );

      if (chatSpec) {
        registeredChatModels.add(modelKey);
        app.waitForService(ChatModelRegistry, chatModelRegistry => {
          chatModelRegistry.registerModelSpec(modelKey, chatSpec);
        });
      }

      if (underlyingProvider.type === "openai") {
        const embeddingSpec = buildEmbeddingModelSpec(modelInfo, providerDisplayName, underlyingProvider, getModelList, generateModelSpec);

        if (embeddingSpec) {
          registeredEmbeddingModels.add(modelKey);
          app.waitForService(EmbeddingModelRegistry, embeddingModelRegistry => {
            embeddingModelRegistry.registerModelSpec(modelKey, embeddingSpec);
          });
        }
      }
    }
  };

  const modelRegistry = app.requireService(ChatModelRegistry);
  app.runBackgroundTask(modelRegistry, async signal => {
    while (!signal.aborted) {
      try {
        await checkForNewModels();
      } catch (err: unknown) {
        app.serviceError(modelRegistry, `Error while checking for new models: `, err as Error);
      }

      await delay(60000, null, { signal });
    }
  });
}

export default {
  providerCode: "generic",
  configSchema: GenericModelConfigSchema,
  init,
} satisfies AIModelProvider<typeof GenericModelConfigSchema>;
