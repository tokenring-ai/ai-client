import { createFal } from "@ai-sdk/fal";
import { textMimeTypes } from "@tokenring-ai/agent/AgentEvents";
import type TokenRingApp from "@tokenring-ai/app";
import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import { z } from "zod";
import type { ImageModelSpec } from "../client/AIImageGenerationClient.ts";
import { ModelProvider } from "../ModelProvider.ts";
import { ImageGenerationModelRegistry } from "../ModelRegistry.ts";

const ImageGenerationModelSchema = z.object({
  costPerMegapixel: z.number(),
});

const FalModelsSchema = z.object({
  imageGeneration: z.record(z.string(), ImageGenerationModelSchema),
});

const FalModelProviderConfigSchema = z.object({
  provider: z.literal("fal"),
  apiKeyFromEnv: z
    .string()
    .default("FAL_API_KEY")
    .meta({ description: "Name of the environment variable holding the fal.ai API key" } satisfies ConfigFieldMeta),
  models: FalModelsSchema,
});

type FalConfig = z.output<typeof FalModelProviderConfigSchema>;

export default class FalProvider extends ModelProvider<FalConfig> {
  static readonly providerCode = "fal" as const;
  static readonly configSchema = FalModelProviderConfigSchema;

  readonly name: string;
  readonly description = "Fal AI provider";

  private config!: FalConfig;
  private apiKey: string | undefined;
  private fal: ReturnType<typeof createFal> | undefined;

  private imageRegistry: ImageGenerationModelRegistry | undefined;
  private registeredImageKeys = new Set<string>();

  constructor(
    providerDisplayName: string,
    config: FalConfig,
    private readonly app: TokenRingApp,
  ) {
    super();
    this.name = providerDisplayName;
    this.app.waitForService(ImageGenerationModelRegistry, r => {
      this.imageRegistry = r;
    });
    this.applyConfig(config);
  }

  async reconfigure(config: FalConfig): Promise<void> {
    this.applyConfig(config);
  }

  ready(): Promise<void> {
    return Promise.resolve();
  }

  private applyConfig(config: FalConfig): void {
    this.config = config;
    this.apiKey = process.env[config.apiKeyFromEnv];

    if (!this.apiKey) {
      this.fal = undefined;
      this.syncImageModels([]);
      return;
    }

    this.fal = createFal({ apiKey: this.apiKey });

    this.syncImageModels(this.buildImageSpecs());
  }

  private buildImageSpecs(): ImageModelSpec[] {
    if (!this.fal) return [];
    const fal = this.fal;
    return Object.entries(this.config.models.imageGeneration).map(
      ([modelId, modelConfig]) =>
        ({
          modelId,
          providerDisplayName: this.name,
          impl: fal.image(modelId),
          inputCapabilities: [...textMimeTypes],
          calculateImageCost(req) {
            const approximateMegapixels = req.widthAndHeight ? (req.widthAndHeight.width * req.widthAndHeight.height) / 1000000 : 1;
            return modelConfig.costPerMegapixel * approximateMegapixels;
          },
        }) satisfies ImageModelSpec,
    );
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
