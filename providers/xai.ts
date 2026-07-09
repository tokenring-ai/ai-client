import { xai } from "@ai-sdk/xai";
import { imageMimeTypes, textMimeTypes } from "@tokenring-ai/agent/AgentEvents";
import type TokenRingApp from "@tokenring-ai/app";
import { dedupe } from "@tokenring-ai/utility/array/dedupe";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import { z } from "zod";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
import type { ImageModelSpec } from "../client/AIImageGenerationClient.ts";
import type { VideoModelSpec } from "../client/AIVideoGenerationClient.ts";
import { ModelInputCapabilitiesSchema } from "../client/modelCapabilities.ts";
import { ModelProvider } from "../ModelProvider.ts";
import { ChatModelRegistry, ImageGenerationModelRegistry, VideoGenerationModelRegistry } from "../ModelRegistry.ts";

const ChatModelSchema = z.object({
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  costPerMillionCachedInputTokens: z.number().exactOptional(),
  maxContextLength: z.number(),
  inputCapabilities: ModelInputCapabilitiesSchema.default([]),
});

const ImageGenerationModelSchema = z.object({
  costPerImage: z.number(),
  inputCapabilities: ModelInputCapabilitiesSchema.default([...imageMimeTypes]),
});

const VideoGenerationModelSchema = z.object({
  costPerSecond: z.number(),
});

const XAIModelsSchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
  imageGeneration: z.record(z.string(), ImageGenerationModelSchema),
  videoGeneration: z.record(z.string(), VideoGenerationModelSchema),
});

export const XAIModelProviderConfigSchema = z.object({
  provider: z.literal("xai"),
  apiKeyFromEnv: z.string().default("XAI_API_KEY"),
  models: XAIModelsSchema,
});

type XAIConfig = z.output<typeof XAIModelProviderConfigSchema>;

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

export default class XAIProvider extends ModelProvider<XAIConfig> {
  static readonly providerCode = "xai" as const;
  static readonly configSchema = XAIModelProviderConfigSchema;

  readonly name: string;
  readonly description = "xAI provider";

  private config!: XAIConfig;
  private apiKey: string | undefined;
  private getModels: (() => Promise<ModelList | null>) | undefined;

  private chatRegistry: ChatModelRegistry | undefined;
  private imageRegistry: ImageGenerationModelRegistry | undefined;
  private videoRegistry: VideoGenerationModelRegistry | undefined;

  private registeredChatKeys = new Set<string>();
  private registeredImageKeys = new Set<string>();
  private registeredVideoKeys = new Set<string>();

  constructor(
    providerDisplayName: string,
    config: XAIConfig,
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
    this.app.waitForService(VideoGenerationModelRegistry, r => {
      this.videoRegistry = r;
    });
    this.applyConfig(config);
  }

  async reconfigure(config: XAIConfig): Promise<void> {
    this.applyConfig(config);
  }

  ready(): Promise<void> {
    return Promise.resolve();
  }

  private applyConfig(config: XAIConfig): void {
    this.config = config;
    this.apiKey = process.env[config.apiKeyFromEnv];

    if (!this.apiKey) {
      this.getModels = undefined;
      this.syncChatModels([]);
      this.syncImageModels([]);
      this.syncVideoModels([]);
      return;
    }

    this.getModels = cachedDataRetriever("https://api.x.ai/v1/models", {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    }) as () => Promise<ModelList | null>;

    this.syncChatModels(this.buildChatSpecs());
    this.syncImageModels(this.buildImageSpecs());
    this.syncVideoModels(this.buildVideoSpecs());
  }

