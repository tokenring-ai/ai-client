import { setTimeout as delay } from "node:timers/promises";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenResponses } from "@ai-sdk/open-responses";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { EmbeddingModelV4, LanguageModelV4 } from "@ai-sdk/provider";
import { imageMimeTypes, textMimeTypes } from "@tokenring-ai/agent/AgentEvents";
import type TokenRingApp from "@tokenring-ai/app";
import { dedupe } from "@tokenring-ai/utility/array/dedupe";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import type { MaybePromise } from "bun";
import { deepEquals } from "bun";
import { z } from "zod";
import type { ChatModelSpec, ParsedChatRequest } from "../client/AIChatClient.ts";
import type { EmbeddingModelSpec } from "../client/AIEmbeddingClient.ts";
import type { ModelInputCapabilities } from "../client/modelCapabilities.ts";
import { ModelProvider } from "../ModelProvider.ts";
import { ChatModelRegistry, EmbeddingModelRegistry } from "../ModelRegistry.ts";
import type { ModelSettings } from "../ModelTypeRegistry.ts";
import { ModelSettingsDefinitionSchema, type SettingDefinition } from "../ModelTypeRegistry.ts";

const ChatModelSchema = z.object({
  costPerMillionInputTokens: z.number().optional(),
  costPerMillionOutputTokens: z.number().optional(),
  maxContextLength: z.number().optional(),
  settings: z.record(z.string(), ModelSettingsDefinitionSchema).default({}),
});

const EmbeddingModelSchema = z.object({
  costPerMillionInputTokens: z.number().optional(),
  maxContextLength: z.number().optional(),
});

const ModelsSchema = z.object({
  chat: z.record(z.string(), ChatModelSchema).default({}),
  embedding: z.record(z.string(), EmbeddingModelSchema).default({}),
});

const GenericModelConfigSchema = z
  .object({
    provider: z.literal("generic"),
    endpointType: z.enum(["openai", "anthropic", "responses"]).default("openai").meta({ description: "Wire protocol the endpoint speaks" }),
    apiKey: z.string().exactOptional().meta({ sensitive: true, description: "API key sent to the endpoint (prefer Api Key From Env)" }),
    apiKeyFromEnv: z.string().exactOptional().meta({ description: "Name of an environment variable holding the API key" }),
    models: ModelsSchema.prefault({}),
    baseURL: z.string(),
    chatEndpointURL: z.string().exactOptional(),
    modelListUrl: z.string().exactOptional(),
    modelPropsUrl: z.string().exactOptional(),
    headers: z.record(z.string(), z.string()).exactOptional(),
    queryParams: z.record(z.string(), z.string()).exactOptional(),
    includeUsage: z.boolean().exactOptional(),
    supportsStructuredOutputs: z.boolean().exactOptional(),
    defaultContextLength: z.number().default(32000),
  })
  .transform(config => {
    const { baseURL, endpointType } = config;
    const base = baseURL.replace(/\/+$/, "");

    let chatEndpointURL = config.chatEndpointURL;
    if (!chatEndpointURL) {
      switch (endpointType) {
        case "openai":
          chatEndpointURL = `${base}/chat/completions`;
          break;
        case "responses":
          chatEndpointURL = `${base}/responses`;
          break;
        case "anthropic":
          chatEndpointURL = `${base}/messages`;
          break;
      }
    }

    let modelListUrl = config.modelListUrl;
    if (!modelListUrl) {
      if (endpointType === "anthropic") {
        modelListUrl = `${base}/models`;
      } else {
        const match = baseURL.match(/(.*\/v1\/?)/) || baseURL.match(/(.*)\/$/);
        modelListUrl = `${match ? match[1] : baseURL}/models`;
      }
    }

    let modelPropsUrl = config.modelPropsUrl;
    if (!modelPropsUrl && endpointType !== "anthropic") {
      const match = baseURL.match(/(.*\/v1\/?)/) || baseURL.match(/(.*\/)/);
      if (match) {
        modelPropsUrl = `${match[1]!.replace(/\/+$/, "").replace(/\/v1$/, "")}/props`;
      }
    }

    return {
      ...config,
      chatEndpointURL,
      modelListUrl,
      ...(modelPropsUrl && { modelPropsUrl }),
    };
  });

export type GenericModelConfig = z.output<typeof GenericModelConfigSchema>;
export type GenericModels = z.output<typeof ModelsSchema>;

