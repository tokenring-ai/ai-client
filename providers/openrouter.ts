import { setTimeout as delay } from "node:timers/promises";
import type { JSONArray } from "@ai-sdk/provider";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { audioMimeTypes, imageMimeTypes, textMimeTypes, videoMimeTypes } from "@tokenring-ai/agent/AgentEvents";
import type TokenRingApp from "@tokenring-ai/app";
import { dedupe } from "@tokenring-ai/utility/array/dedupe";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import { z } from "zod";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
import { ModelProvider } from "../ModelProvider.ts";
import { ChatModelRegistry } from "../ModelRegistry.ts";

const OpenRouterModelProviderConfigSchema = z.object({
  provider: z.literal("openrouter"),
  apiKeyFromEnv: z
    .string()
    .default("OPENROUTER_API_KEY")
    .meta({ description: "Name of the environment variable holding the OpenRouter API key" } satisfies ConfigFieldMeta),
  modelFilter: z
    .function({
      input: z.tuple([z.any()]),
      output: z.boolean(),
    })
    .exactOptional(),
});

type OpenRouterConfig = z.output<typeof OpenRouterModelProviderConfigSchema>;

const ArchitectureSchema = z.object({
  modality: z.string(),
  input_modalities: z.array(z.string()),
  output_modalities: z.array(z.string()),
  tokenizer: z.string(),
  instruct_type: z.string().nullable(),
});

const PricingSchema = z.object({
  prompt: z.string(),
  completion: z.string(),
  request: z.string().exactOptional(),
  image: z.string().exactOptional(),
  audio: z.string().exactOptional(),
  web_search: z.string().exactOptional(),
  internal_reasoning: z.string().exactOptional(),
});

const TopProviderSchema = z.object({
  context_length: z.number(),
  max_completion_tokens: z.number().nullable(),
  is_moderated: z.boolean(),
});

const ModelDataSchema = z.object({
  id: z.string(),
  canonical_slug: z.string(),
  hugging_face_id: z.string().nullable(),
  name: z.string(),
  created: z.number(),
  description: z.string(),
  context_length: z.number(),
  architecture: ArchitectureSchema,
  pricing: PricingSchema,
  topProvider: TopProviderSchema.exactOptional(),
  supported_parameters: z.array(z.string()),
});

const ApiResponseSchema = z.object({
  data: z.array(ModelDataSchema),
});

type ModelData = z.infer<typeof ModelDataSchema>;
//type ApiResponse = z.infer<typeof ApiResponseSchema>;

function parsePricing(priceString: string | null | undefined): number {
  if (priceString === null || priceString === undefined || priceString === "0") {
    return 0;
  }
  const price = Number.parseFloat(priceString);
  return Number.isNaN(price) ? 0 : price * 1000000;
}

const SCAN_INTERVAL_MS = 60000;

export default class OpenRouterProvider extends ModelProvider<OpenRouterConfig> {
  static readonly providerCode = "openrouter" as const;
  static readonly configSchema = OpenRouterModelProviderConfigSchema;

  readonly name: string;
  readonly description = "OpenRouter provider";

  private apiKey: string | undefined;
  private getModels: (() => Promise<unknown>) | undefined;

  private chatRegistry: ChatModelRegistry | undefined;
  private registeredChatKeys = new Set<string>();
  private lastModelFingerprint: string | undefined;

  private readonly readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private readyResolved = false;

  constructor(
    providerDisplayName: string,
    private config: OpenRouterConfig,
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

    this.applyConfig(config);

    void this.runInitialScan();
  }

