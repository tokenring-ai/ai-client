import {createFal} from "@ai-sdk/fal";
import type TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ImageModelSpec} from "../client/AIImageGenerationClient.ts";
import {ImageGenerationModelRegistry} from "../ModelRegistry.ts";
import modelConfigs from "../models/fal.yaml" with {type: "yaml"};
import type {AIModelProvider} from "../schema.ts";

const ImageGenerationModelSchema = z.object({
  costPerMegapixel: z.number(),
});

const FalSchema = z.object({
  imageGeneration: z.record(z.string(), ImageGenerationModelSchema),
});

const parsedModelConfigs = FalSchema.parse(modelConfigs.models.fal);

const FalModelProviderConfigSchema = z.object({
  provider: z.literal("fal"),
  apiKey: z.string(),
});

function init(
  providerDisplayName: string,
  config: z.output<typeof FalModelProviderConfigSchema>,
  app: TokenRingApp,
) {
  const {apiKey} = config;
  if (!apiKey) {
    throw new Error("No config.apiKey provided for Fal provider.");
  }

  const fal = createFal({apiKey});

  function generateImageModelSpec(
    modelSpec: Omit<
      ImageModelSpec,
      | "isAvailable"
      | "provider"
      | "providerDisplayName"
      | "impl"
      | "calculateImageCost"
    >,
    costPerMegapixel: number,
  ): ImageModelSpec {
    return {
      providerDisplayName: providerDisplayName,
      impl: fal.image(modelSpec.modelId),
      isAvailable() {
        // For Fal, we'll assume most popular models are available
        // In a real implementation, you might want to check the API
        return true;
      },
      calculateImageCost(req, _result) {
        const size = req.size.split("x").map(Number);
        return (costPerMegapixel * size[0] * size[1]) / 1000000;
      },
      ...modelSpec,
    };
  }

  app.waitForService(
    ImageGenerationModelRegistry,
    (imageGenerationModelRegistry) => {
      imageGenerationModelRegistry.registerAllModelSpecs(
        Object.entries(parsedModelConfigs.imageGeneration).map(([modelId, config]) =>
          generateImageModelSpec({modelId}, config.costPerMegapixel),
        ),
      );
    },
  );
}

export default {
  providerCode: "fal",
  configSchema: FalModelProviderConfigSchema,
  init,
} satisfies AIModelProvider<typeof FalModelProviderConfigSchema>;
