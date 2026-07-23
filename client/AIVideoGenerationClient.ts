import type { Experimental_VideoModelV4 } from "@ai-sdk/provider";
import type Agent from "@tokenring-ai/agent/Agent";
import { MetricsService } from "@tokenring-ai/metrics";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import { type GeneratedFile, type GenerateVideoResult, experimental_generateVideo as generateVideo } from "ai";
import { z } from "zod";
import type { DeterminedVideoSizing, ModelSettings, ParsedVideoSizing, VideoRequest } from "../schema.client.ts";
import { BaseModelSpecSchema, VideoRequestSchema } from "../schema.client.ts";

export type VideoModel = Experimental_VideoModelV4;

const aspectRatiosForShapes = {
  square: { ratio: 1, label: "1:1" as const },
  landscape: { ratio: 16 / 9, label: "16:9" as const },
  portrait: { ratio: 9 / 16, label: "9:16" as const },
  ultrawide: { ratio: 21 / 9, label: "21:9" as const },
  ultratall: { ratio: 9 / 21, label: "9:21" as const },
};

const megapixelsForQuality = {
  ultra: 8.3,
  high: 2.1,
  standard: 0.9,
  low: 0.4,
};

export type ParsedVideoRequest = z.output<typeof VideoRequestSchema>;

export const VideoModelSpecSchema = BaseModelSpecSchema.extend({
  impl: z.custom<VideoModel>(),
  mangleRequest: z.custom<(req: ParsedVideoRequest, settings: ModelSettings) => void>().exactOptional(),

  calculateVideoCost: z.custom<(req: ParsedVideoRequest, res: GenerateVideoResult) => number>(),

  supportsAspectRatioParameter: z.boolean().default(true),
  supportsResolutionParameter: z.boolean().default(true),
  minimumMegapixels: z.number().default(0.25),
  maximumMegapixels: z.number().default(8.3),
  explicitResolutions: z.array(z.array(z.number())).exactOptional(),
});

export type VideoModelSpec = z.input<typeof VideoModelSpecSchema>;
export type ParsedVideoModelSpec = z.output<typeof VideoModelSpecSchema>;

/**
 * Client for generating videos using the Vercel AI SDK's experimental video generation functions.
 */
export default class AIVideoGenerationClient {
  constructor(
    private modelSpec: ParsedVideoModelSpec,
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
   * Generates a video based on a prompt or image using the specified model.
   */
  async generateVideo(request: VideoRequest, agent: Agent): Promise<[GeneratedFile, GenerateVideoResult]> {
    const signal = agent.getAbortSignal();

    const parsedRequest = VideoRequestSchema.parse(request);
    parsedRequest.providerOptions = deepClone(this.modelSpec.providerOptions, parsedRequest.providerOptions);

    this.modelSpec.mangleRequest?.(parsedRequest, this.settings);

    const result = await generateVideo({
      ...parsedRequest,
      model: this.modelSpec.impl,
      abortSignal: signal,
    });

    const cost = this.modelSpec.calculateVideoCost(parsedRequest, result);

    agent.getServiceByType(MetricsService)?.addCost(`Video Generation (${this.modelSpec.providerDisplayName}:${this.modelSpec.modelId})`, cost, agent);

    return [result.video, result];
  }

  /**
   * Determine the best aspect ratio / resolution for the given sizing parameters.
   */
  determineBestSizing(sizing: ParsedVideoSizing): DeterminedVideoSizing | null {
    const spec = this.modelSpec;

    if (!spec.supportsAspectRatioParameter && !spec.supportsResolutionParameter) {
      return null;
    }

    if (sizing.method === "direct") {
      return this.formatDirectSizing(sizing);
    }

    const shapeInfo = aspectRatiosForShapes[sizing.shape];
    const targetRatio = shapeInfo.ratio;
    const targetMegapixels = megapixelsForQuality[sizing.quality];
    const constrainedMegapixels = Math.min(Math.max(targetMegapixels, spec.minimumMegapixels), spec.maximumMegapixels);

    let width: number;
    let height: number;

    if (spec.explicitResolutions && spec.explicitResolutions.length > 0) {
      let bestSize = spec.explicitResolutions[0]!;
      let bestScore = Infinity;

      for (const sizeTuple of spec.explicitResolutions) {
        const [w, h] = sizeTuple;
        if (w === undefined || h === undefined) continue;
        const ratio = w / h;
        const megapixels = (w * h) / 1_000_000;
        const ratioDiff = Math.abs(ratio - targetRatio);
        const mpDiff = Math.abs(megapixels - constrainedMegapixels);
        // Prefer matching aspect ratio, then megapixels
        const score = ratioDiff * 10 + mpDiff;
        if (score < bestScore) {
          bestScore = score;
          bestSize = sizeTuple;
        }
      }

      if (bestSize[0] === undefined || bestSize[1] === undefined) {
        return null;
      }
      width = bestSize[0];
      height = bestSize[1];
    } else {
      const totalPixels = constrainedMegapixels * 1_000_000;
      width = Math.round(Math.sqrt(totalPixels * targetRatio));
      height = Math.round(Math.sqrt(totalPixels / targetRatio));
      // Round to even dimensions (common video requirement)
      width = width % 2 === 0 ? width : width + 1;
      height = height % 2 === 0 ? height : height + 1;
    }

    const result: DeterminedVideoSizing = {
      width,
      height,
    };

    if (spec.supportsAspectRatioParameter) {
      result.aspectRatio = shapeInfo.label;
    }
    if (spec.supportsResolutionParameter) {
      result.resolution = `${width}x${height}`;
    }

    return result;
  }

  private formatDirectSizing(sizing: Extract<ParsedVideoSizing, { method: "direct" }>): DeterminedVideoSizing | null {
    const spec = this.modelSpec;
    const result: DeterminedVideoSizing = {};

    if (sizing.resolution) {
      result.width = sizing.resolution.width;
      result.height = sizing.resolution.height;
      if (spec.supportsResolutionParameter) {
        result.resolution = `${sizing.resolution.width}x${sizing.resolution.height}`;
      }
      if (spec.supportsAspectRatioParameter && !sizing.aspectRatio) {
        result.aspectRatio = `${sizing.resolution.width}:${sizing.resolution.height}`;
      }
    }

    if (sizing.aspectRatio) {
      if (spec.supportsAspectRatioParameter) {
        result.aspectRatio = `${sizing.aspectRatio.width}:${sizing.aspectRatio.height}`;
      }
      if (!result.width && !result.height) {
        result.width = sizing.aspectRatio.width;
        result.height = sizing.aspectRatio.height;
      }
    }

    if (!result.aspectRatio && !result.resolution) {
      return null;
    }

    return result;
  }
}
