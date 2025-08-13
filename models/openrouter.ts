import {openrouter} from "@openrouter/ai-sdk-provider";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";
import type ModelRegistry from "../ModelRegistry.ts";
import type {ModelConfig} from "../ModelRegistry.ts";
import type {ChatModelSpec} from "../client/AIChatClient.ts";

/**
 * The name of the AI provider.
 * @type {string}
 */
const providerName = "OpenRouter";

// Function to safely convert pricing string to number (cost per million tokens)
function parsePricing(priceString: string | null | undefined): number {
	if (
		priceString === null ||
		priceString === undefined ||
		priceString === "0"
	) {
		return 0;
	}
	const price = Number.parseFloat(priceString);
	return Number.isNaN(price) ? 0 : price * 1000000;
}

async function fetchAndRegisterOpenRouterModels(modelRegistry: ModelRegistry, config: ModelConfig & { modelFilter?: (model: any) => boolean }) {
	const getModels = cachedDataRetriever("https://openrouter.ai/api/v1/models", {
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
		},
	});

	const modelsData = await getModels();
	if (modelsData == null) return;

		const isAvailable = async () => true; // Models are available if we got data
	const provider = config.provider || providerName;
	const chatModelsSpec: Record<string, ChatModelSpec> = {};

	for (const model of modelsData.data) {
		if (!model.id) {
			continue;
		}

		if (config.modelFilter) {
			if (!config.modelFilter(model)) {
				continue;
			}
		}

		const isChatModel =
			model.architecture?.output_modalities?.includes("text") &&
			model.architecture?.input_modalities?.includes("text");

		if (isChatModel) {
			chatModelsSpec[model.id] = {
				provider,
				impl: openrouter(model.id),
				isAvailable,
				contextLength:
					model.context_length || model.top_provider?.context_length || 4096,
				maxCompletionTokens: model.top_provider?.max_completion_tokens,
				costPerMillionInputTokens: parsePricing(
					model.pricing?.prompt,
				),
				costPerMillionOutputTokens: parsePricing(
					model.pricing?.completion,
				),
				//reasoning: model.supported_parameters?.includes('include_reasoning') ? 2 : 0,
				//tools: model.supported_parameters?.includes('tools') ? 2 : 0,
				//webSearch: model.pricing?.web_search && model.pricing?.web_search !== "0" && model.pricing?.web_search !== null ? 1 : 0,
			};
		}
	}

	if (Object.keys(chatModelsSpec).length > 0) {
		await modelRegistry.chat.registerAllModelSpecs(chatModelsSpec);
	}
}

/**
 * @param {import('../ModelRegistry.ts').default} modelRegistry
 * @param {import("../ModelRegistry.ts").ModelConfig} config
 * @returns {Promise<void>}
 *
 */
export async function init(modelRegistry: ModelRegistry, config: ModelConfig & { modelFilter?: (model: any) => boolean }) {
	if (!config.apiKey) {
		throw new Error("No config.apiKey provided for OpenRouter provider.");
	}

	await fetchAndRegisterOpenRouterModels(modelRegistry, config);
}
