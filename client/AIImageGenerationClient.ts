import Agent from "@tokenring-ai/agent/Agent";
import {
  experimental_generateImage as generateImage,
  type Experimental_GenerateImageResult,
  type GeneratedFile,
  type ImageModel,
} from "ai";
import type {FeatureOptions, ModelSpec} from "../ModelTypeRegistry.js";

export type ImageRequest = {
  prompt: string;
  quality?: string;
  size: `${number}x${number}`;
  n: number;
};

export type ImageResponse = {
  mediaType: string;

  uint8Array: Uint8Array;
};

export type ImageModelSpec = ModelSpec & {
  /**
   * - Maximum context length in tokens
   */
  contextLength?: number;
  /**
   * - Cost per million input tokens (may be used for prompt processing).
   */
  costPerMillionInputTokens?: number;
  /**
   * - Cost per generated image (common pricing model for image generation).
   */
  costPerImage?: number;

  /**
   * - Cost per megapixel (may not be applicable, or cost is per image).
   */
  costPerMegapixel?: number;
  /**
   * - The AI SDK image generation model implementation.
   */
  impl: ImageModel;

  /**
   * - Provider-specific options for the image generation model.
   */
  providerOptions?: any;
  /**
   * - A callback to calculate the image cost
   */
  calculateImageCost?: (req: ImageRequest, res: ImageResponse) => number;

  /**
   * - Optional hook to adjust the request prior to sending.
   *   Receives the runtime feature flags as the second parameter.
   */
  mangleRequest?: (
    req: ImageRequest,
    features?: Record<string, any>,
  ) => void;
};

/**
 * Client for generating images using the Vercel AI SDK's experimental image generation features.
 */
export default class AIImageGenerationClient {
  modelSpec: ImageModelSpec;
  private features: FeatureOptions = {};

  /**
   * Creates an instance of AIImageGenerationClient.
   */
  constructor(modelSpec: ImageModelSpec, features: typeof this.features = {}) {
    this.modelSpec = modelSpec;
    this.features = features;
  }

  /**
   * Set feature flags for this client instance.
   */
  setFeatures(features: FeatureOptions | undefined): void {
    this.features = {...(features ?? {})};
  }

  /**
   * Get a copy of the feature flags.
   */
  getFeatures(): Record<string, any> {
    return {...this.features};
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
  async generateImage(
    request: ImageRequest,
    agent: Agent,
  ): Promise<[GeneratedFile, Experimental_GenerateImageResult]> {
    const signal = agent.getAbortSignal();

    try {
      if (this.modelSpec.mangleRequest) {
        request = {...request};
        this.modelSpec.mangleRequest(request, this.features);
      }
      const result = await generateImage({
        ...request,
        n: 1,
        model: this.modelSpec.impl,
        providerOptions: this.modelSpec.providerOptions ?? {},
        abortSignal: signal,
      });

      return [result.image, result];
    } catch (error) {
      agent.errorLine("Error generating image: ", error as Error);
      throw error;
    }
  }
}
