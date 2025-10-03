import { xai } from "@ai-sdk/xai";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
import type { ImageModelSpec } from "../client/AIImageGenerationClient.js";
import ModelRegistry, { type ModelProviderInfo } from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

interface Model {
	id: string;
	object: "model";
	created: number;
	owned_by: string;
}

interface ModelList {
	object: "list";
	data: Model[];
}

export interface XAIModelProviderConfig extends ModelProviderInfo {
	apiKey: string;
}

export async function init(
	modelRegistry: ModelRegistry,
	config: XAIModelProviderConfig,
) {
	if (!config.apiKey) {
		throw new Error("No config.apiKey provided for xAI provider.");
	}

	const getModels = cachedDataRetriever("https://api.x.ai/v1/models", {
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
		},
	}) as () => Promise<ModelList | null>;

	function generateModelSpec(
		modelId: string,
		modelSpec: Omit<
			ChatModelSpec,
			"isAvailable" | "provider" | "providerDisplayName" | "impl" | "modelId"
		>,
	): ChatModelSpec {
		return {
			modelId,
			providerDisplayName: config.providerDisplayName,
			impl: xai(modelId),
			async isAvailable() {
				const modelList = await getModels();
				return !!modelList?.data.some((model) => model.id === modelId);
			},
			...modelSpec,
		} as ChatModelSpec;
	}

	/**
	 * A collection of xAI chat model specifications.
	 * Each key is a model ID, and the value is a `ChatModelSpec` object.
	 * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.ts).
	 */
	modelRegistry.chat.registerAllModelSpecs([
		generateModelSpec("grok-code-fast-1", {
			costPerMillionInputTokens: 0.2,
			costPerMillionCachedInputTokens: 0.02,
			costPerMillionOutputTokens: 1.5,
			reasoningText: 5,
			intelligence: 5,
			tools: 5,
			speed: 6,
			contextLength: 256000,
		}),
		generateModelSpec("grok-4-0709", {
			costPerMillionInputTokens: 3,
			costPerMillionOutputTokens: 15.0,
			reasoningText: 6,
			intelligence: 6,
			tools: 6,
			speed: 3,
			contextLength: 256000,
		}),
		generateModelSpec("grok-4-fast-reasoning", {
			costPerMillionInputTokens: 0.2,
			costPerMillionCachedInputTokens: 0.05,
			costPerMillionOutputTokens: 0.5,
			reasoningText: 5,
			intelligence: 5,
			tools: 5,
			speed: 3,
			contextLength: 2000000,
		}),
		generateModelSpec("grok-4-fast-non-reasoning", {
			costPerMillionInputTokens: 0.2,
			costPerMillionCachedInputTokens: 0.05,
			costPerMillionOutputTokens: 0.5,
			reasoningText: 0,
			intelligence: 5,
			tools: 5,
			speed: 6,
			contextLength: 2000000,
		}),
		generateModelSpec("grok-3", {
			costPerMillionInputTokens: 3,
			costPerMillionOutputTokens: 15.0,
			reasoningText: 0,
			intelligence: 5,
			tools: 5,
			speed: 2,
			contextLength: 131072,
		}),
		generateModelSpec("grok-3-mini", {
			costPerMillionInputTokens: 0.3,
			costPerMillionOutputTokens: 0.5,
			reasoningText: 4,
			intelligence: 4,
			tools: 4,
			speed: 3,
			contextLength: 131072,
		}),
		generateModelSpec("grok-4-0709", {
			costPerMillionInputTokens: 3,
			costPerMillionOutputTokens: 15.0,
			reasoningText: 6,
			intelligence: 6,
			tools: 6,
			speed: 3,
			contextLength: 256000,
		}),
	]);

	/**
	 * A collection of xAI imageneration model specifications.
	 * Each key is a model ID, and the value is an `ImageModelSpec` object.
	 */
	modelRegistry.imageGeneration.registerAllModelSpecs([
		{
			modelId: "grok-2-image-1212",
			providerDisplayName: config.providerDisplayName,
			impl: xai.imageModel("grok-2-image-1212"),
			async isAvailable() {
				const modelList = await getModels();
				return !!modelList?.data.some(
					(model) => model.id === "grok-2-image-1212",
				);
			},
			costPerImage: 0.07,
		},
	]);
}
