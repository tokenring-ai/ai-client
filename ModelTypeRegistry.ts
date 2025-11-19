import KeyedRegistry from "@tokenring-ai/utility/KeyedRegistry";

export type FeatureSpec = {
  description: string;
} & ({
  type: "boolean";
  defaultValue: boolean;
} | {
  type: "number";
  defaultValue: number;
} | {
  type: "string";
  defaultValue: string;
} | {
  type: "enum";
  defaultValue: string;
  values: string[];
});

export type ModelSpec = {
  modelId: string;
  providerDisplayName: string;
  isAvailable?: () => Promise<boolean>;
  isHot?: () => Promise<boolean>;
  features?: Record<string, FeatureSpec>;
  //metaData?: Record<string, number>;
};

export interface ModelStatus<T> {
  status: string;
  available: boolean;
  hot: boolean;
  modelSpec: T;
}

export interface GenericAIClient {
  setFeatures?(features: Record<string, string | boolean | number>): void;
}

/**
 * Registry for AI model specifications that uses a templated type for ModelSpec
 *   with optional fields used by the registry helper methods
 *   (e.g., isAvailable, isHot, provider)
 */
export class ModelTypeRegistry<
  T extends ModelSpec,
  C extends GenericAIClient
> {
  AIClient: new (
    modelSpec: T,
    features: Record<string, string | boolean | number>
  ) => C;
  modelSpecs = new KeyedRegistry<T>();
  /**
   * Registers a model with its metadata
   */
  registerModelSpec = this.modelSpecs.register;

  /**
   * Creates a new ModelTypeRegistry instance
   */
  constructor(AIClient: typeof this.AIClient) {
    this.AIClient = AIClient;
  }

  /**
   * Registers a key: value object of model specs
   */
  registerAllModelSpecs(modelSpecs: T[]): void {
    for (const modelSpec of modelSpecs) {
      this.modelSpecs.register(
        `${modelSpec.providerDisplayName}:${modelSpec.modelId}`,
        modelSpec,
      );
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
  async getAllModelsWithOnlineStatus(): Promise<
    Record<string, ModelStatus<T>>
  > {
    const ret: Record<string, ModelStatus<T>> = {};
    for (const [name, modelSpec] of Object.entries(
      this.modelSpecs.getAllItems(),
    )) {
      let status = "offline";
      const available = modelSpec.isAvailable
        ? await modelSpec.isAvailable()
        : false;
      const hot = modelSpec.isHot ? await modelSpec.isHot() : true;
      if (available) {
        if (hot) {
          status = "online";
        } else if (status === "offline") {
          status = "cold";
        }
      }

      ret[name] = {status, available, hot, modelSpec: modelSpec};
    }
    return ret;
  }

  /**
   * Gets all registered models grouped by provider, with their online status
   */
  async getModelsByProvider(): Promise<
    Record<string, Record<string, ModelStatus<T>>>
  > {
    const allModels = await this.getAllModelsWithOnlineStatus();
    const modelsByProvider: Record<string, Record<string, ModelStatus<T>>> = {};

    for (const modelName in allModels) {
      const model = allModels[modelName];
      const leaf = (modelsByProvider[model.modelSpec.providerDisplayName] ??=
        {});
      leaf[modelName] = model;
    }

    return modelsByProvider;
  }

  /**
   * Gets the first chat client that matches the name and is online
   */
  async getFirstOnlineClient(name: string): Promise<C> {
    // Support feature query parameters in the model string (e.g. "openai/gpt-5?websearch=1")
    let lookupName = name;
    const qIndex = name.indexOf("?");
    if (qIndex >= 0) {
      lookupName = name.substring(0, qIndex);
    }

    const modelSpec = this.modelSpecs.getItemByName(lookupName);
    if (!modelSpec) {
      throw new Error(`Model ${lookupName} not found`);
    }

    let features: Record<string, string | boolean | number> | undefined = {};
    if (qIndex >= 0 && modelSpec.features) {
      const query = name.substring(qIndex + 1);
      for (const part of query.split("&")) {
        if (!part) continue;
        const [rawK, rawV] = part.split("=");
        const k = decodeURIComponent(rawK);
        const featureSpec = modelSpec.features[k];
        if (!featureSpec) {
          throw new Error(`Unknown feature "${k}" for model ${lookupName}`);
        }

        const rawValue = rawV === undefined ? "1" : decodeURIComponent(rawV);

        // Parse based on feature spec type
        let parsed: string | boolean | number;
        if (featureSpec.type === "boolean") {
          parsed = rawValue === "1" || rawValue.toLowerCase() === "true";
        } else if (featureSpec.type === "number") {
          const num = Number(rawValue);
          parsed = Number.isNaN(num) ? featureSpec.defaultValue : num;
        } else if (featureSpec.type === "enum") {
          parsed = featureSpec.values.includes(rawValue)
            ? rawValue
            : featureSpec.defaultValue;
        } else {
          parsed = rawValue;
        }

        features[k] = parsed;
      }
    }

    return new this.AIClient(modelSpec, features);
  }
}
