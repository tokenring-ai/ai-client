import Agent from "@tokenring-ai/agent/Agent";
import {MetricsService} from "@tokenring-ai/metrics";
import {
  experimental_generateVideo as generateVideo,
  type GenerateVideoResult,
  type GeneratedFile,
} from "ai";
import { Experimental_VideoModelV3 } from '@ai-sdk/provider';

import type {ChatModelSettings, ModelSpec} from "../ModelTypeRegistry.js";

export type VideoModel = Experimental_VideoModelV3;
export type VideoRequest = {
  prompt: string | { image: string | Uint8Array; text?: string };
  aspectRatio?: `${number}:${number}`;
  resolution?: `${number}x${number}`;
  duration?: number;
  fps?: number;
  seed?: number;
  n?: number;
};

export type VideoModelSpec = ModelSpec & {
  /**
   * - The AI SDK video generation model implementation.
   */
  impl: VideoModel;

  /**
   * - Provider-specific options for the video generation model.
   */
  providerOptions?: any;

  /**
   * - A callback to calculate the video cost based on request parameters and result.
   */
  calculateVideoCost: (req: VideoRequest, res: GenerateVideoResult) => number;

  /**
   * - Optional hook to adjust the request prior to sending.
   */
  mangleRequest?: (
    req: VideoRequest,
    settings?: ChatModelSettings,
  ) => void;
};

/**
 * Client for generating videos using the Vercel AI SDK's experimental video generation functions.
 */
export default class AIVideoGenerationClient {
  constructor(
    private modelSpec: VideoModelSpec,
    private settings: ChatModelSettings
  ) {}

  /**
   * Set settings for this client instance.
   */
  setSettings(settings: ChatModelSettings): void {
    this.settings = new Map(settings.entries());
  }

  /**
   * Get a copy of the settings.
   */
  getSettings(): ChatModelSettings {
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
  async generateVideo(
    request: VideoRequest,
    agent: Agent
  ): Promise<[GeneratedFile, GenerateVideoResult]> {
    const signal = agent.getAbortSignal();

    try {
      let finalRequest = { ...request };

      if (this.modelSpec.mangleRequest) {
        this.modelSpec.mangleRequest(finalRequest, this.settings);
      }

      const result = await generateVideo({
        ...finalRequest,
        model: this.modelSpec.impl,
        providerOptions: this.modelSpec.providerOptions ?? {},
        abortSignal: signal,
      });

      const cost = this.modelSpec.calculateVideoCost(finalRequest, result);

      agent.getServiceByType(MetricsService)?.addCost(
        `Video Generation (${this.modelSpec.providerDisplayName}:${this.modelSpec.modelId})`,
        cost,
        agent
      );

      return [result.video, result];
    } catch (error) {
      agent.errorMessage("Error generating video: ", error as Error);
      throw error;
    }
  }
}