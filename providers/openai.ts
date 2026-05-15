import { createOpenAI, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type TokenRingApp from "@tokenring-ai/app";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import { z } from "zod";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
import type { ImageModelSpec } from "../client/AIImageGenerationClient.ts";
import type { SpeechModelSpec } from "../client/AISpeechClient.ts";
import type { TranscriptionModelSpec } from "../client/AITranscriptionClient.ts";
import { ModelInputCapabilitiesSchema } from "../client/modelCapabilities.ts";
import { ModelProvider } from "../ModelProvider.ts";
import { ChatModelRegistry, ImageGenerationModelRegistry, SpeechModelRegistry, TranscriptionModelRegistry, } from "../ModelRegistry.ts";

const ChatModelSchema = z.object({
  providerModelId: z.string().exactOptional(),
  providerOptions: z.record(z.string(), z.unknown()).exactOptional(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  costPerMillionCachedInputTokens: z.number().exactOptional(),
  maxContextLength: z.number(),
  features: z.array(z.string()).exactOptional(),
  inputCapabilities: ModelInputCapabilitiesSchema.prefault({ text: true, image: true, file: true }),
});

const ImageGenerationModelSchema = z.object({
  providerModelId: z.string().exactOptional(),
  providerOptions: z.record(z.string(), z.unknown()).exactOptional(),
  costPerMegapixel: z.number(),
  inputCapabilities: ModelInputCapabilitiesSchema.prefault({ text: true, image: true, file: true }),
});

const TextToSpeechModelSchema = z.object({
  costPerMillionCharacters: z.number(),
});

const SpeechToTextModelSchema = z.object({
  costPerMinute: z.number(),
});

export const OpenAIModelsSchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
  imageGeneration: z.record(z.string(), ImageGenerationModelSchema),
  textToSpeech: z.record(z.string(), TextToSpeechModelSchema),
  speechToText: z.record(z.string(), SpeechToTextModelSchema),
});

const OpenAIModelProviderConfigSchema = z.object({
  provider: z.literal("openai"),
  apiKeyFromEnv: z.string().default("OPENAI_API_KEY"),
  models: OpenAIModelsSchema,
});

type OpenAIConfig = z.output<typeof OpenAIModelProviderConfigSchema>;

type ModelListData = {
  id: string;
  object: "model";
  owned_by: "organization" | "openai";
  created: number;
};

type ModelList = {
  object: "list";
  data: ModelListData[];
};

export default class OpenAIProvider extends ModelProvider<OpenAIConfig> {
  static readonly providerCode = "openai" as const;
  static readonly configSchema = OpenAIModelProviderConfigSchema;

  readonly name: string;
  readonly description = "OpenAI provider";

  private config!: OpenAIConfig;
  private apiKey: string | undefined;
  private openai: ReturnType<typeof createOpenAI> | undefined;
  private getModels: (() => Promise<ModelList | null>) | undefined;

  private chatRegistry: ChatModelRegistry | undefined;
  private imageRegistry: ImageGenerationModelRegistry | undefined;
  private speechRegistry: SpeechModelRegistry | undefined;
  private transcriptionRegistry: TranscriptionModelRegistry | undefined;

  private registeredChatKeys = new Set<string>();
  private registeredImageKeys = new Set<string>();
  private registeredSpeechKeys = new Set<string>();
  private registeredTranscriptionKeys = new Set<string>();

  constructor(
    providerDisplayName: string,
    config: OpenAIConfig,
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
    this.app.waitForService(SpeechModelRegistry, r => {
      this.speechRegistry = r;
    });
    this.app.waitForService(TranscriptionModelRegistry, r => {
      this.transcriptionRegistry = r;
    });
    this.applyConfig(config);
  }

  async reconfigure(config: OpenAIConfig): Promise<void> {
    this.applyConfig(config);
  }

  ready(): Promise<void> {
    return Promise.resolve();
  }

