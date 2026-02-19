import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import {PrimitiveType} from "@tokenring-ai/utility/types";
import {ModelRequirements} from "./schema.ts";
import {parseModelAndSettings} from "./util/modelSettings.ts";

export type SettingDefinition = {
  description: string;
} & ({
  type: "boolean";
  defaultValue?: boolean | undefined;
} | {
  type: "number";
  defaultValue?: number | undefined;
  min?: number;
  max?: number;
} | {
  type: "string";
  defaultValue?: string | undefined;
} | {
  type: "enum";
  defaultValue?: PrimitiveType;
  values: (PrimitiveType)[];
} | {
  type: "array";
  defaultValue?: (PrimitiveType)[] | undefined;
});

export type ChatModelSettings = Map<string, PrimitiveType | PrimitiveType[]>

export type ModelSpec = {
  modelId: string;
  providerDisplayName: string;
  isAvailable?: () => Promise<boolean>;
  isHot?: () => Promise<boolean>;
  settings?: Record<string, SettingDefinition>;
};

export interface ModelStatus<T> {
  status: string;
  available: boolean;
  hot: boolean;
  modelSpec: T;
}

export interface GenericAIClient {
  setSettings?(settings: ChatModelSettings): void;
}

/**
 * Registry for AI model specifications that uses a templated type for ModelSpec
 *   with optional fields used by the registry helper methods
 *   (e.g., isAvailable, isHot, provider)
 */
export class ModelTypeRegistry<
  T extends ModelSpec,
  C extends GenericAIClient,
  R extends ModelRequirements
> {

  modelSpecs = new KeyedRegistry<T>();
  /**
   * Registers a model with its metadata
   */
  registerModelSpec = this.modelSpecs.register;

  /**
   * Creates a new ModelTypeRegistry instance
   */
  constructor(private AIClient: new (
    modelSpec: T,
    settings: ChatModelSettings
  ) => C ) {}

  /**
   * Registers a key: value object of model specs
   */
  registerAllModelSpecs(modelSpecs: T[]): void {
    for (const modelSpec of modelSpecs) {
      this.modelSpecs.register(
        `${modelSpec.providerDisplayName}:${modelSpec.modelId}`.toLowerCase(),
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
   * Gets all registered chatModels, with their online status
   */
  async getAllModelsWithOnlineStatus(): Promise<
    Record<string, ModelStatus<T>>
  > {
    const ret: Record<string, ModelStatus<T>> = {};
    for (const [name, modelSpec] of this.modelSpecs.entries()) {
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
  async getClient(name: string): Promise<C> {
    const {base, settings} = parseModelAndSettings(name.toLowerCase());
    let lookupName = base;

    if (lookupName.includes("*")) {
      const matchedNames = this.modelSpecs.getItemNamesLike(lookupName);
      if (matchedNames.length > 1) {
        throw new Error(`Model ${lookupName} matched more than one model`);
      } else if (matchedNames.length === 1) {
        lookupName = matchedNames[0];
      } else {
        throw new Error(`Model matching ${lookupName} not found`);
      }
    }

    const modelSpec = this.modelSpecs.getItemByName(lookupName);
    if (!modelSpec) {
      throw new Error(`Model ${lookupName} not found`);
    }

    if (modelSpec.settings) {
      for (const [k, value] of settings.entries()) {
        const featureSpec = modelSpec.settings[k];
        if (!featureSpec) {
          throw new Error(`Unknown feature "${k}" for model ${lookupName}`);
        }
        if (featureSpec.type === "number" && typeof value === "number") {
          if (featureSpec.min !== undefined && value < featureSpec.min) {
            throw new Error(`Invalid value for feature "${k}" for model ${lookupName}: ${value} is lower than the minimum allowed value of ${featureSpec.min}`);
          }
          if (featureSpec.max !== undefined && value > featureSpec.max) {
            throw new Error(`Invalid value for feature "${k}" for model ${lookupName}: ${value} is higher than the maximum allowed value of ${featureSpec.max}`);
          }
        } else if (featureSpec.type === "enum" && !featureSpec.values.includes(value as PrimitiveType)) {
          settings.set(k, featureSpec.defaultValue);
        }
      }
    }

    return new this.AIClient(modelSpec, settings);
  }


  getModelSpecsByRequirements(nameLike: string) : Record<string,T> {
    const {base: modelSpec, settings: parsedSettings} = parseModelAndSettings(nameLike);
    const featureString = nameLike.includes("?") ? nameLike.substring(nameLike.indexOf("?") + 1) : undefined;
    const settings = new Set(parsedSettings.keys());

    const modelSpecs = this.modelSpecs.getItemNamesLike(modelSpec);

    return Object.fromEntries(
      modelSpecs.filter(modelName => {
        const spec = this.modelSpecs.getItemByName(modelName)
        for (const feature of settings) {
          if (!spec?.settings?.[feature]) {
            return false;
          }
        }
        return true;
      })
      .map(modelName => [modelName + (featureString ? `?${featureString}` : "")], modelSpec)
    );
  }
}
