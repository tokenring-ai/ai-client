import ChatService from "@token-ring/chat/ChatService";
import {Registry} from "@token-ring/registry";
import {
  experimental_generateImage as generateImage,
  type Experimental_GenerateImageResult,
  GeneratedFile,
  type ImageModel
} from "ai";


export type ImageRequest = {
  prompt: string;
  quality: string;
  size: `${number}x${number}`
  n: number;
};

export type ImageResponse = {
  mediaType: string;

  uint8Array: Uint8Array
}

export type ImageModelSpec = {
  /**
   * - The model provider code.
   */
  provider: string;
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
   * - A callback that checks whether the model is online and available for use.
   */
  isAvailable: () => Promise<boolean>;
  /**
   * - A callback to calculate the image cost
   */
  calculateImageCost?: (req: ImageRequest, res: ImageResponse) => number;
  /**
   * - A callback that checks whether the model is hot, or will need to be loaded.
   */
  isHot?: () => Promise<boolean>;

  mangleRequest?: (req: ImageRequest) => void;
};

/**
 * Client for generating images using the Vercel AI SDK's experimental image generation features.
 */
export default class AIImageGenerationClient {
  modelSpec: ImageModelSpec;

  /**
   * Creates an instance of AIImageGenerationClient.
   */
  constructor(modelSpec: ImageModelSpec) {
    this.modelSpec = modelSpec;
  }

  /**
   * Get the model ID.
   */
  getModelId(): string {
    return this.modelSpec.impl.modelId;
  }

  /**
   * Generates an image based on a prompt using the specified model.
   */
  async generateImage(request: ImageRequest, registry: Registry): Promise<[GeneratedFile, Experimental_GenerateImageResult]> {
    const chatService = registry.requireFirstServiceByType(ChatService);
    const signal = chatService.getAbortSignal();

    try {
      const result = await generateImage({
        ...request,
        n: 1,
        model: this.modelSpec.impl,
        abortSignal: signal,
      });

      return [result.image, result];
    } catch (error) {
      chatService.errorLine("Error generating image: ", error);
      throw error;
    }
  }
}