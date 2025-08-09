/**
 * @typedef {Object} ImageModelSpec
 * @property {string} provider - The model provider code.
 * @property {number} [contextLength] - Maximum context length in tokens (may not be applicable for image models).
 * @property {number} [costPerMillionInputTokens] - Cost per million input tokens (may be used for prompt processing).
 * @property {number} [costPerMillionOutputTokens] - Cost per million output tokens (may not be applicable, or cost is per image).
 * @property {number} [costPerImage] - Cost per generated image (common pricing model for image generation).
 * @property {import("ai").ImageGenerationModel} impl - The AI SDK image generation model implementation.
 * @property {function(): Promise<any>} isAvailable - A callback that checks whether the model is online and available for use.
 * @property {function(object): number} calculateImageCost - A callback to calculate the image cost
 * @property {function(): Promise<any>} [isHot] - A callback that checks whether the model is hot, or will need to be loaded.
 */
/**
 * Client for generating images using the Vercel AI SDK's experimental image generation features.
 */
export default class AIImageGenerationClient {
    /**
     * Creates an instance of AIImageGenerationClient.
     * @param {ImageModelSpec} modelSpec  – The image generation model specification to use.
     */
    constructor(modelSpec: ImageModelSpec);
    modelSpec: ImageModelSpec;
    /**
     * Get the model ID.
     * @returns {string} The model ID.
     */
    getModelId(): string;
    /**
     * Calculates the token cost. For image models, this might be an approximation
     * or based on prompt tokens if applicable. Because there is no standard, we always defer to the model to calculate it
     * @param {object} usage - The usage object from the response
     * @returns {number|undefined} The calculated cost.
     */
    getTokenCost(usage: object): number | undefined;
    /**
     * Generates an image based on a prompt using the specified model.
     * @param {object} request - The image generation request parameters.
     * @param {TokenRingRegistry} registry - The package registry
     * @returns {Promise<[object, object]>} The generated image data and metadata.
     */
    generateImage(request: object, registry: TokenRingRegistry): Promise<[object, object]>;
    /**
     * Generates a response object from the result.
     * @param {import('ai').ImageModelResponseData} ulResponse - The underlying response object
     * @returns {Promise<object>} The generated response object.
     */
    generateResponseObject(ulResponse: import("ai").ImageModelResponseData): Promise<object>;
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
    impl: import("ai").ImageGenerationModel;
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
