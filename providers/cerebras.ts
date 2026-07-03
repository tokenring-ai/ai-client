import { createCerebras } from "@ai-sdk/cerebras";
import type TokenRingApp from "@tokenring-ai/app";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import { z } from "zod";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
import { ModelProvider } from "../ModelProvider.ts";
import { ChatModelRegistry } from "../ModelRegistry.ts";

const ChatModelSchema = z.object({
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  maxContextLength: z.number(),
});

const CerebrasModelsSchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
});

const CerebrasModelProviderConfigSchema = z.object({
  provider: z.literal("cerebras"),
  apiKeyFromEnv: z.string().default("CEREBRAS_API_KEY"),
  models: CerebrasModelsSchema,
});

type CerebrasConfig = z.output<typeof CerebrasModelProviderConfigSchema>;

interface Model {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

interface ModelList {
  object: "list";
  data: Model[];
}

export default class CerebrasProvider extends ModelProvider<CerebrasConfig> {
  static readonly providerCode = "cerebras" as const;
  static readonly configSchema = CerebrasModelProviderConfigSchema;

  readonly name: string;
  readonly description = "Cerebras AI provider";

  private config!: CerebrasConfig;
  private apiKey: string | undefined;
  private cerebrasProvider: ReturnType<typeof createCerebras> | undefined;
  private getModels: (() => Promise<ModelList | null>) | undefined;
  private chatRegistry: ChatModelRegistry | undefined;
  private registeredChatKeys = new Set<string>();

  constructor(
    providerDisplayName: string,
    config: CerebrasConfig,
    private readonly app: TokenRingApp,
  ) {
    super();
    this.name = providerDisplayName;
    this.app.waitForService(ChatModelRegistry, r => {
      this.chatRegistry = r;
    });
    this.applyConfig(config);
  }

  async reconfigure(config: CerebrasConfig): Promise<void> {
    this.applyConfig(config);
  }

  ready(): Promise<void> {
    return Promise.resolve();
  }

  private applyConfig(config: CerebrasConfig): void {
    this.config = config;
    this.apiKey = process.env[config.apiKeyFromEnv];

    if (!this.apiKey) {
      this.cerebrasProvider = undefined;
      this.getModels = undefined;
      this.syncChatModels([]);
      return;
    }

    this.getModels = cachedDataRetriever("https://api.cerebras.ai/v1/models", {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    }) as () => Promise<ModelList | null>;

    this.cerebrasProvider = createCerebras({ apiKey: this.apiKey });

    this.syncChatModels(this.buildChatSpecs());
  }

  private buildChatSpecs(): ChatModelSpec[] {
    if (!this.cerebrasProvider) return [];
    const cerebrasProvider = this.cerebrasProvider;
    const getModels = this.getModels!;

    return Object.entries(this.config.models.chat).map(
      ([modelId, modelConfig]) =>
        ({
          modelId,
          providerDisplayName: this.name,
          impl: cerebrasProvider(modelId),
          costPerMillionInputTokens: modelConfig.costPerMillionInputTokens,
          costPerMillionOutputTokens: modelConfig.costPerMillionOutputTokens,
          maxContextLength: modelConfig.maxContextLength,
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