type EndpointType = "openai" | "anthropic" | "responses";

interface UnderlyingProvider {
  type: EndpointType;
  mangleRequest?: (req: ParsedChatRequest, settings: ModelSettings) => void;
  inputCapabilities: ModelInputCapabilities;

  getLanguageModel(modelId: string): LanguageModelV4;

  getEmbeddingModel(modelId: string): EmbeddingModelV4 | null;

  buildSettings(modelInfo: GenericModelListData, propsResponse: PropsResponse | null): Record<string, SettingDefinition>;
}

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
  config: GenericModelConfig & { apiKey?: string | undefined },
): UnderlyingProvider {
  const { baseURL, apiKey, chatEndpointURL, headers, queryParams, includeUsage = true, supportsStructuredOutputs = true } = config;

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
        inputCapabilities: [...textMimeTypes],
        buildSettings: buildOpenAISettings,
        mangleRequest(req, settings) {
          const providerOptions = req.providerOptions;
          if (providerOptions[providerDisplayName] === undefined) {
            providerOptions[providerDisplayName] = {};
          }
          const ourOptions = providerOptions[providerDisplayName];
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
        inputCapabilities: [...textMimeTypes],
        buildSettings: buildOpenAISettings,
        mangleRequest(req, settings) {
          const providerOptions = req.providerOptions;
          if (providerOptions[providerDisplayName] === undefined) {
            providerOptions[providerDisplayName] = {};
          }
          const ourOptions = providerOptions[providerDisplayName];
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
        inputCapabilities: dedupe([...textMimeTypes, ...imageMimeTypes]),
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
          if (req.providerOptions.anthropic === undefined) {
            req.providerOptions.anthropic = {};
          }
          const anthropicOptions = req.providerOptions.anthropic;
          if (settings.get("caching") as boolean) {
            anthropicOptions.cacheControl = { type: "ephemeral" };
          }

          /* The following settings only apply to requests that use tools */
          if (!("tools" in req)) return;

          if (settings.get("websearch") as boolean) {
            req.tools.web_search = provider.tools.webSearch_20250305({
              maxUses: (settings.get("maxSearchUses") as number | undefined) ?? 5,
            });
          }
        },
      };
    }
  }
}

const SCAN_INTERVAL_MS = 60000;

export default class GenericAIProvider extends ModelProvider<GenericModelConfig> {
  static readonly providerCode = "generic" as const;
  static readonly configSchema = GenericModelConfigSchema;

  readonly name: string;
  readonly description = "Generic AI model provider";

  private config!: GenericModelConfig;
  private apiKey: string | undefined;
  private underlyingProvider!: UnderlyingProvider;
  private requestHeaders!: Record<string, string>;
  private getModelList!: () => MaybePromise<GenericModelListResponse | null>;
  private getProps: (() => MaybePromise<PropsResponse | null>) | undefined;

  private chatRegistry: ChatModelRegistry | undefined;
  private embeddingRegistry: EmbeddingModelRegistry | undefined;

  private registeredChatKeys = new Set<string>();
  private registeredEmbeddingKeys = new Set<string>();

  private readonly readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private readyResolved = false;

  constructor(
    providerDisplayName: string,
    config: GenericModelConfig,
    private readonly app: TokenRingApp,
  ) {
    super();
    this.name = providerDisplayName;

    this.readyPromise = new Promise<void>(resolve => {
      this.resolveReady = () => {
        if (this.readyResolved) return;
        this.readyResolved = true;
        resolve();
      };
    });

    this.app.waitForService(ChatModelRegistry, r => {
      this.chatRegistry = r;
    });
    this.app.waitForService(EmbeddingModelRegistry, r => {
      this.embeddingRegistry = r;
    });

    this.applyConfig(config);

    // Kick off the initial scan asynchronously so that ready() can resolve
    // before run() is invoked by the app loop.
    void this.runInitialScan();
  }

