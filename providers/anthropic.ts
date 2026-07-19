import { type AnthropicProviderOptions, createAnthropic } from "@ai-sdk/anthropic";
import { imageMimeTypes, textMimeTypes } from "@tokenring-ai/agent/AgentEvents";
import type TokenRingApp from "@tokenring-ai/app";
import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import { dedupe } from "@tokenring-ai/utility/array/dedupe";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import { z } from "zod";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
import { ModelInputCapabilitiesSchema } from "../client/modelCapabilities.ts";
import { ModelProvider } from "../ModelProvider.ts";
import { ChatModelRegistry } from "../ModelRegistry.ts";

const ChatModelSchema = z.object({
  providerModelId: z.string(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  maxContextLength: z.number(),
  inputCapabilities: ModelInputCapabilitiesSchema.default([]),
});

const AnthropicModelSchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
});

const AnthropicModelProviderConfigSchema = z.object({
  provider: z.literal("anthropic"),
  apiKeyFromEnv: z
    .string()
    .default("ANTHROPIC_API_KEY")
    .meta({ description: "Name of the environment variable holding the Anthropic API key" } satisfies ConfigFieldMeta),
  models: AnthropicModelSchema,
});

type AnthropicConfig = z.output<typeof AnthropicModelProviderConfigSchema>;

interface Model {
  created_at: string;
  display_name: string;
  id: string;
  type: "model";
}

interface ModelsResponse {
  data: Model[];
  first_id: string;
  has_more: boolean;
  last_id: string;
}

export default class AnthropicProvider extends ModelProvider<AnthropicConfig> {
  static readonly providerCode = "anthropic" as const;
  static readonly configSchema = AnthropicModelProviderConfigSchema;

  readonly name: string;
  readonly description = "Anthropic AI provider";

  private config!: AnthropicConfig;
  private apiKey: string | undefined;
  private anthropicClient: ReturnType<typeof createAnthropic> | undefined;
  private getModels: (() => Promise<ModelsResponse | null>) | undefined;
  private chatRegistry: ChatModelRegistry | undefined;
  private registeredChatKeys = new Set<string>();

  constructor(
    providerDisplayName: string,
    config: AnthropicConfig,
    private readonly app: TokenRingApp,
  ) {
    super();
    this.name = providerDisplayName;
    this.app.waitForService(ChatModelRegistry, r => {
      this.chatRegistry = r;
    });
    this.applyConfig(config);
  }

  async reconfigure(config: AnthropicConfig): Promise<void> {
    this.applyConfig(config);
  }

  ready(): Promise<void> {
    return Promise.resolve();
  }

  private applyConfig(config: AnthropicConfig): void {
    this.config = config;
    this.apiKey = process.env[config.apiKeyFromEnv];

    if (!this.apiKey) {
      this.anthropicClient = undefined;
      this.getModels = undefined;
      this.syncChatModels([]);
      return;
    }

    this.getModels = cachedDataRetriever("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
    }) as () => Promise<ModelsResponse | null>;

    this.anthropicClient = createAnthropic({ apiKey: this.apiKey });

    this.syncChatModels(this.buildChatSpecs());
  }

  private buildChatSpecs(): ChatModelSpec[] {
    if (!this.anthropicClient) return [];
    const anthropicClient = this.anthropicClient;
    const getModels = this.getModels!;

    return Object.entries(this.config.models.chat).map(
      ([modelId, modelConfig]) =>
        ({
          modelId,
          providerDisplayName: this.name,
          impl: anthropicClient(modelConfig.providerModelId),
          costPerMillionInputTokens: modelConfig.costPerMillionInputTokens,
          costPerMillionOutputTokens: modelConfig.costPerMillionOutputTokens,
          maxContextLength: modelConfig.maxContextLength,
          async isAvailable() {
            const modelList = await getModels();
            return !!modelList?.data.some(model => model.id === modelConfig.providerModelId);
          },
          mangleRequest(req, settings) {
            if (req.providerOptions.anthropic === undefined) {
              req.providerOptions.anthropic = {};
            }
            const anthropicProvider = req.providerOptions.anthropic as AnthropicProviderOptions;
            const ttl = settings.get("caching") as "off" | "5m" | "1h";
            if (ttl !== "off") {
              anthropicProvider.cacheControl = { type: "ephemeral", ttl };
            }

            /* The following settings only apply to requests that use tools */
            if (!("tools" in req)) return;

            if (settings.get("websearch") as boolean) {
              req.tools.web_search = anthropicClient.tools.webSearch_20250305({
                maxUses: (settings.get("maxSearchUses") as number | undefined) ?? 5,
              });
            }
          },
          settings: {
            caching: {
              description: "Enable context caching for this model",
              type: "enum",
              values: ["off", "5m", "1h"],
              defaultValue: "5m",
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
          },
          inputCapabilities: dedupe([...textMimeTypes, ...imageMimeTypes, ...modelConfig.inputCapabilities]),
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
