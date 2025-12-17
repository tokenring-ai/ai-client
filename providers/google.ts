import {createGoogleGenerativeAI, GoogleGenerativeAIProviderOptions} from "@ai-sdk/google";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec, ChatRequest} from "../client/AIChatClient.ts";
import type {ImageModelSpec} from "../client/AIImageGenerationClient.ts";
import {ChatModelRegistry, ImageGenerationModelRegistry} from "../ModelRegistry.ts";
import {FeatureOptions, FeatureSpec} from "../ModelTypeRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

export const GoogleModelProviderConfigSchema = z.object({
  apiKey: z.string(),
});

export type GoogleModelProviderConfig = z.infer<
  typeof GoogleModelProviderConfigSchema
>;

interface Model {
  name: string;
  displayName: string;
  description: string;
}

interface ModelList {
  models: Model[];
}

export async function init(
  providerDisplayName: string,
  config: GoogleModelProviderConfig,
  app: TokenRingApp,
) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for Google provider.");
  }

  const getModels = cachedDataRetriever(
    "https://generativelanguage.googleapis.com/v1beta/models",
    {
      headers: {
        "x-goog-api-key": config.apiKey,
      },
    },
  ) as () => Promise<ModelList | null>;

  const googleProvider = createGoogleGenerativeAI({
    apiKey: config.apiKey,
  });

  function generateModelSpec(
    modelId: string,
    modelSpec: Omit<
      ChatModelSpec,
      "isAvailable" | "provider" | "providerDisplayName" | "impl" | "modelId"
    >,
  ): ChatModelSpec {
    const isGemini3 = modelId.startsWith("gemini-3");
    const isGemini25 = modelId.startsWith("gemini-2.5");
    
    const baseFeatures: Record<string, FeatureSpec> = {
      responseModalities: {
        description: "Response modalities (TEXT, IMAGE)",
        defaultValue: ["TEXT"],
        type: "array"
      }
    };
    
    if (isGemini3) {
      baseFeatures.thinkingLevel = {
        description: "Thinking depth (low, high)",
        defaultValue: undefined,
        type: "enum",
        values: ["low", "high"]
      };
      baseFeatures.includeThoughts = {
        description: "Include thought summaries",
        defaultValue: false,
        type: "boolean"
      };
    } else if (isGemini25) {
      baseFeatures.thinkingBudget = {
        description: "Thinking token budget (0 to disable)",
        defaultValue: undefined,
        type: "number",
        min: 0,
        max: 32768
      };
      baseFeatures.includeThoughts = {
        description: "Include thought summaries",
        defaultValue: false,
        type: "boolean"
      };
    }
    
    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: googleProvider(modelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.models.some((model) =>
          model.name.includes(modelId),
        );
      },
      mangleRequest(req: ChatRequest, features: FeatureOptions) {
        if (features?.websearch) {
          (req.tools ??= {}).google_search = googleProvider.tools.googleSearch(
            {},
          );
        }
        
        const googleOptions: GoogleGenerativeAIProviderOptions = (req.providerOptions ??= {}).google ??= {};
        
        if (features?.responseModalities !== undefined) {
          googleOptions.responseModalities = (features.responseModalities as any)?.map((s: string) => s.toUpperCase());
        }
        
        if (features?.thinkingLevel !== undefined || features?.thinkingBudget !== undefined || features?.includeThoughts !== undefined) {
          const thinkingConfig: any = {};
          if (features?.thinkingLevel !== undefined) thinkingConfig.thinkingLevel = features.thinkingLevel;
          if (features?.thinkingBudget !== undefined) thinkingConfig.thinkingBudget = features.thinkingBudget;
          if (features?.includeThoughts !== undefined) thinkingConfig.includeThoughts = features.includeThoughts;
          googleOptions.thinkingConfig = thinkingConfig;
        }
      },
      features: { ...baseFeatures, ...modelSpec.features },
      ...modelSpec,
    } satisfies ChatModelSpec;
  }

  function generateImageModelSpec(
    modelId: string,
    costPerImage: number,
  ): ImageModelSpec {
    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: googleProvider.image(modelId),
      async isAvailable() {
        // TODO: figure out how to get this working
        return true;

        //const modelList = await getModels();
        //return !!modelList?.models.some((model) => model.name.includes(modelId));
      },
      calculateImageCost(req, result) {
        return costPerImage
      },
    };
  }

  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs([
    generateModelSpec("gemini-3-pro-preview", {
      costPerMillionInputTokens: 4.0,
      costPerMillionOutputTokens: 18.0,
      reasoningText: 7,
      intelligence: 7,
      tools: 7,
      speed: 3,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 1000000,
    }),
    generateModelSpec("gemini-2.5-pro", {
      costPerMillionInputTokens: 2.5,
      costPerMillionOutputTokens: 15.0,
      reasoningText: 6,
      intelligence: 6,
      tools: 6,
      speed: 2,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 1000000,
    }),
    generateModelSpec("gemini-2.5-flash", {
      costPerMillionInputTokens: 0.3,
      costPerMillionOutputTokens: 2.5,
      reasoningText: 5,
      intelligence: 4,
      tools: 4,
      speed: 4,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 1000000,
    }),
    generateModelSpec("gemini-2.5-flash-lite", {
      costPerMillionInputTokens: 0.1,
      costPerMillionOutputTokens: 0.4,
      reasoningText: 2,
      intelligence: 3,
      tools: 3,
      speed: 5,
      contextLength: 1000000,
    }),
    ]);
  });

  app.waitForService(ImageGenerationModelRegistry, imageGenerationModelRegistry => {
    imageGenerationModelRegistry.registerAllModelSpecs([
      generateImageModelSpec("gemini-3-pro-image-preview", 0.135),
      generateImageModelSpec("imagen-4.0-ultra-generate-001", 0.06), // $0.06 per image
      generateImageModelSpec("imagen-4.0-generate-001", 0.04), // $0.04 per image
      generateImageModelSpec("imagen-4.0-fast-generate-001", 0.02), // $0.02 per image
    ]);
  });
}
