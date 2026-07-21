import { perplexity } from "@ai-sdk/perplexity";
import { textMimeTypes } from "@tokenring-ai/agent/AgentEvents";
import type TokenRingApp from "@tokenring-ai/app";
import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import { wrapLanguageModel } from "ai";
import { z } from "zod";
import type { ChatModelSpec, ParsedChatRequest } from "../client/AIChatClient.ts";
import { ModelProvider } from "../ModelProvider.ts";
import { ChatModelRegistry } from "../ModelRegistry.ts";
import type { ModelSettings } from "../ModelTypeRegistry.ts";
import { strictMessageOrderMiddleware } from "../middleware/strictMessageOrder.ts";

const ChatModelSchema = z.object({
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  costPerMillionReasoningTokens: z.number().exactOptional(),
  maxContextLength: z.number(),
});

const PerplexityModelsSchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
});

const PerplexityModelProviderConfigSchema = z.object({
  provider: z.literal("perplexity"),
  apiKeyFromEnv: z
    .string()
    .default("PERPLEXITY_API_KEY")
    .meta({ description: "Name of the environment variable holding the Perplexity API key" } satisfies ConfigFieldMeta),
  models: PerplexityModelsSchema,
});

type PerplexityConfig = z.output<typeof PerplexityModelProviderConfigSchema>;

function mangleRequest(request: ParsedChatRequest, settings: ModelSettings): void {
  if (request.providerOptions.perplexity === undefined) {
    request.providerOptions.perplexity = {};
  }

  const perplexityOptions = request.providerOptions.perplexity;

  if (settings.has("searchContextSize")) {
    const webSearchOptions = (perplexityOptions.web_search_options ??= {}) as Record<string, number>;
    webSearchOptions.search_context_size = settings.get("searchContextSize") as number;
  }

  if (!settings.has("websearch")) {
    perplexityOptions.disable_search = true;
  }
}

export default class PerplexityProvider extends ModelProvider<PerplexityConfig> {
  static readonly providerCode = "perplexity" as const;
  static readonly configSchema = PerplexityModelProviderConfigSchema;

  readonly name: string;
  readonly description = "Perplexity AI provider";

  private config!: PerplexityConfig;
  private apiKey: string | undefined;

  private chatRegistry: ChatModelRegistry | undefined;
  private registeredChatKeys = new Set<string>();

  constructor(
    providerDisplayName: string,
    config: PerplexityConfig,
    private readonly app: TokenRingApp,
  ) {
    super();
    this.name = providerDisplayName;
    this.app.waitForService(ChatModelRegistry, r => {
      this.chatRegistry = r;
    });
    this.applyConfig(config);
  }

  async reconfigure(config: PerplexityConfig): Promise<void> {
    this.applyConfig(config);
  }

  ready(): Promise<void> {
    return Promise.resolve();
  }

  private applyConfig(config: PerplexityConfig): void {
    this.config = config;
    this.apiKey = process.env[config.apiKeyFromEnv];

    if (!this.apiKey) {
      this.syncChatModels([]);
      return;
    }

    this.syncChatModels(this.buildChatSpecs());
  }

  private buildChatSpecs(): ChatModelSpec[] {
    if (!this.apiKey) return [];
    return Object.entries(this.config.models.chat).map(
      ([modelId, modelConfig]) =>
        ({
          modelId,
          providerDisplayName: this.name,
          impl: wrapLanguageModel({
            model: perplexity(modelId),
            middleware: strictMessageOrderMiddleware,
          }),
          mangleRequest,
          costPerMillionInputTokens: modelConfig.costPerMillionInputTokens,
          costPerMillionOutputTokens: modelConfig.costPerMillionOutputTokens,
          maxContextLength: modelConfig.maxContextLength,
          inputCapabilities: [...textMimeTypes],
          settings: {
            websearch: {
              description: "Enables web search",
              defaultValue: true,
              type: "boolean",
            },
            searchContextSize: {
              description: "The searchContextSize parameter allows you to control how much search context is retrieved from the web during query resolution",
              defaultValue: "low",
              type: "enum",
              values: ["low", "medium", "high"],
            },
          },
        }) satisfies ChatModelSpec,
    );
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