  async reconfigure(config: OpenRouterConfig): Promise<void> {
    this.applyConfig(config);
    // Force re-fetch & re-register on next scan
    this.lastModelFingerprint = undefined;
    await this.scanAndRegister();
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
      try {
        await this.scanAndRegister();
      } catch (err) {
        this.app.serviceError(this, "Error while scanning OpenRouter models:", err as Error);
      }
    }
  }

  private async runInitialScan(): Promise<void> {
    try {
      await this.scanAndRegister();
    } catch (err) {
      this.app.serviceError(this, "Initial OpenRouter model scan failed:", err as Error);
    } finally {
      this.resolveReady();
    }
  }

  private applyConfig(config: OpenRouterConfig): void {
    this.config = config;
    this.apiKey = process.env[config.apiKeyFromEnv];

    if (!this.apiKey) {
      this.getModels = undefined;
      this.syncChatModels([]);
      return;
    }

    this.getModels = cachedDataRetriever("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      cacheTime: SCAN_INTERVAL_MS,
      timeout: 10000,
    }) as () => Promise<unknown>;
  }

  private async scanAndRegister(): Promise<void> {
    if (!this.apiKey || !this.getModels) return;

    const rawData = await this.getModels();
    if (rawData == null) return;

    const modelsData = ApiResponseSchema.parse(rawData);

    const filtered = this.config.modelFilter ? modelsData.data.filter(m => this.config.modelFilter!(m)) : modelsData.data;

    const fingerprint = filtered
      .map(m => `${m.id}|${m.context_length}|${m.pricing.prompt}|${m.pricing.completion}`)
      .sort()
      .join(",");

    if (fingerprint === this.lastModelFingerprint) return;
    this.lastModelFingerprint = fingerprint;

    this.syncChatModels(this.buildChatSpecs(filtered));
  }

  private buildChatSpecs(models: ModelData[]): ChatModelSpec[] {
    const specs: ChatModelSpec[] = [];
    const isAvailable = async () => true;

    for (const model of models) {
      if (!model.id) continue;

      const isChatModel = model.architecture.output_modalities.includes("text") && model.architecture.input_modalities.includes("text");
      if (!isChatModel) continue;

      specs.push({
        modelId: model.id,
        providerDisplayName: this.name,
        impl: openrouter(model.id),
        isAvailable,
        maxContextLength: model.context_length || model.topProvider?.context_length || 4096,
        ...(model.topProvider?.max_completion_tokens && {
          maxCompletionTokens: model.topProvider.max_completion_tokens,
        }),
        costPerMillionInputTokens: parsePricing(model.pricing.prompt),
        costPerMillionOutputTokens: parsePricing(model.pricing.completion),
        inputCapabilities: dedupe([
          ...textMimeTypes,
          ...(model.architecture.input_modalities.includes("image") ? imageMimeTypes : []),
          ...(model.architecture.input_modalities.includes("video") ? videoMimeTypes : []),
          ...(model.architecture.input_modalities.includes("audio") ? audioMimeTypes : []),
        ]),
        mangleRequest(req, settings) {
          const supported = model.supported_parameters;

          if (settings.has("websearch")) {
            if (req.providerOptions.openrouter === undefined) {
              req.providerOptions.openrouter = {};
            }
            if (req.providerOptions.openrouter.plugins === undefined) {
              req.providerOptions.openrouter.plugins = [];
            }
            const plugins = req.providerOptions.openrouter.plugins as JSONArray;
            const webPlugin: any = { id: "web" };

            if (settings.has("searchEngine")) {
              webPlugin.engine = settings.get("searchEngine");
            }
            if (settings.has("maxResults")) {
              webPlugin.max_results = settings.get("maxResults");
            }
            if (settings.has("searchPrompt")) {
              webPlugin.search_prompt = settings.get("searchPrompt");
            }

            plugins.push(webPlugin);
          }

          if (settings.has("searchContextSize")) {
            if (req.providerOptions.web_search_options === undefined) {
              req.providerOptions.web_search_options = {};
            }
            req.providerOptions.web_search_options.search_context_size = settings.get("searchContextSize") as number;
          }

          const params: Record<string, any> = {};
          if (supported.includes("frequency_penalty") && settings.has("frequencyPenalty")) params.frequency_penalty = settings.get("frequencyPenalty");
          if (supported.includes("max_tokens") && settings.has("maxTokens")) params.max_tokens = settings.get("maxTokens");
          if (supported.includes("min_p") && settings.has("minP")) params.min_p = settings.get("minP");
          if (supported.includes("presence_penalty") && settings.has("presencePenalty")) params.presence_penalty = settings.get("presencePenalty");
          if (supported.includes("repetition_penalty") && settings.has("repetitionPenalty")) params.repetition_penalty = settings.get("repetitionPenalty");
          if (supported.includes("temperature") && settings.has("temperature")) params.temperature = settings.get("temperature");
          if (supported.includes("top_k") && settings.has("topK")) params.top_k = settings.get("topK");
          if (supported.includes("top_p") && settings.has("topP")) params.top_p = settings.get("topP");
          if (supported.includes("include_reasoning") && settings.has("includeReasoning")) params.include_reasoning = settings.get("includeReasoning");
          if (supported.includes("reasoning") && settings.has("reasoning")) params.reasoning = settings.get("reasoning");

          if (Object.keys(params).length > 0) {
            if (req.providerOptions.openrouter === undefined) {
              req.providerOptions.openrouter = {};
            }
            Object.assign(req.providerOptions.openrouter, params);
          }
        },
        settings: {
          websearch: {
            description: "Enables web search plugin",
            defaultValue: false,
            type: "boolean",
          },
          searchEngine: {
            description: "Search engine (native, exa, or undefined for auto)",
            defaultValue: undefined,
            type: "enum",
            values: ["native", "exa"],
          },
          maxResults: {
            description: "Maximum number of search results (default 5)",
            defaultValue: 5,
            type: "number",
            min: 0,
            max: 100,
          },
          searchContextSize: {
            description: "Search context size for native search",
            defaultValue: "low",
            type: "enum",
            values: ["low", "medium", "high"],
          },
          ...(model.supported_parameters.includes("frequency_penalty") && {
            frequencyPenalty: {
              description: "Frequency penalty",
              type: "number",
              min: -2.0,
              max: 2.0,
            },
          }),
          ...(model.supported_parameters.includes("max_tokens") && {
            maxTokens: { description: "Max tokens", type: "number", min: 1 },
          }),
          ...(model.supported_parameters.includes("min_p") && {
            minP: {
              description: "Min P sampling",
              type: "number",
              min: 0,
              max: 1.0,
            },
          }),
          ...(model.supported_parameters.includes("presence_penalty") && {
            presencePenalty: {
              description: "Presence penalty",
              type: "number",
              min: -2.0,
              max: 2.0,
            },
          }),
          ...(model.supported_parameters.includes("repetition_penalty") && {
            repetitionPenalty: {
              description: "Repetition penalty",
              type: "number",
              min: 0,
              max: 2.0,
            },
          }),
          ...(model.supported_parameters.includes("temperature") && {
            temperature: {
              description: "Temperature",
              type: "number",
              min: 0,
              max: 2.0,
            },
          }),
          ...(model.supported_parameters.includes("top_k") && {
            topK: { description: "Top K sampling", type: "number", min: 0 },
          }),
          ...(model.supported_parameters.includes("top_p") && {
            topP: {
              description: "Top P sampling",
              type: "number",
              min: 0,
              max: 1.0,
            },
          }),
          ...(model.supported_parameters.includes("include_reasoning") && {
            includeReasoning: {
              description: "Include reasoning",
              type: "boolean",
            },
          }),
          ...(model.supported_parameters.includes("reasoning") && {
            reasoning: { description: "Reasoning mode", type: "string" },
          }),
        },
      });
    }

    return specs;
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
}
