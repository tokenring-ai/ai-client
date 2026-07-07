import { createGoogleGenerativeAI, type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type TokenRingApp from "@tokenring-ai/app";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import { z } from "zod";
import type { ChatModelSpec, ChatRequest } from "../client/AIChatClient.ts";
import type { ImageModelSpec } from "../client/AIImageGenerationClient.ts";
import { ModelInputCapabilitiesSchema } from "../client/modelCapabilities.ts";
import { ModelProvider } from "../ModelProvider.ts";
import { ChatModelRegistry, ImageGenerationModelRegistry } from "../ModelRegistry.ts";
import type { ChatModelSettings, SettingDefinition } from "../ModelTypeRegistry.ts";

const ChatModelSchema = z.object({
  providerModelId: z.string().exactOptional(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  costPerMillionCachedInputTokens: z.number().exactOptional(),
  maxContextLength: z.number(),
  features: z.array(z.string()).exactOptional(),
  inputCapabilities: ModelInputCapabilitiesSchema.prefault({ text: true, image: true, video: true, audio: true, file: true }),
});

const ImageGenerationModelSchema = z.object({
  costPerImage: z.number(),
  inputCapabilities: ModelInputCapabilitiesSchema.prefault({ text: true, image: true, file: true }),
});

const GoogleModelsSchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
  imageGeneration: z.record(z.string(), ImageGenerationModelSchema),
});

const GoogleModelProviderConfigSchema = z.object({
  provider: z.literal("google"),
  apiKeyFromEnv: z.string().default("GOOGLE_GENERATIVE_AI_API_KEY"),
  models: GoogleModelsSchema,
});

type GoogleConfig = z.output<typeof GoogleModelProviderConfigSchema>;

interface Model {
  name: string;
  displayName: string;
  description: string;
}

interface ModelList {
  models: Model[];
}

export default class GoogleProvider extends ModelProvider<GoogleConfig> {
  static readonly providerCode = "google" as const;
  static readonly configSchema = GoogleModelProviderConfigSchema;

  readonly name: string;
  readonly description = "Google Generative AI provider";

  private config!: GoogleConfig;
  private apiKey: string | undefined;
  private googleProvider: ReturnType<typeof createGoogleGenerativeAI> | undefined;
  private getModels: (() => Promise<ModelList | null>) | undefined;

  private chatRegistry: ChatModelRegistry | undefined;
  private imageRegistry: ImageGenerationModelRegistry | undefined;

  private registeredChatKeys = new Set<string>();
  private registeredImageKeys = new Set<string>();

  constructor(
    providerDisplayName: string,
    config: GoogleConfig,
    private readonly app: TokenRingApp,
  ) {
    super();
    this.name = providerDisplayName;
    this.app.waitForService(ChatModelRegistry, r => {
      this.chatRegistry = r;
    });
    this.app.waitForService(ImageGenerationModelRegistry, r => {
      this.imageRegistry = r;
    });
    this.applyConfig(config);
  }

  async reconfigure(config: GoogleConfig): Promise<void> {
    this.applyConfig(config);
  }

  ready(): Promise<void> {
    return Promise.resolve();
  }