  private buildChatSpecs(): ChatModelSpec[] {
    if (!this.apiKey) return [];
    const getModels = this.getModels!;

    return Object.entries(this.config.models.chat).map(
      ([modelId, modelConfig]) =>
        ({
          modelId,
          providerDisplayName: this.name,
          impl: xai.responses(modelId),
          costPerMillionInputTokens: modelConfig.costPerMillionInputTokens,
          costPerMillionOutputTokens: modelConfig.costPerMillionOutputTokens,
          maxContextLength: modelConfig.maxContextLength,
          ...(modelConfig.costPerMillionCachedInputTokens !== undefined && {
            costPerMillionCachedInputTokens: modelConfig.costPerMillionCachedInputTokens,
          }),
          async isAvailable() {
            const modelList = await getModels();
            return !!modelList?.data.some(model => model.id === modelId);
          },
          mangleRequest(req, settings) {
            /* The following settings only apply to requests that use tools */
            if (!("tools" in req)) return;

            if (settings.has("websearch")) {
              req.tools.web_search = xai.tools.webSearch({
                enableImageUnderstanding: settings.get("webImageUnderstanding") as boolean,
              });
            }

            if (settings.has("XSearch")) {
              req.tools.x_search = xai.tools.xSearch(
                stripUndefinedKeys({
                  allowedXHandles: (settings.get("XAllowedHandles") as string | undefined)?.split(","),
                  fromDate: settings.get("XFromDate") as string | undefined,
                  toDate: settings.get("XToDate") as string | undefined,
                  enableImageUnderstanding: settings.get("XImageUnderstanding") as boolean,
                  enableVideoUnderstanding: settings.get("XVideoUnderstanding") as boolean,
                }),
              );
            }
          },
          settings: {
            websearch: {
              description: "Enables web search",
              defaultValue: false,
              type: "boolean",
            },
            webImageUnderstanding: {
              description: "Enables image understanding in web search",
              defaultValue: false,
              type: "boolean",
            },
            XSearch: {
              description: "Enables X search",
              defaultValue: false,
              type: "boolean",
            },
            XFromDate: {
              description: "From date for X search",
              defaultValue: undefined,
              type: "string",
            },
            XToDate: {
              description: "To date for X search",
              defaultValue: undefined,
              type: "string",
            },
            XAllowedHandles: {
              description: "Allowed handles for X search",
              defaultValue: undefined,
              type: "string",
            },
            XImageUnderstanding: {
              description: "Enables image understanding in X search",
              defaultValue: false,
              type: "boolean",
            },
            XVideoUnderstanding: {
              description: "Enables video understanding in X search",
              defaultValue: false,
              type: "boolean",
            },
          },
          inputCapabilities: dedupe([...textMimeTypes, ...imageMimeTypes, ...modelConfig.inputCapabilities]),
        }) satisfies ChatModelSpec,
    );
  }

  private buildImageSpecs(): ImageModelSpec[] {
    if (!this.apiKey) return [];
    const getModels = this.getModels!;

    return Object.entries(this.config.models.imageGeneration).map(
      ([modelId, modelConfig]) =>
        ({
          modelId,
          providerDisplayName: this.name,
          impl: xai.imageModel(modelId),
          async isAvailable() {
            const modelList = await getModels();
            return !!modelList?.data.some(model => model.id === modelId);
          },
          calculateImageCost() {
            return modelConfig.costPerImage;
          },
          inputCapabilities: modelConfig.inputCapabilities,
        }) satisfies ImageModelSpec,
    );
  }

  private buildVideoSpecs(): VideoModelSpec[] {
    if (!this.apiKey) return [];
    const getModels = this.getModels!;

    return Object.entries(this.config.models.videoGeneration).map(
      ([modelId, modelConfig]) =>
        ({
          modelId,
          providerDisplayName: this.name,
          impl: xai.videoModel(modelId),
          inputCapabilities: [...imageMimeTypes],
          async isAvailable() {
            const modelList = await getModels();
            return !!modelList?.data.some(model => model.id === modelId);
          },
          calculateVideoCost(request: { duration?: number }) {
            return request.duration ? request.duration * modelConfig.costPerSecond : NaN;
          },
        }) satisfies VideoModelSpec,
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

  private syncVideoModels(specs: VideoModelSpec[]): void {
    const newKeys = new Set<string>(specs.map(s => `${s.providerDisplayName}:${s.modelId}`.toLowerCase()));
    if (this.videoRegistry) {
      if (specs.length > 0) {
        this.videoRegistry.registerAllModelSpecs(specs);
      }
      for (const oldKey of this.registeredVideoKeys) {
        if (!newKeys.has(oldKey)) {
          this.videoRegistry.modelSpecs.unregister(oldKey);
        }
      }
    }
    this.registeredVideoKeys = newKeys;
  }
}
