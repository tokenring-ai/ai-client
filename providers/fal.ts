import {createFal} from "@ai-sdk/fal";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ImageModelSpec} from "../client/AIImageGenerationClient.ts";
import {ImageGenerationModelRegistry} from "../ModelRegistry.ts";
import {AIModelProvider} from "../schema.ts";

const FalModelProviderConfigSchema = z.object({
  provider: z.literal('fal'),
  apiKey: z.string(),
});

async function init(
  providerDisplayName: string,
  config: z.output<typeof FalModelProviderConfigSchema>,
  app: TokenRingApp,
) {
  let {apiKey} = config;
  if (!apiKey) {
    throw new Error("No config.apiKey provided for Fal provider.");
  }

  const fal = createFal({apiKey});

  function generateImageModelSpec(
    modelSpec: Omit<
      ImageModelSpec,
      "isAvailable" | "provider" | "providerDisplayName" | "impl" | "calculateImageCost"
    >,
    costPerMegapixel: number
  ): ImageModelSpec {
    return {
      providerDisplayName: providerDisplayName,
      impl: fal.image(modelSpec.modelId),
      async isAvailable() {
        // For Fal, we'll assume most popular models are available
        // In a real implementation, you might want to check the API
        return true;
      },
      calculateImageCost(req, result) {
        const size = req.size.split("x").map(Number)
        return costPerMegapixel * size[0] * size[1] / 1000000;
      },
      ...modelSpec,
    };
  }

  app.waitForService(ImageGenerationModelRegistry, imageGenerationModelRegistry => {
    imageGenerationModelRegistry.registerAllModelSpecs([
      generateImageModelSpec({modelId: "fal-ai/qwen-image"}, 0.02),
      generateImageModelSpec({modelId: "fal-ai/flux-pro/v1.1-ultra"}, 0.06),
      generateImageModelSpec({modelId: "fal-ai/flux-pro/v1.1"}, 0.04)
    ])
  });
}

export default {
  providerCode: 'fal',
  configSchema: FalModelProviderConfigSchema,
  init
} satisfies AIModelProvider<typeof FalModelProviderConfigSchema>;
