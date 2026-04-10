import type Agent from "@tokenring-ai/agent/Agent";
import {MetricsService} from "@tokenring-ai/metrics";
import {type GeneratedFile, generateImage, type GenerateImageResult, type ImageModel,} from "ai";
import {z} from "zod";
import type {ChatModelSettings, ModelSpec} from "../ModelTypeRegistry.ts";
import {createModelSpecSchema, type ModelInputCapabilities, ModelInputCapabilitiesSchema,} from "./modelCapabilities.ts";

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
  inputCapabilities?: Partial<ModelInputCapabilities>;

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
  mangleRequest?: (req: ImageRequest, settings?: Record<string, any>) => void;
};

export const ImageModelSpecSchema = createModelSpecSchema(
  ModelInputCapabilitiesSchema,
).extend({
  contextLength: z.number().optional(),
  calculateImageCost: z.function({
    input: z.tuple([z.any(), z.any()]),
    output: z.number(),
  }),
});

export function normalizeImageModelSpec(
  modelSpec: ImageModelSpec,
): ImageModelSpec {
  return ImageModelSpecSchema.parse({
    ...modelSpec,
    inputCapabilities: modelSpec.inputCapabilities ?? {},
  }) as ImageModelSpec;
}

/**
 * Client for generating images using the Vercel AI SDK's experimental image generation settings.
 */
export default class AIImageGenerationClient {
  constructor(
    private modelSpec: ImageModelSpec,
    private settings: ChatModelSettings,
  ) {
  }

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

      agent
        .getServiceByType(MetricsService)
        ?.addCost(
          `Image Generation (${this.modelSpec.providerDisplayName}:${this.modelSpec.modelId})`,
          cost,
          agent,
        );

      return [result.image, result];
    } catch (error) {
      agent.errorMessage("Error generating image: ", error as Error);
      throw error;
    }
  }
}
