/**
 * Registry for AI model specifications that uses a templated type for ModelSpec
 * @template {new (modelSpec: T) => any} C - The AIClient class type
 * @template T - The ModelSpec type used by the AIClient
 */
export class ModelTypeRegistry {
 /**
  * @param {C} AIClient - The AIClient class constructor
  * @param {function(any): Array<T>} filterModelSpecs - Function to filter model specs
  */
 constructor(AIClient, filterModelSpecs) {
  this.AIClient = AIClient;
  this.filterModelSpecs = filterModelSpecs
 }
 /** @type {Object<string, Array<T>>} */
 modelSpecs = {};

 /**
  * Registers a model with its metadata
  * @param {string} modelName - The model identifier
  * @param {T} metadata - Metadata about the model
  */
 registerModelSpec(modelName, metadata) {
  (this.modelSpecs[modelName] ??= []).push(metadata);
 }

 /**
  * Registers a key: value object of model specs
  * @param {Object<string, T>} modelSpecs - The model specs to register
  */
 registerAllModelSpecs(modelSpecs) {
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
 checkModelsAvailabilityInBackground() {
  setTimeout(async () => {
   try {
    await this.getAllModelsWithOnlineStatus();
   } catch (error) { /* empty */
   }
  }, 0);
 }

 /**
  * Gets all registered chatModels
  * @returns {Array<string>} Array of model identifiers
  */
 getRegisteredModelSpecs() {
  return Object.keys(this.modelSpecs);
 }

 /**
  * Gets all registered chatModels, with their online status
  * @returns {Promise<Array<{status: string, name: string, modelSpecs: Array<{available: boolean, hot: boolean, modelSpec: T}>}>>} Array of model specs with online status
  */
 async getAllModelsWithOnlineStatus() {
  let ret = [];
  for (const name in this.modelSpecs) {
   const specs = this.modelSpecs[name];

   let specRows = [];
   let status = 'offline';
   for (const spec of specs) {
    let available = spec.isAvailable instanceof Function ? await spec.isAvailable() : false; //true;
    let hot = spec.isHot ? await spec.isHot() : true;
    specRows.push({available, hot, modelSpec: spec});
    if (available) {
     if (hot) {
      status = 'online';
     } else if (status === 'offline') {
      status = 'cold';
     }
    }
   }
   ret.push({status, name, modelSpecs: specRows});
  }
  return ret;
 }

 /**
  * Gets all registered models grouped by provider, with their online status
  * @returns {Promise<Object.<string, Array<{status: string, name: string, modelSpecs: Array<{available: boolean, hot: boolean, modelSpec: T}>}>>>} Models grouped by provider
  */
 async getModelsByProvider() {
  const allModels = await this.getAllModelsWithOnlineStatus();
  const modelsByProvider = {};
  
  for (const model of allModels) {
   // Get provider from the first model spec (they should all have the same provider)
   const provider = model.modelSpecs[0]?.modelSpec?.provider || 'unknown';
   
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
  * @param {string} modelName - The model identifier
  * @returns {Array<T>|undefined} The model metadata or undefined if not found
  */
 getModelSpecs(modelName) {
  return this.modelSpecs[modelName]
 }

 /**
  * Gets the first chat client that matches the requirements and is online
  * @param {any} requirements - The filter criteria for model selection
  * @returns {Promise<InstanceType<C>>} A client instance that uses the selected model
  * @throws {Error} If no available model is found for the intent
  */
 async getFirstOnlineClient(requirements) {
  const modelSpecs = this.filterModelSpecs(requirements);

  // Find first hot model
  for (const modelSpec of modelSpecs) {
   let available = modelSpec.isAvailable ? await modelSpec.isAvailable() : true;
   if (available) {
    let isHot = modelSpec.isHot ? await modelSpec.isHot() : true;
    if (isHot) {
     return new this.AIClient(modelSpec);
    }
   }
  }

  // Fallback to a cold model
  for (const modelSpec of modelSpecs) {
   let available = modelSpec.isAvailable ? await modelSpec.isAvailable() : true;
   if (available) {
    return new this.AIClient(modelSpec);
   }
  }

  throw new Error(`No online model found`);
 }
}