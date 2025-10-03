import { createFal } from "@ai-sdk/fal";
import type { ImageModelSpec } from "../client/AIImageGenerationClient.ts";
import ModelRegistry, { type ModelProviderInfo } from "../ModelRegistry.ts";

export interface FalModelProviderConfig extends ModelProviderInfo {
	apiKey: string;
}

/**
 * The name of the AI provider.
 */
const providerName = "Fal";

export async function init(
	modelRegistry: ModelRegistry,
	config: FalModelProviderConfig,
) {
	let { apiKey } = config;
	if (!apiKey) {
		throw new Error("No config.apiKey provided for Fal provider.");
	}

	const fal = createFal({ apiKey });

	function generateImageModelSpec(
		modelId: string,
		modelSpec: Omit<
			ImageModelSpec,
			"isAvailable" | "provider" | "providerDisplayName" | "impl"
		>,
	): ImageModelSpec {
		return {
			modelId,
			providerDisplayName: config.providerDisplayName,
			impl: fal.image(modelId),
			async isAvailable() {
				// For Fal, we'll assume most popular models are available
				// In a real implementation, you might want to check the API
				return true;
			},
			...modelSpec,
		};
	}

	modelRegistry.imageGeneration.registerAllModelSpecs([
		generateImageModelSpec("fal-ai/qwen-image", {
			costPerMegapixel: 0.02,
		}),
		generateImageModelSpec("fal-ai/flux-pro/v1.1-ultra", {
			costPerMegapixel: 0.06,
		}),
		generateImageModelSpec("fal-ai/flux-pro/v1.1", {
			costPerMegapixel: 0.04,
		}),
	]);
}
