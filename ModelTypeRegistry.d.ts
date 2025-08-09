/**
 * Registry for AI model specifications that uses a templated type for ModelSpec
 * @template {new (modelSpec: T) => any} C - The AIClient class type
 * @template T - The ModelSpec type used by the AIClient
 */
export class ModelTypeRegistry<C extends new (modelSpec: T) => any, T> {
    /**
     * @param {C} AIClient - The AIClient class constructor
     * @param {function(any): Array<T>} filterModelSpecs - Function to filter model specs
     */
    constructor(AIClient: C, filterModelSpecs: (arg0: any) => Array<T>);
    AIClient: C;
    filterModelSpecs: (arg0: any) => Array<T>;
    /** @type {Object<string, Array<T>>} */
    modelSpecs: {
        [x: string]: T[];
    };
    /**
     * Registers a model with its metadata
     * @param {string} modelName - The model identifier
     * @param {T} metadata - Metadata about the model
     */
    registerModelSpec(modelName: string, metadata: T): void;
    /**
     * Registers a key: value object of model specs
     * @param {Object<string, T>} modelSpecs - The model specs to register
     */
    registerAllModelSpecs(modelSpecs: {
        [x: string]: T;
    }): void;
    /**
     * Checks the availability of all registered chatModels in the background
     * This helps to pre-warm the cache for isAvailable checks
     */
    checkModelsAvailabilityInBackground(): void;
    /**
     * Gets all registered chatModels
     * @returns {Array<string>} Array of model identifiers
     */
    getRegisteredModelSpecs(): Array<string>;
    /**
     * Gets all registered chatModels, with their online status
     * @returns {Promise<Array<{status: string, name: string, modelSpecs: Array<{available: boolean, hot: boolean, modelSpec: T}>}>>} Array of model specs with online status
     */
    getAllModelsWithOnlineStatus(): Promise<Array<{
        status: string;
        name: string;
        modelSpecs: Array<{
            available: boolean;
            hot: boolean;
            modelSpec: T;
        }>;
    }>>;
    /**
     * Gets all registered models grouped by provider, with their online status
     * @returns {Promise<Object.<string, Array<{status: string, name: string, modelSpecs: Array<{available: boolean, hot: boolean, modelSpec: T}>}>>>} Models grouped by provider
     */
    getModelsByProvider(): Promise<{
        [x: string]: Array<{
            status: string;
            name: string;
            modelSpecs: Array<{
                available: boolean;
                hot: boolean;
                modelSpec: T;
            }>;
        }>;
    }>;
    /**
     * Gets metadata for a specific model
     * @param {string} modelName - The model identifier
     * @returns {Array<T>|undefined} The model metadata or undefined if not found
     */
    getModelSpecs(modelName: string): Array<T> | undefined;
    /**
     * Gets the first chat client that matches the requirements and is online
     * @param {any} requirements - The filter criteria for model selection
     * @returns {Promise<InstanceType<C>>} A client instance that uses the selected model
     * @throws {Error} If no available model is found for the intent
     */
    getFirstOnlineClient(requirements: any): Promise<InstanceType<C>>;
}
