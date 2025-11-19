import {createFal} from "@ai-sdk/fal";
import {z} from "zod";
import type {ImageModelSpec} from "../client/AIImageGenerationClient.ts";
import ModelRegistry from "../ModelRegistry.ts";

export const FalModelProviderConfigSchema = z.object({
  apiKey: z.string(),
});

export type FalModelProviderConfig = z.infer<
  typeof FalModelProviderConfigSchema
>;

export async function init(
  providerDisplayName: string,
  modelRegistry: ModelRegistry,
  config: FalModelProviderConfig,
) {
  let {apiKey} = config;
  if (!apiKey) {
    throw new Error("No config.apiKey provided for Fal provider.");
  }

  const fal = createFal({apiKey});

  function generateImageModelSpec(
    modelSpec: Omit<
      ImageModelSpec,
      "isAvailable" | "provider" | "providerDisplayName" | "impl"
    >,
  ): ImageModelSpec {
    return {
      providerDisplayName: providerDisplayName,
      impl: fal.image(modelSpec.modelId),
      async isAvailable() {
        // For Fal, we'll assume most popular models are available
        // In a real implementation, you might want to check the API
        return true;
      },
      ...modelSpec,
    };
  }

  modelRegistry.imageGeneration.registerAllModelSpecs([
    generateImageModelSpec({
      modelId: "fal-ai/qwen-image",
      costPerMegapixel: 0.02,
    }),
    generateImageModelSpec({
      modelId: "fal-ai/flux-pro/v1.1-ultra",
      costPerMegapixel: 0.06,
    }),
    generateImageModelSpec({
      modelId: "fal-ai/flux-pro/v1.1",
      costPerMegapixel: 0.04,
    }),
  ]);
}
