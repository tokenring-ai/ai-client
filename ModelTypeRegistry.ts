import {ChatModelRequirements} from "./ModelRegistry.js";

interface ModelSpec {
  name: string,
  providerDisplayName: string,
  isAvailable: () => Promise<boolean>;
  isHot: () => Promise<boolean>;
}

/**
 * Registry for AI model specifications that uses a templated type for ModelSpec
 *   with optional fields used by the registry helper methods
 *   (e.g., isAvailable, isHot, provider)
 */
export class ModelTypeRegistry<C extends new (modelSpec: T) => any, T extends ModelSpec> {
  AIClient: C;
  filterModelSpecs: (arg0: any) => Array<T>;
  modelSpecs: { [x: string]: T[] } = {};

  /**
   * Creates a new ModelTypeRegistry instance
   */
  constructor(AIClient: C, filterModelSpecs: (arg0: any) => Array<T>) {
    this.AIClient = AIClient;
    // bind filter to this registry so helper filters can use `this`
    this.filterModelSpecs = filterModelSpecs.bind(this);
  }

  /**
   * Registers a model with its metadata
   */
  registerModelSpec(modelName: string, metadata: T): void {
    (this.modelSpecs[modelName] ??= []).push(metadata);
  }

  /**
   * Registers a key: value object of model specs
   */
  registerAllModelSpecs(modelSpecs: { [x: string]: T }): void {
    for (const modelName in modelSpecs) {
      this.registerModelSpec(modelName, modelSpecs[modelName]);
    }
    // Check model availability in the background
    this.checkModelsAvailabilityInBackground();
  }

  /**
   * Checks the availability of all registered chatModels in the background
   * This helps to pre-warm the cache for isAvailable checks
   */
  checkModelsAvailabilityInBackground(): void {
    setTimeout(async () => {
      try {
        await this.getAllModelsWithOnlineStatus();
      } catch (_error) {
        /* empty */
      }
    }, 0).unref();
  }

  /**
   * Gets all registered chatModels
   * @returns {Array<string>} Array of model identifiers
   */
  getRegisteredModelSpecs(): Array<string> {
    return Object.keys(this.modelSpecs);
  }

  /**
   * Gets all registered chatModels, with their online status
   */
  async getAllModelsWithOnlineStatus(): Promise<Array<{
    status: string;
    name: string;
    modelSpecs: Array<{
      available: boolean;
      hot: boolean;
      modelSpec: T;
    }>;
  }>> {
    const ret = [];
    for (const name in this.modelSpecs) {
      const specs = this.modelSpecs[name];

      const specRows = [];
      let status = "offline";
      for (const spec of specs) {
        const available =
          spec.isAvailable ? await spec.isAvailable() : false;
        const hot = spec.isHot ? await spec.isHot() : true;
        specRows.push({available, hot, modelSpec: spec});
        if (available) {
          if (hot) {
            status = "online";
          } else if (status === "offline") {
            status = "cold";
          }
        }
      }
      ret.push({status, name, modelSpecs: specRows});
    }
    return ret;
  }

  /**
   * Gets all registered models grouped by provider, with their online status
   */
  async getModelsByProvider(): Promise<{
    [x: string]: Array<{
      status: string;
      name: string;
      modelSpecs: Array<{
        available: boolean;
        hot: boolean;
        modelSpec: T;
      }>;
    }>;
  }> {
    const allModels = await this.getAllModelsWithOnlineStatus();
    const modelsByProvider: Record<string, Array<{
      status: string;
      name: string;
      modelSpecs: Array<{
        available: boolean;
        hot: boolean;
        modelSpec: T;
      }>;
    }>> = {};

    for (const model of allModels) {
      // Get provider from the first model spec (they should all have the same provider)
      const provider =
        (model.modelSpecs[0]?.modelSpec)?.providerDisplayName ||
        "unknown";

      if (!modelsByProvider[provider]) {
        modelsByProvider[provider] = [];
      }
      modelsByProvider[provider].push(model);
    }

    // Sort models within each provider by name
    for (const provider in modelsByProvider) {
      modelsByProvider[provider].sort((a, b) => a.name.localeCompare(b.name));
    }

    return modelsByProvider;
  }

  /**
   * Gets metadata for a specific model
   */
  getModelSpecs(modelName: string): Array<T> | undefined {
    return this.modelSpecs[modelName];
  }

  /**
   * Gets the first chat client that matches the requirements and is online
   */
  async getFirstOnlineClient(requirements: ChatModelRequirements | string): Promise<InstanceType<C>> {
    const modelSpecs = this.filterModelSpecs(requirements);

    // Find first hot model
    for (const modelSpec of modelSpecs) {
      const available = modelSpec.isAvailable
        ? await modelSpec.isAvailable()
        : true;
      if (available) {
        const isHot = modelSpec.isHot
          ? await modelSpec.isHot()
          : true;
        if (isHot) {
          return new this.AIClient(modelSpec);
        }
      }
    }

    // Fallback to a cold model
    for (const modelSpec of modelSpecs) {
      const available = modelSpec.isAvailable
        ? await modelSpec.isAvailable()
        : true;
      if (available) {
        return new this.AIClient(modelSpec);
      }
    }

    throw new Error(`No online model found`);
  }
}