  private applyConfig(config: GoogleConfig): void {
    this.config = config;
    this.apiKey = process.env[config.apiKeyFromEnv];

    if (!this.apiKey) {
      this.googleProvider = undefined;
      this.getModels = undefined;
      this.syncChatModels([]);
      this.syncImageModels([]);
      return;
    }

    this.getModels = cachedDataRetriever("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: {
        "x-goog-api-key": this.apiKey,
      },
    }) as () => Promise<ModelList | null>;

    this.googleProvider = createGoogleGenerativeAI({ apiKey: this.apiKey });

    this.syncChatModels(this.buildChatSpecs());
    this.syncImageModels(this.buildImageSpecs());
  }

  private buildChatSpec(modelId: string, modelConfig: GoogleConfig["models"]["chat"][string]): ChatModelSpec {
    const googleProvider = this.googleProvider!;
    const getModels = this.getModels!;

    const providerModelId = modelConfig.providerModelId ?? modelId;
    const isGemini3 = providerModelId.startsWith("gemini-3");
    const isGemini25 = providerModelId.startsWith("gemini-2.5");

    const baseSettings: Record<string, SettingDefinition> = {
      responseModalities: {
        description: "Response modalities (text, image, text_and_image)",
        defaultValue: "text_and_image",
        type: "enum",
        values: ["text", "image", "text_and_image"],
      },
    };

    if (isGemini3) {
      baseSettings.thinkingLevel = {
        description: "Thinking depth (low, high)",
        defaultValue: undefined,
        type: "enum",
        values: ["low", "high"],
      };
      baseSettings.includeThoughts = {
        description: "Include thought summaries",
        defaultValue: false,
        type: "boolean",
      };
    } else if (isGemini25) {
      baseSettings.thinkingBudget = {
        description: "Thinking token budget (0 to disable)",
        defaultValue: undefined,
        type: "number",
        min: 0,
        max: 32768,
      };
      baseSettings.includeThoughts = {
        description: "Include thought summaries",
        defaultValue: false,
        type: "boolean",
      };
    }

    if (modelConfig.features?.includes("websearch")) {
      baseSettings.websearch = {
        description: "Enables web search",
        defaultValue: false,
        type: "boolean",
      };
    }

    return {
      modelId,
      providerDisplayName: this.name,
      impl: googleProvider(providerModelId),
      costPerMillionInputTokens: modelConfig.costPerMillionInputTokens,
      costPerMillionOutputTokens: modelConfig.costPerMillionOutputTokens,
      maxContextLength: modelConfig.maxContextLength,
      ...(modelConfig.costPerMillionCachedInputTokens !== undefined && {
        costPerMillionCachedInputTokens: modelConfig.costPerMillionCachedInputTokens,
      }),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.models.some(model => model.name.includes(providerModelId));
      },
      mangleRequest(req: ChatRequest, settings: ChatModelSettings) {
        if (settings.has("websearch")) {
          req.tools.google_search = googleProvider.tools.googleSearch({});
        }

        const googleOptions: GoogleGenerativeAIProviderOptions = ((req.providerOptions ??= {}).google ??= {});

        if (settings.has("responseModalities")) {
          const modalities = settings.get("responseModalities") as "text" | "image" | "text_and_image";
          switch (modalities) {
            case "text":
              googleOptions.responseModalities = ["TEXT"];
              break;
            case "image":
              googleOptions.responseModalities = ["IMAGE"];
              break;
            case "text_and_image":
              googleOptions.responseModalities = ["TEXT", "IMAGE"];
              break;
            default:
              const exhaustive: any = modalities satisfies never;
              throw new Error(`Unexpected response modality: ${exhaustive}`);
          }
        }

        if (settings.has("thinkingLevel") || settings.has("thinkingBudget") || settings.has("includeThoughts")) {
          const thinkingConfig: any = {};
          if (settings.has("thinkingLevel")) thinkingConfig.thinkingLevel = settings.get("thinkingLevel");
          if (settings.has("thinkingBudget")) thinkingConfig.thinkingBudget = settings.get("thinkingBudget");
          if (settings.has("includeThoughts")) thinkingConfig.includeThoughts = settings.get("includeThoughts");
          googleOptions.thinkingConfig = thinkingConfig;
        }
      },
      inputCapabilities: modelConfig.inputCapabilities,
      settings: baseSettings,
    } satisfies ChatModelSpec;
  }

  private buildChatSpecs(): ChatModelSpec[] {
    if (!this.googleProvider) return [];
    return Object.entries(this.config.models.chat).map(([modelId, modelConfig]) => this.buildChatSpec(modelId, modelConfig));
  }

  private buildImageSpecs(): ImageModelSpec[] {
    if (!this.googleProvider) return [];
    const googleProvider = this.googleProvider;
    return Object.entries(this.config.models.imageGeneration).map(
      ([modelId, modelConfig]) =>
        ({
          modelId,
          providerDisplayName: this.name,
          impl: googleProvider.image(modelId),
          isAvailable() {
            return true;
          },
          calculateImageCost() {
            return modelConfig.costPerImage;
          },
          inputCapabilities: modelConfig.inputCapabilities,
        }) satisfies ImageModelSpec,
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

  private syncImageModels(specs: ImageModelSpec[]): void {
    const newKeys = new Set<string>(specs.map(s => `${s.providerDisplayName}:${s.modelId}`.toLowerCase()));
    if (this.imageRegistry) {
      if (specs.length > 0) {
        this.imageRegistry.registerAllModelSpecs(specs);
      }
      for (const oldKey of this.registeredImageKeys) {
        if (!newKeys.has(oldKey)) {
          this.imageRegistry.modelSpecs.unregister(oldKey);
        }
      }
    }
    this.registeredImageKeys = newKeys;
  }
}
