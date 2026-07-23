import type Agent from "@tokenring-ai/agent/Agent";
import { MetricsService } from "@tokenring-ai/metrics";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import { type GeneratedFile, type GenerateImageResult, generateImage } from "ai";
import type { z } from "zod";
import type { ImageRequest, ModelSettings } from "../schema.client.ts";
import { type ImageModelSpecSchema, ImageRequestSchema, type ImageSizingSchema } from "../schema.client.ts";
export type GenerateImageOptions = Parameters<typeof generateImage>["0"];

const aspectRatiosForShapes = {
  square: 1,
  landscape: 16 / 9,
  portrait: 9 / 16,
  ultrawide: 21 / 9,
  ultratall: 9 / 21,
};

const megapixelsForQuality = {
  ultra: 10,
  high: 4,
  standard: 1,
  low: 0.5,
};

export type ImageModelSpec = z.input<typeof ImageModelSpecSchema>;
export type ParsedImageModelSpec = z.output<typeof ImageModelSpecSchema>;

/**
 * Client for generating images using the Vercel AI SDK's experimental image generation settings.
 */
export default class AIImageGenerationClient {
  constructor(
    private modelSpec: ParsedImageModelSpec,
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

    const { widthAndHeight, ...extra } = parsedRequest;

    const result = await generateImage({
      ...extra,
      ...(widthAndHeight && { size: `${widthAndHeight.width}x${widthAndHeight.height}` }),
      model: this.modelSpec.impl,
      abortSignal: signal,
    });

    const cost = this.modelSpec.calculateImageCost(parsedRequest, result);

    agent.getServiceByType(MetricsService)?.addCost(`Image Generation (${this.modelSpec.providerDisplayName}:${this.modelSpec.modelId})`, cost, agent);

    return [result.image, result];
  }

  /**
   * Determine the best image size for the given sizing parameters.
   */
  determineBestSize(sizing: z.output<typeof ImageSizingSchema>): { width: number; height: number } | null {
    const spec = this.modelSpec;

    if (!spec.supportsSizeParameter) {
      return null;
    }

    if (sizing.method === "direct") {
      return sizing.size;
    }

    const targetRatio = aspectRatiosForShapes[sizing.shape];
    const targetMegapixels = megapixelsForQuality[sizing.quality];
    const constrainedMegapixels = Math.min(Math.max(targetMegapixels, spec.minimumMegapixels), spec.maximumMegapixels);

    if (spec.explicitSizes && spec.explicitSizes.length > 0) {
      let bestSize = spec.explicitSizes[0]!;
      let bestDiff = Infinity;

      for (const sizeTuple of spec.explicitSizes) {
        const [w, h] = sizeTuple;
        if (w === undefined || h === undefined) continue;
        const ratio = w / h;
        const diff = Math.abs(ratio - targetRatio);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestSize = sizeTuple;
        }
      }

      if (bestSize[0] !== undefined && bestSize[1] !== undefined) {
        return { width: bestSize[0], height: bestSize[1] };
      }
    }

    const totalPixels = constrainedMegapixels * 1_000_000;
    const width = Math.round(Math.sqrt(totalPixels * targetRatio));
    const height = Math.round(Math.sqrt(totalPixels / targetRatio));

    return {
      width,
      height,
    };
  }
}
