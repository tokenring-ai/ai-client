import { createGoogleGenerativeAI, type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type TokenRingApp from "@tokenring-ai/app";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import { z } from "zod";
import type { ChatModelSpec, ChatRequest } from "../client/AIChatClient.ts";
import type { ImageModelSpec } from "../client/AIImageGenerationClient.ts";
import { ChatModelRegistry, ImageGenerationModelRegistry } from "../ModelRegistry.ts";
import type { ChatModelSettings, SettingDefinition } from "../ModelTypeRegistry.ts";
import modelConfigs from "../models/google.yaml" with { type: "yaml" };
import type { AIModelProvider } from "../schema.ts";

const ChatModelSchema = z.object({
  providerModelId: z.string().exactOptional(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  costPerMillionCachedInputTokens: z.number().exactOptional(),
  maxContextLength: z.number(),
  features: z.array(z.string()).exactOptional(),
});

const ImageGenerationModelSchema = z.object({
  costPerImage: z.number(),
});

const GoogleSchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
  imageGeneration: z.record(z.string(), ImageGenerationModelSchema),
});

const parsedModelConfigs = GoogleSchema.parse(modelConfigs.models.google);

const GoogleModelProviderConfigSchema = z.object({
  provider: z.literal("google"),
  apiKey: z.string(),
});

interface Model {
  name: string;
  displayName: string;
  description: string;
}

interface ModelList {
  models: Model[];
}

function init(providerDisplayName: string, config: z.output<typeof GoogleModelProviderConfigSchema>, app: TokenRingApp) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for Google provider.");
  }

  const getModels = cachedDataRetriever("https://generativelanguage.googleapis.com/v1beta/models", {
    headers: {
      "x-goog-api-key": config.apiKey,
    },
  }) as () => Promise<ModelList | null>;

  const googleProvider = createGoogleGenerativeAI({
    apiKey: config.apiKey,
  });

  function generateModelSpec(
    modelId: string,
    modelSpec: Omit<ChatModelSpec, "isAvailable" | "provider" | "providerDisplayName" | "impl" | "modelId"> & { providerModelId?: string },
  ): ChatModelSpec {
    const providerModelId = modelSpec.providerModelId ?? modelId;
    const isGemini3 = providerModelId.startsWith("gemini-3");
    const isGemini25 = providerModelId.startsWith("gemini-2.5");

    const baseSettings: Record<string, SettingDefinition> = {
      responseModalities: {
        description: "Response modalities (TEXT, IMAGE)",
        defaultValue: ["TEXT"],
        type: "array",
      },
    };

    if (isGemini3) {
      baseSettings.thinkingLevel = {
        description: "Thinking depth (low, high)",
        defaultValue: undefined,
        type: "enum",
        values: ["low", "high"],
      };
      baseSettings.includeThoughts = {
        description: "Include thought summaries",
        defaultValue: false,
        type: "boolean",
      };
    } else if (isGemini25) {
      baseSettings.thinkingBudget = {
        description: "Thinking token budget (0 to disable)",
        defaultValue: undefined,
        type: "number",
        min: 0,
        max: 32768,
      };
      baseSettings.includeThoughts = {
        description: "Include thought summaries",
        defaultValue: false,
        type: "boolean",
      };
    }

    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: googleProvider(providerModelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.models.some(model => model.name.includes(providerModelId));
      },
      mangleRequest(req: ChatRequest, settings: ChatModelSettings) {
        if (settings.has("websearch")) {
          (req.tools ??= {}).google_search = googleProvider.tools.googleSearch({});
        }

        const googleOptions: GoogleGenerativeAIProviderOptions = ((req.providerOptions ??= {}).google ??= {});

        if (settings.has("responseModalities")) {
          googleOptions.responseModalities = (settings.get("responseModalities") as any)?.map((s: string) => s.toUpperCase());
        }

        if (settings.has("thinkingLevel") || settings.has("thinkingBudget") || settings.has("includeThoughts")) {
          const thinkingConfig: any = {};
          if (settings.has("thinkingLevel")) thinkingConfig.thinkingLevel = settings.get("thinkingLevel");
          if (settings.has("thinkingBudget")) thinkingConfig.thinkingBudget = settings.get("thinkingBudget");
          if (settings.has("includeThoughts")) thinkingConfig.includeThoughts = settings.get("includeThoughts");
          googleOptions.thinkingConfig = thinkingConfig;
        }
      },
      inputCapabilities: {
        image: true,
        video: true,
        audio: true,
        file: true,
      },
      settings: { ...baseSettings, ...modelSpec.settings },
      ...modelSpec,
    } satisfies ChatModelSpec;
  }

  function generateImageModelSpec(modelId: string, costPerImage: number): ImageModelSpec {
    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: googleProvider.image(modelId),
      isAvailable() {
        // TODO: figure out how to get this working
        return true;

        //const modelList = await getModels();
        //return !!modelList?.models.some((model) => model.name.includes(modelId));
      },
      calculateImageCost() {
        return costPerImage;
      },
    };
  }

  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs(
      Object.entries(parsedModelConfigs.chat).map(([modelId, config]) =>
        generateModelSpec(
          modelId,
          stripUndefinedKeys({
            providerModelId: config.providerModelId,
            costPerMillionInputTokens: config.costPerMillionInputTokens,
            costPerMillionOutputTokens: config.costPerMillionOutputTokens,
            costPerMillionCachedInputTokens: config.costPerMillionCachedInputTokens,
            maxContextLength: config.maxContextLength,
            ...(config.features?.includes("websearch") && {
              websearch: {
                description: "Enables web search",
                defaultValue: false,
                type: "boolean",
              },
            }),
          }),
        ),
      ),
    );
  });

  app.waitForService(ImageGenerationModelRegistry, imageGenerationModelRegistry => {
    imageGenerationModelRegistry.registerAllModelSpecs(
      Object.entries(parsedModelConfigs.imageGeneration).map(([modelId, config]) => generateImageModelSpec(modelId, config.costPerImage)),
    );
  });
}

export default {
  providerCode: "google",
  configSchema: GoogleModelProviderConfigSchema,
  init,
} satisfies AIModelProvider<typeof GoogleModelProviderConfigSchema>;