  private applyConfig(config: OpenAIConfig): void {
    this.config = config;
    this.apiKey = process.env[config.apiKeyFromEnv];

    if (!this.apiKey) {
      this.openai = undefined;
      this.getModels = undefined;
      this.syncChatModels([]);
      this.syncImageModels([]);
      this.syncSpeechModels([]);
      this.syncTranscriptionModels([]);
      return;
    }

    this.openai = createOpenAI({ apiKey: this.apiKey });

    this.getModels = cachedDataRetriever("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    }) as () => Promise<ModelList | null>;

    this.syncChatModels(this.buildChatSpecs());
    this.syncImageModels(this.buildImageSpecs());
    this.syncSpeechModels(this.buildSpeechSpecs());
    this.syncTranscriptionModels(this.buildTranscriptionSpecs());
  }

  private buildChatSpec(modelId: string, modelConfig: OpenAIConfig["models"]["chat"][string]): ChatModelSpec {
    const openai = this.openai!;
    const getModels = this.getModels!;

    const providerModelId = modelConfig.providerModelId ?? modelId;
    const isReasoningModel = providerModelId.startsWith("gpt-5") || providerModelId.startsWith("o");
    const isGpt51 = providerModelId === "gpt-5.1" || providerModelId.startsWith("gpt-5.1-");
    const supportsAudioInput = providerModelId.includes("audio") || providerModelId.includes("realtime");

    const baseSettings: any = {
      websearch: {
        description: "Enables web search",
        defaultValue: false,
        type: "boolean",
      },
      serviceTier: {
        description: "Service tier (auto, flex, priority, default)",
        defaultValue: "auto",
        type: "enum",
        values: ["auto", "flex", "priority", "default"],
      },
      textVerbosity: {
        description: "Text verbosity (low, medium, high)",
        defaultValue: "medium",
        type: "enum",
        values: ["low", "medium", "high"],
      },
      strictJsonSchema: {
        description: "Use strict JSON schema validation",
        defaultValue: false,
        type: "boolean",
      },
    };

    if (isReasoningModel) {
      if (isGpt51) {
        baseSettings.promptCacheRetention = {
          description: "The retention policy for the prompt cache",
          defaultValue: "in_memory",
          type: "enum",
          values: ["in_memory", "24h"],
        };
      }

      baseSettings.reasoningEffort = {
        description: `Reasoning effort (${isGpt51 ? "none, " : ""}minimal, low, medium, high)`,
        defaultValue: "medium",
        type: "enum",
        values: isGpt51 ? ["none", "minimal", "low", "medium", "high"] : ["minimal", "low", "medium", "high"],
      };
      baseSettings.reasoningSummary = {
        description: "Reasoning summary mode (auto, detailed)",
        defaultValue: undefined,
        type: "enum",
        values: ["auto", "detailed"],
      };
    }

    return {
      modelId,
      providerDisplayName: this.name,
      impl: openai(providerModelId),
      costPerMillionInputTokens: modelConfig.costPerMillionInputTokens,
      costPerMillionOutputTokens: modelConfig.costPerMillionOutputTokens,
      maxContextLength: modelConfig.maxContextLength,
      inputCapabilities: deepClone(
        modelConfig.inputCapabilities,
        supportsAudioInput ? { audio: true, file: true } : {},
      ),
      ...(modelConfig.costPerMillionCachedInputTokens !== undefined && {
        costPerMillionCachedInputTokens: modelConfig.costPerMillionCachedInputTokens,
      }),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some(model => model.id === providerModelId);
      },
      mangleRequest(req, settings) {
        if (settings.has("websearch")) {
          (req.tools ??= {}).web_search = openai.tools.webSearch({});
        }

        const openaiOptions: OpenAIResponsesProviderOptions = ((req.providerOptions ??= {}).openai ??= {});
        
        if (settings.has("reasoningEffort")) {
          openaiOptions.reasoningEffort = settings.get("reasoningEffort") as string;
        }
        if (settings.has("reasoningSummary")) {
          openaiOptions.reasoningSummary = settings.get("reasoningSummary") as string;
        }
        if (settings.has("strictJsonSchema")) {
          openaiOptions.strictJsonSchema = settings.get("strictJsonSchema") as boolean;
        }
        if (settings.has("serviceTier")) {
          openaiOptions.serviceTier = settings.get("serviceTier") as any;
        }
        if (settings.has("textVerbosity")) {
          openaiOptions.textVerbosity = settings.get("textVerbosity") as any;
        }
        if (settings.has("promptCacheRetention")) {
          openaiOptions.promptCacheRetention = settings.get("promptCacheRetention") as any;
        }

        return undefined;
      },
      settings: baseSettings,
    } satisfies ChatModelSpec;
  }

