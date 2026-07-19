import { groq } from "@ai-sdk/groq";
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
  costPerMillionOutputTokens: z.number(),
  maxContextLength: z.number(),
  maxCompletionTokens: z.number().exactOptional(),
});

const GroqModelsSchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
});

const GroqModelProviderConfigSchema = z.object({
  provider: z.literal("groq"),
  apiKeyFromEnv: z
    .string()
    .default("GROQ_API_KEY")
    .meta({ description: "Name of the environment variable holding the Groq API key" } satisfies ConfigFieldMeta),
  models: GroqModelsSchema,
});

type GroqConfig = z.output<typeof GroqModelProviderConfigSchema>;

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

export default class GroqProvider extends ModelProvider<GroqConfig> {
  static readonly providerCode = "groq" as const;
  static readonly configSchema = GroqModelProviderConfigSchema;

  readonly name: string;
  readonly description = "Groq AI provider";

  private config!: GroqConfig;
  private apiKey: string | undefined;
  private getModels: (() => Promise<ModelList | null>) | undefined;
  private chatRegistry: ChatModelRegistry | undefined;
  private registeredChatKeys = new Set<string>();

  constructor(
    providerDisplayName: string,
    config: GroqConfig,
    private readonly app: TokenRingApp,
  ) {
    super();
    this.name = providerDisplayName;
    this.app.waitForService(ChatModelRegistry, r => {
      this.chatRegistry = r;
    });
    this.applyConfig(config);
  }

  async reconfigure(config: GroqConfig): Promise<void> {
    this.applyConfig(config);
  }

  ready(): Promise<void> {
    return Promise.resolve();
  }

  private applyConfig(config: GroqConfig): void {
    this.config = config;
    this.apiKey = process.env[config.apiKeyFromEnv];

    if (!this.apiKey) {
      this.getModels = undefined;
      this.syncChatModels([]);
      return;
    }

    this.getModels = cachedDataRetriever("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    }) as () => Promise<ModelList | null>;

    this.syncChatModels(this.buildChatSpecs());
  }

  private buildChatSpecs(): ChatModelSpec[] {
    if (!this.apiKey) return [];
    const getModels = this.getModels!;
    return Object.entries(this.config.models.chat).map(
      ([modelId, modelConfig]) =>
        ({
          modelId,
          providerDisplayName: this.name,
          impl: groq(modelId),
          costPerMillionInputTokens: modelConfig.costPerMillionInputTokens,
          costPerMillionOutputTokens: modelConfig.costPerMillionOutputTokens,
          maxContextLength: modelConfig.maxContextLength,
          inputCapabilities: [...textMimeTypes],
          ...(modelConfig.maxCompletionTokens !== undefined && {
            maxCompletionTokens: modelConfig.maxCompletionTokens,
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
