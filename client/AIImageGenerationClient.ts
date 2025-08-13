import ChatService from "@token-ring/chat/ChatService";
import {experimental_generateImage as generateImage, type Experimental_GenerateImageResult, type ImageModel} from "ai";
import {Registry} from "@token-ring/registry";


export type ImageRequest = {
    prompt: string;
    size: `${number}x${number}`
    n: number;
};

export type ImageResponse = {
    mimeType: string;
    uint8Array: Uint8Array
}

export type ImageModelSpec = {
    /**
     * - The model provider code.
     */
    provider: string;
    /**
     * - Maximum context length in tokens (may not be applicable for image models).
     */
    contextLength?: number;
    /**
     * - Cost per million input tokens (may be used for prompt processing).
     */
    costPerMillionInputTokens?: number;
    /**
     * - Cost per million output tokens (may not be applicable, or cost is per image).
     */
    costPerMillionOutputTokens?: number;
    /**
     * - Cost per generated image (common pricing model for image generation).
     */
    costPerImage?: number;
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
    calculateImageCost: (arg0: object) => number;
    /**
     * - A callback that checks whether the model is hot, or will need to be loaded.
     */
    isHot?: () => Promise<boolean>;
};

/**
 * Client for generating images using the Vercel AI SDK's experimental image generation features.
 */
export default class AIImageGenerationClient {
    modelSpec: ImageModelSpec;

    /**
     * Creates an instance of AIImageGenerationClient.
     * @param {ImageModelSpec} modelSpec  – The image generation model specification to use.
     */
    constructor(modelSpec: ImageModelSpec) {
        this.modelSpec = modelSpec;
    }

    /**
     * Get the model ID.
     * @returns {string} The model ID.
     */
    getModelId(): string {
        return this.modelSpec.impl.modelId;
    }

    /**
     * Calculates the token cost. For image models, this might be an approximation
     * or based on prompt tokens if applicable. Because there is no standard, we always defer to the model to calculate it
     * @param {object} usage - The usage object from the response
     * @returns {number|undefined} The calculated cost.
     */
    getTokenCost(usage: object): number | undefined {
        return this.modelSpec?.calculateImageCost?.(usage);
    }

    /**
     * Generates an image based on a prompt using the specified model.
     */
    async generateImage(request: ImageRequest, registry: Registry): Promise<[ImageResponse, Experimental_GenerateImageResult]> {
        const chatService = registry.requireFirstServiceByType(ChatService);
        const signal = chatService.getAbortSignal();

        try {
            const result = await generateImage({
                ...request,
                n: 1,
                model: this.modelSpec.impl,
                abortSignal: signal,
            });

            return [result.image as ImageResponse, result];
        } catch (error) {
            chatService.errorLine("Error generating image: ", error);
            throw error;
        }
    }
}