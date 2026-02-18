import Agent from "@tokenring-ai/agent/Agent";
import {type GeneratedFile, generateImage, type GenerateImageResult, type ImageModel,} from "ai";
import type {ChatModelSettings, ModelSpec} from "../ModelTypeRegistry.js";

export type ImageRequest = {
  prompt: string;
  quality?: string;
  size: `${number}x${number}`;
  n: number;
};

export type ImageModelSpec = ModelSpec & {
  /**
   * - Maximum context length in tokens
   */
  contextLength?: number;
  /**
   * - Cost per million input tokens
   */
  //costPerMillionInputTokens?: number;
  /**
   * - Cost per generated image
   */
  //costPerImage?: number;

  /**
   * - Cost per megapixel (may not be applicable, or cost is per image).
   */
  //costPerMegapixel?: number;
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
  calculateImageCost: (req: ImageRequest, res: GenerateImageResult) => number;

  /**
   * - Optional hook to adjust the request prior to sending.
   *   Receives the runtime feature flags as the second parameter.
   */
  mangleRequest?: (
    req: ImageRequest,
    settings?: Record<string, any>,
  ) => void;
};

/**
 * Client for generating images using the Vercel AI SDK's experimental image generation settings.
 */
export default class AIImageGenerationClient {
  constructor(private modelSpec: ImageModelSpec, private settings: ChatModelSettings = {}) {
  }

  /**
   * Set feature flags for this client instance.
   */
  setSettings(settings: ChatModelSettings | undefined): void {
    this.settings = {...(settings ?? {})};
  }

  /**
   * Get a copy of the feature flags.
   */
  getSettings(): Record<string, any> {
    return {...this.settings};
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
  ): Promise<[GeneratedFile, GenerateImageResult]> {
    const signal = agent.getAbortSignal();

    try {
      if (this.modelSpec.mangleRequest) {
        request = {...request};
        this.modelSpec.mangleRequest(request, this.settings);
      }
      const result = await generateImage({
        ...request,
        n: 1,
        model: this.modelSpec.impl,
        providerOptions: this.modelSpec.providerOptions ?? {},
        abortSignal: signal,
      });

      const cost = this.modelSpec.calculateImageCost(request, result);

      agent.addCost(`Image Generation (${this.modelSpec.providerDisplayName}:${this.modelSpec.modelId})`, cost);


      return [result.image, result];
    } catch (error) {
      agent.errorMessage("Error generating image: ", error as Error);
      throw error;
    }
  }
}
