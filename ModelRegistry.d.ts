/**
 * @typedef {Object} ModelConfig
 * @property {string} provider - The name of the model provider
 * @property {string} [apiKey] - The API Key for the model provider
 * @property {string} [baseURL] - The Base URL for the model provider
 * @property {*}
 */
/**
 * @typedef {Object} ModelProvider
 * @property {function(ModelRegistry, ModelConfig): Promise<void>} init
 *
 */
/**
 * @typedef {Object} ChatModelRequirements
 * @property {string} [name] - The model name to match against the model specification
 * @property {string} [provider] - The model provider code, or 'auto' or undefined for any provider
 * @property {number} [contextLength] - Maximum context length in tokens the model allows
 * @property {number} [research] - Research ability (0-infinity)
 * @property {number} [reasoning] - Reasoning capability score (0-infinity)
 * @property {number} [intelligence] - Intelligence capability score (0-infinity)
 * @property {number} [speed] - Speed capability score (0-infinity)
 * @property {number} [webSearch] - Web search capability score (0-infinity)
 */
/**
 * Class for automatically routing chat requests to the most appropriate model
 * based on specific requirements
 */
export default class ModelRegistry extends Service {
    chat: ModelTypeRegistry<typeof AIChatClient, ChatModelSpec>;
    embedding: ModelTypeRegistry<typeof AIEmbeddingClient, any>;
    imageGeneration: ModelTypeRegistry<typeof AIImageGenerationClient, any>;
    /**
     * Registers a key: value object of model specs
     * @param {Object<string,ModelProvider>} providers
     * @param {ModelConfig} config
     */
    initializeModels(providers: {
        [x: string]: ModelProvider;
    }, config: ModelConfig): Promise<void>;
}
export type ModelConfig = {
    /**
     * - The name of the model provider
     */
    provider: string;
    /**
     * - The API Key for the model provider
     */
    apiKey?: string;
    /**
     * - The Base URL for the model provider
     */
    baseURL?: string;
    "": any;
};
export type ModelProvider = {
    init: (arg0: ModelRegistry, arg1: ModelConfig) => Promise<void>;
};
export type ChatModelRequirements = {
    /**
     * - The model name to match against the model specification
     */
    name?: string;
    /**
     * - The model provider code, or 'auto' or undefined for any provider
     */
    provider?: string;
    /**
     * - Maximum context length in tokens the model allows
     */
    contextLength?: number;
    /**
     * - Research ability (0-infinity)
     */
    research?: number;
    /**
     * - Reasoning capability score (0-infinity)
     */
    reasoning?: number;
    /**
     * - Intelligence capability score (0-infinity)
     */
    intelligence?: number;
    /**
     * - Speed capability score (0-infinity)
     */
    speed?: number;
    /**
     * - Web search capability score (0-infinity)
     */
    webSearch?: number;
};
import { Service } from "@token-ring/registry";
import AIChatClient from "./client/AIChatClient.js";
import { ModelTypeRegistry } from "./ModelTypeRegistry.js";
import AIEmbeddingClient from "./client/AIEmbeddingClient.js";
import AIImageGenerationClient from "./client/AIImageGenerationClient.js";
