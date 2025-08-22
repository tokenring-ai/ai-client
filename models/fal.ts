import {createFal} from "@ai-sdk/fal";
import type {ImageModelSpec} from "../client/AIImageGenerationClient.ts";
import ModelRegistry, {ModelConfig} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

type FalImageModelData = {
  id: string;
  name: string;
  description?: string;
  available: boolean;
}

type FalModelList = {
  models: FalImageModelData[];
}

/**
 * The name of the AI provider.
 */
const providerName = "Fal";

export async function init(modelRegistry: ModelRegistry, {apiKey, baseURL, provider}: ModelConfig) {
  if (!apiKey) {
    throw new Error("No config.apiKey provided for Fal provider.");
  }
  baseURL ??= "https://fal.run";

  const fal = createFal({apiKey, baseURL});

  const getModels = cachedDataRetriever(`${baseURL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  }) as () => Promise<FalModelList | null>;

  provider ??= providerName;

  function generateImageModelSpec(modelId: string, modelSpec: Omit<Omit<Omit<ImageModelSpec, "isAvailable">, "provider">, "impl">): Record<string, ImageModelSpec> {
    return {
      [modelId]: {
        provider,
        impl: fal.image(modelId),
        async isAvailable() {
          // For Fal, we'll assume most popular models are available
          // In a real implementation, you might want to check the API
          return true;
        },
        ...modelSpec,
      },
    }
  }

  /**
   * A collection of Fal image generation model specifications.
   * Each key is a model ID, and the value is an `ImageModelSpec` object.
   * Pricing is generally $0.04 per image based on Fal documentation.
   */
  const imageGenerationModels: Record<string, ImageModelSpec> = {
    ...generateImageModelSpec("fal-ai/qwen-image", {
      costPerMegapixel: 0.02,
    }),
    ...generateImageModelSpec("fal-ai/flux-pro/v1.1-ultra", {
      costPerMegapixel: 0.06,
    }),
    ...generateImageModelSpec("fal-ai/flux-pro/v1.1", {
      costPerMegapixel: 0.04,
    }),
  };

  modelRegistry.imageGeneration.registerAllModelSpecs(
    imageGenerationModels,
  );
}