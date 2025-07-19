import AIChatClient from "./client/AIChatClient.js";
import {Service} from "@token-ring/registry";
import AIEmbeddingClient from "./client/AIEmbeddingClient.js";
import AIImageGenerationClient from "./client/AIImageGenerationClient.js";
import {ModelTypeRegistry} from "./ModelTypeRegistry.js";

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
 name = "ModelRegistry";
 description = "Provides a registry of AI Models";

 chat = new ModelTypeRegistry(AIChatClient, chatRequirementsFilter);
 embedding = new ModelTypeRegistry(AIEmbeddingClient, nameRequirementsFilter);
 imageGeneration = new ModelTypeRegistry(AIImageGenerationClient, nameRequirementsFilter);

 /**
  * Registers a key: value object of model specs
  * @param {Object<string,ModelProvider>} providers
  * @param {ModelConfig} config
  */
 async initializeModels(providers, config) {
  for (const providerName in config) {
   const providerConfig = config[providerName];
   if (typeof providerConfig !== 'object') {
    throw new Error(`Invalid model provider configuration for '${providerName}': config must be an object`);
   }
   const providerCode = providerConfig.provider;
   if (!providerCode) {
    throw new Error(`Invalid model provider configuration for '${providerName}': missing provider`);
   }
   const provider = providers[providerCode];
   if (!provider) {
    throw new Error(`Invalid model provider configuration for '${providerName}': unknown provider '${providerCode}'`);
   }
   await provider.init(this, providerConfig);
  }
 }
}

function nameRequirementsFilter(requirements) {
 if (typeof requirements === 'string') {
  requirements = {model: requirements};
 }

 return this.modelSpecs[requirements.model];
}
/**
 * Finds the chatModels that match the requirements and sorts them by the expected price of the query
 * @param {ChatModelRequirements|string} requirements - The filter criteria for model selection
 * @returns {[ChatModelSpec]} The selected model identifier or null if no suitable model found
 */
function chatRequirementsFilter(requirements) {
 if (typeof requirements === 'string') {
  if (this.modelSpecs[requirements]) {
   requirements = { name: requirements };
  } else {
   const parts = requirements.split(':');
   requirements = {};
   if (parts?.[1]) {
    requirements.provider = parts[0];

    const filters = parts[1].split(',');

    for (const filter of filters) {
     // Match patterns like "key>value", "key=value", or "key<value"
     const match = filter.match(/^([a-zA-Z0-9_]+)([><]?[><=])(.+)$/);
     if (match) {
      const [_, key, operator, value] = match;

      requirements[key] = `${operator}${value}`;
     }
    }
   } else {
    requirements.name = parts[0];
   }
  }
 }

 requirements = { ...requirements};
 if (requirements.provider === 'auto') delete requirements.provider;

 let estimatedContextLength = 10000;
 if (requirements.contextLength) {
  const [,value] = requirements.contextLength.match(/^[<>]?[=<>]?([^=<>].*)$/) ?? [];
  estimatedContextLength = Math.max(estimatedContextLength, value + 0)
 }

 const eligibleModels = [];

 for (const modelName of Object.keys(this.modelSpecs)) {
  const instances = this.modelSpecs[modelName];
  for (const metadata of instances) {
   // Check if the model meets all filter criteria
   let eligible = true;

   // Then check all other metadata criteria
   for (const [key, condition] of Object.entries(requirements)) {
    let [,operator,value] = condition.match(/^([<>]?[=<>]?)([^=<>].*)$/) ?? [];
    switch (operator) {
     case '>':
      if (!(metadata[key] > value)) {
       eligible = false;
      }
      break;
     case '<':
      if (!(metadata[key] < value)) {
       eligible = false;
      }
      break;
     case '>=':
      if (!(metadata[key] >= value)) {
       eligible = false;
      }
      break;
     case '<=':
      if (!(metadata[key] <= value)) {
       eligible = false;
      }
      break;
     case '':
     case '=':
      if (key === 'name') {
       if (modelName !== value) {
        eligible = false;
       }
      } else {
       // Type coercion is ok for this check, because we allow strings and numbers to coexist
       // noinspection EqualityComparisonWithCoercionJS
       if (metadata[key] != value) {
        eligible = false;
       }
      }
      break;
     default:
      throw new Error(`Unknown operator '${operator}'`)
    }

    if (!eligible) break;
   }

   if (eligible) {
    eligibleModels.push(metadata);
   }
  }
 }

 // Sort the matched chatModels by price, using the current context length + 1000 tokens to calculate the price
 return eligibleModels
 .sort((a, b) => {
  const aPrice = estimatedContextLength * (a.costPerMillionInputTokens ?? 600) + 1000 * (a.costPerMillionOutputTokens ?? 600);
  const bPrice = estimatedContextLength * (b.costPerMillionInputTokens ?? 600) + 1000 * (b.costPerMillionOutputTokens ?? 600);

  return aPrice - bPrice;
 });
}

