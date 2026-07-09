import type Agent from "@tokenring-ai/agent/Agent";
import { MetricsService } from "@tokenring-ai/metrics";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import { type GeneratedFile, type GenerateImageResult, generateImage, type ImageModel } from "ai";
import { z } from "zod";
import type { ModelSettings } from "../ModelTypeRegistry.ts";
import { BaseModelSpecSchema, ProviderOptionsSchema } from "./modelCapabilities.ts";

type GenerateImageOptions = Parameters<typeof generateImage>["0"];

export const ImageRequestSchema = z.object({
  prompt: z.custom<GenerateImageOptions["prompt"]>(),
  n: z.number().exactOptional(),
  maxImagesPerCall: z.number().exactOptional(),
  size: z.custom<`${number}x${number}`>(),
  aspectRatio: z.custom<`${number}:${number}`>().exactOptional(),
  seed: z.number().exactOptional(),
  providerOptions: ProviderOptionsSchema.prefault({}),
});

export type ImageRequest = z.input<typeof ImageRequestSchema>;
export type ParsedImageRequest = z.output<typeof ImageRequestSchema>;

export const ImageModelSpecSchema = BaseModelSpecSchema.extend({
  impl: z.custom<ImageModel>(),
  mangleRequest: z.custom<(req: ParsedImageRequest, settings: ModelSettings) => void>().exactOptional(),

  contextLength: z.number().exactOptional(),
  calculateImageCost: z.custom<(req: ParsedImageRequest, res: GenerateImageResult) => number>(),
});

export type ImageModelSpec = z.input<typeof ImageModelSpecSchema>;
export type ParsedImageModelSpec = z.output<typeof ImageModelSpecSchema>;

/**
 * Client for generating images using the Vercel AI SDK's experimental image generation settings.
 */
export default class AIImageGenerationClient {
  constructor(
    private modelSpec: ImageModelSpec,
    private settings: ModelSettings,
  ) {}

  /**
   * Set settings for this client instance.
   */
  setSettings(settings: ModelSettings): void {
    this.settings = new Map(settings.entries());
  }

  /**
   * Get a copy of the settings.
   */
  getSettings(): ModelSettings {
    return new Map(this.settings.entries());
  }

  /**
   * Get the model ID.
   */
  getModelId(): string {
    return this.modelSpec.modelId;
  }

  /**
   * Generates an image based on a prompt using the specified model.
   */
  async generateImage(request: ImageRequest, agent: Agent): Promise<[GeneratedFile, GenerateImageResult]> {
    const signal = agent.getAbortSignal();

    const parsedRequest = ImageRequestSchema.parse(request);
    parsedRequest.providerOptions = deepClone(this.modelSpec.providerOptions, parsedRequest.providerOptions);

    this.modelSpec.mangleRequest?.(parsedRequest, this.settings);

    const result = await generateImage({
      ...parsedRequest,
      model: this.modelSpec.impl,
      abortSignal: signal,
    });

    const cost = this.modelSpec.calculateImageCost(parsedRequest, result);

    agent.getServiceByType(MetricsService)?.addCost(`Image Generation (${this.modelSpec.providerDisplayName}:${this.modelSpec.modelId})`, cost, agent);

    return [result.image, result];
  }
}