  async reconfigure(config: GenericModelConfig): Promise<void> {
    this.applyConfig(config);
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  async run(signal: AbortSignal): Promise<void> {
    await this.readyPromise;
    while (!signal.aborted) {
      try {
        await delay(SCAN_INTERVAL_MS, null, { signal });
      } catch {
        break;
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be mutated asynchronously
      if (signal.aborted) break;
      try {
        await this.scanAndReconfigure();
      } catch (err) {
        this.app.serviceError(this, "Error while scanning models:", err as Error);
      }
    }
  }

  private async runInitialScan(): Promise<void> {
    try {
      await this.scanAndReconfigure();
    } catch (err) {
      this.app.serviceError(this, "Initial model scan failed:", err as Error);
    } finally {
      this.resolveReady();
    }
  }

  private applyConfig(config: GenericModelConfig): void {
    this.config = config;
    this.apiKey = config.apiKey ?? (config.apiKeyFromEnv ? process.env[config.apiKeyFromEnv] : undefined);

    const requestHeaders: Record<string, string> = {
      ...config.headers,
      "Content-Type": "application/json",
    };
    if (config.endpointType === "anthropic") {
      if (this.apiKey) requestHeaders["x-api-key"] = this.apiKey;
      requestHeaders["anthropic-version"] = "2023-06-01";
    } else {
      if (this.apiKey) requestHeaders.Authorization = `Bearer ${this.apiKey}`;
    }
    this.requestHeaders = requestHeaders;

    this.underlyingProvider = createUnderlyingProvider(this.name, config.endpointType, this.apiKey !== undefined ? { ...config, apiKey: this.apiKey } : config);

    this.getModelList = cachedDataRetriever<GenericModelListResponse>(config.modelListUrl!, {
      headers: requestHeaders,
      cacheTime: 60000,
      timeout: 5000,
    });

    this.getProps = undefined;
    if (config.endpointType !== "anthropic" && config.modelPropsUrl) {
      this.getProps = cachedDataRetriever<PropsResponse>(config.modelPropsUrl, {
        headers: requestHeaders,
        cacheTime: 60000,
        timeout: 5000,
      });
    }

    this.syncModels();
  }

  private isEnabled(): boolean {
    if (this.config.apiKey) return true;
    if (this.config.apiKeyFromEnv) return !!this.apiKey;
    return true;
  }

  private buildChatSpecs(): ChatModelSpec[] {
    if (!this.isEnabled()) return [];
    return Object.entries(this.config.models.chat).map(([modelId, modelSpec]) => ({
      providerDisplayName: this.name,
      modelId,
      impl: this.underlyingProvider.getLanguageModel(modelId),
      isHot: () => true,
      costPerMillionInputTokens: modelSpec.costPerMillionInputTokens ?? 0,
      costPerMillionOutputTokens: modelSpec.costPerMillionOutputTokens ?? 0,
      maxContextLength: modelSpec.maxContextLength || this.config.defaultContextLength,
      settings: modelSpec.settings,
      ...(this.underlyingProvider.mangleRequest && { mangleRequest: this.underlyingProvider.mangleRequest }),
      isAvailable: async () => !!(await this.getModelList()),
      inputCapabilities: this.underlyingProvider.inputCapabilities,
    }));
  }

  private buildEmbeddingSpecs(): EmbeddingModelSpec[] {
    if (!this.isEnabled()) return [];
    if (this.config.endpointType !== "openai") return [];
    return Object.entries(this.config.models.embedding).map(([modelId, modelSpec]) => ({
      modelId,
      providerDisplayName: this.name,
      contextLength: modelSpec.maxContextLength || 8192,
      costPerMillionInputTokens: modelSpec.costPerMillionInputTokens ?? 0,
      impl: this.underlyingProvider.getEmbeddingModel(modelId)!,
      isAvailable: async () => !!(await this.getModelList()),
      isHot: () => true,
      inputCapabilities: [...textMimeTypes],
    }));
  }

  private syncModels(): void {
    this.syncChatModels(this.buildChatSpecs());
    this.syncEmbeddingModels(this.buildEmbeddingSpecs());
  }

  private syncChatModels(specs: ChatModelSpec[]): void {
    const newKeys = new Set<string>(specs.map(s => `${s.providerDisplayName}:${s.modelId}`.toLowerCase()));

    if (this.chatRegistry) {
      if (specs.length > 0) {
        this.chatRegistry.registerAllModelSpecs(specs);
      }
      for (const oldKey of this.registeredChatKeys) {
        if (!newKeys.has(oldKey)) {
          this.chatRegistry.modelSpecs.unregister(oldKey);
        }
      }
    }
    this.registeredChatKeys = newKeys;
  }

  private syncEmbeddingModels(specs: EmbeddingModelSpec[]): void {
    const newKeys = new Set<string>(specs.map(s => `${s.providerDisplayName}:${s.modelId}`.toLowerCase()));

    if (this.embeddingRegistry) {
      if (specs.length > 0) {
        this.embeddingRegistry.registerAllModelSpecs(specs);
      }
      for (const oldKey of this.registeredEmbeddingKeys) {
        if (!newKeys.has(oldKey)) {
          this.embeddingRegistry.modelSpecs.unregister(oldKey);
        }
      }
    }
    this.registeredEmbeddingKeys = newKeys;
  }

  private async scanAndReconfigure(): Promise<void> {
    if (!this.isEnabled()) return;

    const discovered = await scanModels(this.config);

    // Config-declared models win over discovered ones.
    const mergedChat = { ...discovered.chat, ...this.config.models.chat };
    const mergedEmbedding = { ...discovered.embedding, ...this.config.models.embedding };

    if (deepEquals(mergedChat, this.config.models.chat, true) && deepEquals(mergedEmbedding, this.config.models.embedding, true)) {
      return;
    }

    await this.reconfigure({
      ...this.config,
      models: { chat: mergedChat, embedding: mergedEmbedding },
    });
  }
}

/**
 * Determines whether a model is a chat or embedding model based on its id.
 */
function defaultModelTypeClassifier(modelInfo: GenericModelListData): "chat" | "embedding" {
  if (modelInfo.id.match(/embed/i)) {
    return "embedding";
  }
  return "chat";
}

/**
 * Scans a generic provider's `/models` (and optionally `/props`) endpoints
 * and builds a `ModelsSchema`-shaped object describing the discovered
 * chat and embedding models along with their settings and context lengths.
 */
export async function scanModels(
  config: GenericModelConfig,
  options?: {
    classifyModel?: (modelInfo: GenericModelListData) => "chat" | "embedding";
    buildSettings?: (modelInfo: GenericModelListData, propsResponse: PropsResponse | null) => Record<string, SettingDefinition>;
  },
): Promise<GenericModels> {
  const { apiKey: configApiKey, apiKeyFromEnv, endpointType, headers, modelListUrl, modelPropsUrl, defaultContextLength } = config;

  const apiKey = configApiKey ?? (apiKeyFromEnv ? process.env[apiKeyFromEnv] : undefined);

  const classifyModel = options?.classifyModel ?? defaultModelTypeClassifier;
  const buildSettings = options?.buildSettings ?? buildOpenAISettings;

  const requestHeaders: Record<string, string> = {
    ...headers,
    "Content-Type": "application/json",
  };

  if (endpointType === "anthropic") {
    if (apiKey) requestHeaders["x-api-key"] = apiKey;
    requestHeaders["anthropic-version"] = "2023-06-01";
  } else {
    if (apiKey) requestHeaders.Authorization = `Bearer ${apiKey}`;
  }

  const getModelList = cachedDataRetriever<GenericModelListResponse>(modelListUrl!, {
    headers: requestHeaders,
    cacheTime: 60000,
    timeout: 5000,
  });

  const modelList = await getModelList();
  if (!modelList?.data) {
    return { chat: {}, embedding: {} };
  }

  let propsResponse: PropsResponse | null = null;
  if (endpointType !== "anthropic" && modelPropsUrl) {
    const getProps = cachedDataRetriever<PropsResponse>(modelPropsUrl, {
      headers: requestHeaders,
      cacheTime: 60000,
      timeout: 5000,
    });
    propsResponse = (await Promise.resolve(getProps()).catch(() => null)) ?? null;
  }

  const result: GenericModels = {
    chat: {},
    embedding: {},
  };

  for (const modelInfo of modelList.data) {
    const modelType = classifyModel(modelInfo);
    const maxContextLength = modelInfo.max_model_len ?? propsResponse?.default_generation_settings?.n_ctx ?? defaultContextLength;

    switch (modelType) {
      case "chat":
        result.chat[modelInfo.id] = {
          maxContextLength,
          settings: buildSettings(modelInfo, propsResponse),
        };
        break;
      case "embedding":
        result.embedding[modelInfo.id] = {
          maxContextLength,
        };
        break;
      default: {
        const exhaustive: any = modelType satisfies never;
        throw new Error(`Unexpected model type: ${exhaustive}`);
      }
    }
  }

  return result;
}
