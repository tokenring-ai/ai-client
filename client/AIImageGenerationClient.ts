import ChatService from "@token-ring/chat/ChatService";
import { experimental_generateImage as generateImage, type ImageModel } from "ai";
import { Registry as TokenRingRegistry } from "@token-ring/registry";

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
    isAvailable: () => Promise<any>;
    /**
     * - A callback to calculate the image cost
     */
    calculateImageCost: (arg0: object) => number;
    /**
     * - A callback that checks whether the model is hot, or will need to be loaded.
     */
    isHot?: () => Promise<any>;
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
     * @param {object} request - The image generation request parameters.
     * @param {TokenRingRegistry} registry - The package registry
     * @returns {Promise<[object, object]>} The generated image data and metadata.
     */
    async generateImage(request: { prompt: string } & Record<string, any>, registry: TokenRingRegistry): Promise<[any, any]> {
        if ((request as any).model)
            throw new Error("generateImage does not accept a model parameter");

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

    /**
     * Generates a response object from the result.
     * @param {ImageModelResponseData} ulResponse - The underlying response object
     * @returns {Promise<object>} The generated response object.
     */
    async generateResponseObject(ulResponse: any): Promise<object> {
        // Implementation for this method was not provided in the original JS file
        return {};
    }
}