  private buildChatSpecs(): ChatModelSpec[] {
    if (!this.openai) return [];
    return Object.entries(this.config.models.chat).map(([modelId, modelConfig]) => this.buildChatSpec(modelId, modelConfig));
  }

  private buildImageSpecs(): ImageModelSpec[] {
    if (!this.openai) return [];
    const openai = this.openai;
    const getModels = this.getModels!;

    return Object.entries(this.config.models.imageGeneration).map(([variantId, modelConfig]) => {
      const baseModelId = modelConfig.providerModelId ?? variantId;
      return {
        modelId: variantId,
        providerDisplayName: this.name,
        impl: openai.imageModel(baseModelId),
        inputCapabilities: modelConfig.inputCapabilities,
        async isAvailable() {
          const modelList = await getModels();
          return !!modelList?.data.some(model => model.id === baseModelId);
        },
        calculateImageCost(req) {
          const size = req.size.split("x").map(Number);
          return (modelConfig.costPerMegapixel * size[0] * size[1]) / 1000000;
        },
        ...(modelConfig.providerOptions && {
          providerOptions: { openai: modelConfig.providerOptions },
        }),
      } satisfies ImageModelSpec;
    });
  }

  private buildSpeechSpecs(): SpeechModelSpec[] {
    if (!this.openai) return [];
    const openai = this.openai;
    return Object.entries(this.config.models.textToSpeech).map(([modelId, modelConfig]) => ({
      modelId,
      providerDisplayName: this.name,
      impl: openai.speech(modelId),
      isAvailable() {
        return true;
      },
      costPerMillionCharacters: modelConfig.costPerMillionCharacters,
    } satisfies SpeechModelSpec));
  }

  private buildTranscriptionSpecs(): TranscriptionModelSpec[] {
    if (!this.openai) return [];
    const openai = this.openai;
    return Object.entries(this.config.models.speechToText).map(([modelId, modelConfig]) => ({
      modelId,
      providerDisplayName: this.name,
      impl: openai.transcription(modelId),
      isAvailable() {
        return true;
      },
      costPerMinute: modelConfig.costPerMinute,
    } satisfies TranscriptionModelSpec));
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

  private syncSpeechModels(specs: SpeechModelSpec[]): void {
    const newKeys = new Set<string>(specs.map(s => `${s.providerDisplayName}:${s.modelId}`.toLowerCase()));
    if (this.speechRegistry) {
      if (specs.length > 0) {
        this.speechRegistry.registerAllModelSpecs(specs);
      }
      for (const oldKey of this.registeredSpeechKeys) {
        if (!newKeys.has(oldKey)) {
          this.speechRegistry.modelSpecs.unregister(oldKey);
        }
      }
    }
    this.registeredSpeechKeys = newKeys;
  }

  private syncTranscriptionModels(specs: TranscriptionModelSpec[]): void {
    const newKeys = new Set<string>(specs.map(s => `${s.providerDisplayName}:${s.modelId}`.toLowerCase()));
    if (this.transcriptionRegistry) {
      if (specs.length > 0) {
        this.transcriptionRegistry.registerAllModelSpecs(specs);
      }
      for (const oldKey of this.registeredTranscriptionKeys) {
        if (!newKeys.has(oldKey)) {
          this.transcriptionRegistry.modelSpecs.unregister(oldKey);
        }
      }
    }
    this.registeredTranscriptionKeys = newKeys;
  }
}
