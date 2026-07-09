import type { Experimental_VideoModelV4 } from "@ai-sdk/provider";
import type Agent from "@tokenring-ai/agent/Agent";
import { MetricsService } from "@tokenring-ai/metrics";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import { type GeneratedFile, type GenerateVideoResult, experimental_generateVideo as generateVideo } from "ai";
import { z } from "zod";

import type { ModelSettings } from "../ModelTypeRegistry.ts";
import { BaseModelSpecSchema, ProviderOptionsSchema } from "./modelCapabilities.ts";

export type VideoModel = Experimental_VideoModelV4;

export const VideoRequestSchema = z.object({
  prompt: z.union([
    z.string(),
    z.object({
      image: z.union([z.string(), z.custom<Uint8Array>()]),
      text: z.string().exactOptional(),
    }),
  ]),
  aspectRatio: z.custom<`${number}:${number}`>().exactOptional(),
  resolution: z.custom<`${number}x${number}`>().exactOptional(),
  duration: z.number().exactOptional(),
  fps: z.number().exactOptional(),
  seed: z.number().exactOptional(),
  n: z.number().exactOptional(),
  providerOptions: ProviderOptionsSchema.prefault({}),
});

export type VideoRequest = z.input<typeof VideoRequestSchema>;
export type ParsedVideoRequest = z.output<typeof VideoRequestSchema>;

export const VideoModelSpecSchema = BaseModelSpecSchema.extend({
  impl: z.custom<VideoModel>(),
  mangleRequest: z.custom<(req: ParsedVideoRequest, settings: ModelSettings) => void>().exactOptional(),

  calculateVideoCost: z.custom<(req: ParsedVideoRequest, res: GenerateVideoResult) => number>(),
});

export type VideoModelSpec = z.input<typeof VideoModelSpecSchema>;
export type ParsedVideoModelSpec = z.output<typeof VideoModelSpecSchema>;

/**
 * Client for generating videos using the Vercel AI SDK's experimental video generation functions.
 */
export default class AIVideoGenerationClient {
  constructor(
    private modelSpec: VideoModelSpec,
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
}
