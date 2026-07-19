import { createDeepSeek } from "@ai-sdk/deepseek";
import { textMimeTypes } from "@tokenring-ai/agent/AgentEvents";
import type TokenRingApp from "@tokenring-ai/app";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import { z } from "zod";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
import { ModelProvider } from "../ModelProvider.ts";
import { ChatModelRegistry } from "../ModelRegistry.ts";

const ChatModelSchema = z.object({
  costPerMillionInputTokens: z.number(),
  costPerMillionCachedInputTokens: z.number().exactOptional(),
  costPerMillionOutputTokens: z.number(),
  maxContextLength: z.number(),
});

const DeepSeekModelsSchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
});

const DeepSeekModelProviderConfigSchema = z.object({
  provider: z.literal("deepseek"),
  apiKeyFromEnv: z
    .string()
    .default("DEEPSEEK_API_KEY")
    .meta({ description: "Name of the environment variable holding the DeepSeek API key" } satisfies ConfigFieldMeta),
  models: DeepSeekModelsSchema,
});

type DeepSeekConfig = z.output<typeof DeepSeekModelProviderConfigSchema>;

interface Model {
  id: string;
  object: "model";
  owned_by: string;
}

interface ModelsListResponse {
  object: "list";
  data: Model[];
}

export default class DeepSeekProvider extends ModelProvider<DeepSeekConfig> {
  static readonly providerCode = "deepseek" as const;
  static readonly configSchema = DeepSeekModelProviderConfigSchema;

  readonly name: string;
  readonly description = "DeepSeek AI provider";

  private config!: DeepSeekConfig;
  private apiKey: string | undefined;
  private deepseekProvider: ReturnType<typeof createDeepSeek> | undefined;
  private getModels: (() => Promise<ModelsListResponse | null>) | undefined;
  private chatRegistry: ChatModelRegistry | undefined;
  private registeredChatKeys = new Set<string>();

  constructor(
    providerDisplayName: string,
    config: DeepSeekConfig,
    private readonly app: TokenRingApp,
  ) {
    super();
    this.name = providerDisplayName;
    this.app.waitForService(ChatModelRegistry, r => {
      this.chatRegistry = r;
    });
    this.applyConfig(config);
  }

  async reconfigure(config: DeepSeekConfig): Promise<void> {
    this.applyConfig(config);
  }

  ready(): Promise<void> {
    return Promise.resolve();
  }

  private applyConfig(config: DeepSeekConfig): void {
    this.config = config;
    this.apiKey = process.env[config.apiKeyFromEnv];

    if (!this.apiKey) {
      this.deepseekProvider = undefined;
      this.getModels = undefined;
      this.syncChatModels([]);
      return;
    }

    this.getModels = cachedDataRetriever("https://api.deepseek.com/models", {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    }) as () => Promise<ModelsListResponse | null>;

    this.deepseekProvider = createDeepSeek({ apiKey: this.apiKey });

    this.syncChatModels(this.buildChatSpecs());
  }

  private buildChatSpecs(): ChatModelSpec[] {
    if (!this.deepseekProvider) return [];
    const deepseekProvider = this.deepseekProvider;
    const getModels = this.getModels!;

    return Object.entries(this.config.models.chat).map(
      ([modelId, modelConfig]) =>
        ({
          modelId,
          impl: deepseekProvider(modelId),
          providerDisplayName: this.name,
          costPerMillionInputTokens: modelConfig.costPerMillionInputTokens,
          costPerMillionOutputTokens: modelConfig.costPerMillionOutputTokens,
          maxContextLength: modelConfig.maxContextLength,
          inputCapabilities: [...textMimeTypes],
          ...(modelConfig.costPerMillionCachedInputTokens !== undefined && {
            costPerMillionCachedInputTokens: modelConfig.costPerMillionCachedInputTokens,
          }),
          async isAvailable() {
            const modelList = await getModels();
            return !!modelList?.data.some(model => model.id === modelId);
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
