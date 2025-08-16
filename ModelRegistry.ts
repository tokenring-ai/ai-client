import {Service} from "@token-ring/registry";
import AIChatClient from "./client/AIChatClient.js";
import AIEmbeddingClient from "./client/AIEmbeddingClient.js";
import AIImageGenerationClient from "./client/AIImageGenerationClient.js";
import {ModelTypeRegistry} from "./ModelTypeRegistry.js";

export type ModelConfig = {
  /**
   * The name of the model provider
   */
  provider: string;
  /**
   * The API Key for the model provider
   */
  apiKey?: string;
  /**
   * The Base URL for the model provider
   */
  baseURL?: string;

  [key: string]: any;
};

export type ModelProvider = {
  init: (registry: ModelRegistry, config: ModelConfig) => Promise<void>;
};

export type ModelNameRequirements = {
  /**
   * The model name to match
   */
  model?: string;
};

export type ChatModelRequirements = {
  /**
   * The model name to match against the model specification
   */
  name?: string;
  /**
   * The model provider code, or 'auto' or undefined for any provider
   */
  provider?: string;
  /**
   * Maximum context length in tokens the model allows
   */
  contextLength?: number;
  /**
   * Maximum output tokens the model allows
   */
  maxCompletionTokens?: number;
  /**
   * Research ability (0-infinity)
   */
  research?: number;
  /**
   * Reasoning capability score (0-infinity)
   */
  reasoning?: number;
  /**
   * Intelligence capability score (0-infinity)
   */
  intelligence?: number;
  /**
   * Speed capability score (0-infinity)
   */
  speed?: number;
  /**
   * Web search capability score (0-infinity)
   */
  webSearch?: number;
};

/**
 * Class for automatically routing chat requests to the most appropriate model
 * based on specific requirements
 */
export default class ModelRegistry extends Service {
  name = "ModelRegistry";
  description = "Provides a registry of AI Models";

  chat = new ModelTypeRegistry(AIChatClient, chatRequirementsFilter);
  embedding = new ModelTypeRegistry(AIEmbeddingClient,
    nameRequirementsFilter
  );
  imageGeneration = new ModelTypeRegistry(AIImageGenerationClient,
    nameRequirementsFilter
  );

  /**
   * Registers a key: value object of model specs
   * @param providers - Object mapping provider codes to provider implementations
   * @param config - Configuration for each provider
   */
  async initializeModels(
    providers: Record<string, ModelProvider>,
    config: Record<string, ModelConfig>
  ): Promise<void> {
    for (const providerName in config) {
      const providerConfig = config[providerName];
      if (typeof providerConfig !== "object") {
        throw new Error(
          `Invalid model provider configuration for '${providerName}': config must be an object`
        );
      }
      const providerCode = providerConfig.provider;
      if (!providerCode) {
        throw new Error(
          `Invalid model provider configuration for '${providerName}': missing provider`
        );
      }
      const provider = providers[providerCode];
      if (!provider) {
        throw new Error(
          `Invalid model provider configuration for '${providerName}': unknown provider '${providerCode}'`
        );
      }
      try {
        await provider.init(this, providerConfig);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `Error initializing model provider '${providerCode}', skipping provider:`,
          msg
        );
      }
    }
  }
}

/**
 * Filters model specifications by name requirements
 * @param requirements - The name requirements to filter by
 * @returns The matching model specifications (empty if none)
 */
function nameRequirementsFilter(
  this: ModelTypeRegistry<any, any>,
  requirements: ModelNameRequirements | string
): Array<any> {
  if (typeof requirements === "string") {
    requirements = {model: requirements};
  }
  const model = requirements.model;
  return model ? this.modelSpecs[model] ?? [] : [];
}

/**
 * Finds the chatModels that match the requirements and sorts them by the expected price of the query
 * @param requirements - The filter criteria for model selection
 * @returns The selected models sorted by estimated price
 */
function chatRequirementsFilter(
  this: ModelTypeRegistry<any, any>,
  requirements: ChatModelRequirements | string
): Array<any> {
  if (typeof requirements === "string") {
    if (this.modelSpecs[requirements]) {
      requirements = {name: requirements};
    } else {
      const parts = requirements.split(":");
      requirements = {} as ChatModelRequirements;
      if (parts?.[1]) {
        requirements.provider = parts[0];

        const filters = parts[1].split(",");

        for (const filter of filters) {
          // Match patterns like "key>value", "key=value", or "key<value"
          const match = filter.match(/^([a-zA-Z0-9_]+)([><]?[><=])(.+)$/);
          if (match) {
            const [_, key, operator, value] = match;
            // @ts-ignore
            requirements[key] = `${operator}${value}`;
          }
        }
      } else {
        requirements.name = parts[0];
      }
    }
  }

  requirements = {...requirements};
  if (requirements.provider === "auto") delete requirements.provider;

  let estimatedContextLength = 10000;
  if (requirements.contextLength) {
    const [, value] =
    String(requirements.contextLength).match(/^[<>]?[=<>]?([^=<>].*)$/) ?? [];
    estimatedContextLength = Math.max(
      estimatedContextLength,
      Number.parseInt(value)
    );
  }

  const eligibleModels: any[] = [];

  for (const modelName of Object.keys(this.modelSpecs)) {
    const instances = this.modelSpecs[modelName];
    for (const metadata of instances) {
      // Check if the model meets all filter criteria
      let eligible = true;

      // Then check all other metadata criteria
      for (const [key, condition] of Object.entries(requirements)) {
        const [, operator, value] =
        String(condition).match(/^([<>]?[=<>]?)([^=<>].*)$/) ?? [];
        switch (operator) {
          case ">":
            if (!(metadata[key] > value)) {
              eligible = false;
            }
            break;
          case "<":
            if (!(metadata[key] < value)) {
              eligible = false;
            }
            break;
          case ">=":
            if (!(metadata[key] >= value)) {
              eligible = false;
            }
            break;
          case "<=":
            if (!(metadata[key] <= value)) {
              eligible = false;
            }
            break;
          case "":
          case "=":
            if (key === "name") {
              if (modelName !== value) {
                eligible = false;
              }
            } else {
              // Type coercion is ok for this check, because we allow strings and numbers to coexist
              // eslint-disable-next-line eqeqeq
              if (metadata[key] != value) {
                eligible = false;
              }
            }
            break;
          default:
            throw new Error(`Unknown operator '${operator}'`);
        }

        if (!eligible) break;
      }

      if (eligible) {
        eligibleModels.push(metadata);
      }
    }
  }

  // Sort the matched chatModels by price, using the current context length + 1000 tokens to calculate the price
  return eligibleModels.sort((a, b) => {
    const aPrice =
      estimatedContextLength * (a.costPerMillionInputTokens ?? 600) +
      1000 * (a.costPerMillionOutputTokens ?? 600);
    const bPrice =
      estimatedContextLength * (b.costPerMillionInputTokens ?? 600) +
      1000 * (b.costPerMillionOutputTokens ?? 600);

    return aPrice - bPrice;
  });
}