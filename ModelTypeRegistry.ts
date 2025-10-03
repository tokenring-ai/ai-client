import KeyedRegistry from "@tokenring-ai/utility/KeyedRegistry";
import type { ChatModelRequirements } from "./ModelRegistry.js";

export type ModelSpec = {
	modelId: string;
	providerDisplayName: string;
	isAvailable?: () => Promise<boolean>;
	isHot?: () => Promise<boolean>;
} & Record<string, any>;

export interface ModelStatus<T> {
	status: string;
	available: boolean;
	hot: boolean;
	modelSpec: T;
}

/**
 * Registry for AI model specifications that uses a templated type for ModelSpec
 *   with optional fields used by the registry helper methods
 *   (e.g., isAvailable, isHot, provider)
 */
export class ModelTypeRegistry<
	C extends new (
		modelSpec: any,
	) => any,
	T extends ModelSpec,
> {
	AIClient: C;
	modelSpecs = new KeyedRegistry<T>();

	/**
	 * Creates a new ModelTypeRegistry instance
	 */
	constructor(AIClient: C) {
		this.AIClient = AIClient;
	}

	/**
	 * Registers a model with its metadata
	 */
	registerModelSpec = this.modelSpecs.register;

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

			ret[name] = { status, available, hot, modelSpec: modelSpec };
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
	async getFirstOnlineClient(name: string): Promise<InstanceType<C>> {
		const modelSpec = this.modelSpecs.getItemByName(name);
		if (!modelSpec) {
			throw new Error(`Model ${name} not found`);
		}
		return new this.AIClient(modelSpec);
	}

	/**
	 * Gets the first chat client that matches the requirements and is online
	 */
	async getFirstOnlineClientByRequirements(
		requirements: ChatModelRequirements,
	): Promise<InstanceType<C>> {
		const modelSpecs = this.getModelSpecsByRequirements(requirements);

		// Find first hot model
		for (const modelSpec of modelSpecs) {
			const available = modelSpec.isAvailable
				? await modelSpec.isAvailable()
				: true;
			if (available) {
				const isHot = modelSpec.isHot ? await modelSpec.isHot() : true;
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

	/**
	 * Finds the chatModels that match the requirements and sorts them by the expected price of the query
	 */
	getModelSpecsByRequirements(requirements: ChatModelRequirements): T[] {
		requirements = { ...requirements };
		if (requirements.provider === "auto") delete requirements.provider;

		let estimatedContextLength = 10000;
		if (requirements.contextLength) {
			const [, value] =
				String(requirements.contextLength).match(/^[<>]?[=<>]?([^=<>].*)$/) ??
				[];

			estimatedContextLength = Math.max(
				estimatedContextLength,
				Number.parseInt(value),
			);
		}

		const eligibleModels = Object.entries(this.modelSpecs.getAllItems()).filter(
			([modelName, metadata]): boolean => {
				for (const [key, condition] of Object.entries(requirements)) {
					const [, operator, value] =
						String(condition).match(/^([<>]?[=<>]?)([^=<>].*)$/) ?? [];
					switch (operator) {
						case ">":
							if (!(metadata[key] > value)) {
								return false;
							}
							break;
						case "<":
							if (!(metadata[key] < value)) {
								return false;
							}
							break;
						case ">=":
							if (!(metadata[key] >= value)) {
								return false;
							}
							break;
						case "<=":
							if (!(metadata[key] <= value)) {
								return false;
							}
							break;
						case "":
						case "=":
							if (key === "name") {
								if (modelName !== value) {
									return false;
								}
							} else {
								// Type coercion is ok for this check, because we allow strings and numbers to coexist
								// eslint-disable-next-line eqeqeq
								if (metadata[key] != value) {
									return false;
								}
							}
							break;
						default:
							throw new Error(`Unknown operator '${operator}'`);
					}
				}
				return true;
			},
		);

		// Sort the matched chatModels by price, using the current context length + 1000 tokens to calculate the price
		return eligibleModels
			.map((el) => el[1])
			.sort((a, b) => {
				const aPrice =
					estimatedContextLength * (a.costPerMillionInputTokens ?? 600) +
					1000 * (a.costPerMillionOutputTokens ?? 600);
				const bPrice =
					estimatedContextLength * (b.costPerMillionInputTokens ?? 600) +
					1000 * (b.costPerMillionOutputTokens ?? 600);

				return aPrice - bPrice;
			});
	}
}
