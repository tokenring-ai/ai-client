import { createOpenAI, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type TokenRingApp from "@tokenring-ai/app";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import { z } from "zod";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
import type { ImageModelSpec } from "../client/AIImageGenerationClient.ts";
import { ChatModelRegistry, ImageGenerationModelRegistry, SpeechModelRegistry, TranscriptionModelRegistry } from "../ModelRegistry.ts";
import modelConfigs from "../models/openai.yaml" with { type: "yaml" };
import type { AIModelProvider } from "../schema.ts";

const ChatModelSchema = z.object({
  providerModelId: z.string().exactOptional(),
  providerOptions: z.record(z.string(), z.unknown()).exactOptional(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  costPerMillionCachedInputTokens: z.number().exactOptional(),
  maxContextLength: z.number(),
  features: z.array(z.string()).exactOptional(),
});

const ImageGenerationModelSchema = z.object({
  providerModelId: z.string().exactOptional(),
  providerOptions: z.record(z.string(), z.unknown()).exactOptional(),
  costPerMegapixel: z.number(),
});

const TextToSpeechModelSchema = z.object({
  costPerMillionCharacters: z.number(),
});

const SpeechToTextModelSchema = z.object({
  costPerMinute: z.number(),
});

export const OpenAISchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
  imageGeneration: z.record(z.string(), ImageGenerationModelSchema),
  textToSpeech: z.record(z.string(), TextToSpeechModelSchema),
  speechToText: z.record(z.string(), SpeechToTextModelSchema),
});

const parsedModelConfigs = OpenAISchema.parse(modelConfigs.models.openai);

const OpenAIModelProviderConfigSchema = z.object({
  provider: z.literal("openai"),
  apiKey: z.string(),
});

type ModelListData = {
  id: string;
  object: "model";
  owned_by: "organization" | "openai";
  created: number;
};

type ModelList = {
  object: "list";
  data: ModelListData[];
};

function init(providerDisplayName: string, config: z.output<typeof OpenAIModelProviderConfigSchema>, app: TokenRingApp) {
  const { apiKey } = config;
  if (!apiKey) {
    throw new Error("No config.apiKey provided for OpenAI provider.");
  }

  const openai = createOpenAI({ apiKey });

  const getModels = cachedDataRetriever(`https://api.openai.com/v1/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  }) as () => Promise<ModelList | null>;

  function generateModelSpec(
    modelId: string,
    modelSpec: Omit<ChatModelSpec, "isAvailable" | "providerDisplayName" | "impl" | "modelId"> & { providerModelId?: string | undefined },
  ): ChatModelSpec {
    const providerModelId = modelSpec.providerModelId ?? modelId;
    const isReasoningModel = providerModelId.startsWith("gpt-5") || providerModelId.startsWith("o");
    const isGpt51 = providerModelId === "gpt-5.1" || providerModelId.startsWith("gpt-5.1-");
    const supportsImageInput = /^(gpt-(4\.1|4o|5)|o[134])/.test(providerModelId) || providerModelId === "computer-use-preview";
    const supportsAudioInput = providerModelId.includes("audio") || providerModelId.includes("realtime");

    const baseSettings: any = {
      websearch: {
        description: "Enables web search",
        defaultValue: false,
        type: "boolean",
      },
      serviceTier: {
        description: "Service tier (auto, flex, priority, default)",
        defaultValue: "auto",
        type: "enum",
        values: ["auto", "flex", "priority", "default"],
      },
      textVerbosity: {
        description: "Text verbosity (low, medium, high)",
        defaultValue: "medium",
        type: "enum",
        values: ["low", "medium", "high"],
      },
      strictJsonSchema: {
        description: "Use strict JSON schema validation",
        defaultValue: false,
        type: "boolean",
      },
    };

    if (isReasoningModel) {
      if (isGpt51) {
        baseSettings.promptCacheRetention = {
          description: "The retention policy for the prompt cache",
          defaultValue: "in_memory",
          type: "enum",
          values: ["in_memory", "24h"],
        };
      }

      baseSettings.reasoningEffort = {
        description: `Reasoning effort (${isGpt51 ? "none, " : ""}minimal, low, medium, high)`,
        defaultValue: "medium",
        type: "enum",
        values: isGpt51 ? ["none", "minimal", "low", "medium", "high"] : ["minimal", "low", "medium", "high"],
      };
      baseSettings.reasoningSummary = {
        description: "Reasoning summary mode (auto, detailed)",
        defaultValue: undefined,
        type: "enum",
        values: ["auto", "detailed"],
      };
    }

    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: openai(providerModelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some(model => model.id === providerModelId);
      },
      mangleRequest(req, settings) {
        if (settings.has("websearch")) {
          (req.tools ??= {}).web_search = openai.tools.webSearch({});
        }

        const openaiOptions: OpenAIResponsesProviderOptions = ((req.providerOptions ??= {}).openai ??= {});

        if (settings.has("reasoningEffort")) {
          openaiOptions.reasoningEffort = settings.get("reasoningEffort") as string;
        }
        if (settings.has("reasoningSummary")) {
          openaiOptions.reasoningSummary = settings.get("reasoningSummary") as string;
        }
        if (settings.has("strictJsonSchema")) {
          openaiOptions.strictJsonSchema = settings.get("strictJsonSchema") as boolean;
        }
        if (settings.has("serviceTier")) {
          openaiOptions.serviceTier = settings.get("serviceTier") as any;
        }
        if (settings.has("textVerbosity")) {
          openaiOptions.textVerbosity = settings.get("textVerbosity") as any;
        }
        if (settings.has("promptCacheRetention")) {
          openaiOptions.promptCacheRetention = settings.get("promptCacheRetention") as any;
        }

        return undefined;
      },
      inputCapabilities: {
        image: supportsImageInput,
        audio: supportsAudioInput,
        file: supportsImageInput || supportsAudioInput,
      },
      settings: { ...baseSettings, ...modelSpec.settings },
      ...modelSpec,
    } satisfies ChatModelSpec;
  }

  function generateImageModelSpec(
    modelId: string,
    variantId: string,
    modelSpec: Omit<ImageModelSpec, "isAvailable" | "provider" | "providerDisplayName" | "impl" | "modelId" | "calculateImageCost">,
    costPerMegapixel: number,
  ): ImageModelSpec {
    return {
      modelId: variantId,
      providerDisplayName: providerDisplayName,
      impl: openai.imageModel(modelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some(model => model.id === modelId);
      },
      calculateImageCost(req) {
        const size = req.size.split("x").map(Number);
        return (costPerMegapixel * size[0] * size[1]) / 1000000;
      },
      ...modelSpec,
    };
  }

  // Register chat models from parsed YAML config
  const chatModelRegistry = app.requireService(ChatModelRegistry);
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
        }),
      ),
    ),
  );

  // Register image generation models from parsed YAML config
  const imageGenerationModelRegistry = app.requireService(ImageGenerationModelRegistry);
  imageGenerationModelRegistry.registerAllModelSpecs(
    Object.entries(parsedModelConfigs.imageGeneration).map(([variantId, config]) => {
      const baseModelId = config.providerModelId ?? variantId;
      return generateImageModelSpec(
        baseModelId,
        variantId,
        {
          providerOptions: config.providerOptions ? { openai: config.providerOptions } : undefined,
        },
        config.costPerMegapixel,
      );
    }),
  );

  // Register text-to-speech models from parsed YAML config
  const speechModelRegistry = app.requireService(SpeechModelRegistry);
  speechModelRegistry.registerAllModelSpecs(
    Object.entries(parsedModelConfigs.textToSpeech).map(([modelId, config]) => ({
      modelId,
      providerDisplayName: providerDisplayName,
      impl: openai.speech(modelId),
      isAvailable() {
        return true;
      },
      costPerMillionCharacters: config.costPerMillionCharacters,
    })),
  );

  // Register speech-to-text models from parsed YAML config
  const transcriptionModelRegistry = app.requireService(TranscriptionModelRegistry);
  transcriptionModelRegistry.registerAllModelSpecs(
    Object.entries(parsedModelConfigs.speechToText).map(([modelId, config]) => ({
      modelId,
      providerDisplayName: providerDisplayName,
      impl: openai.transcription(modelId),
      isAvailable() {
        return true;
      },
      costPerMinute: config.costPerMinute,
    })),
  );
}

export default {
  providerCode: "openai",
  configSchema: OpenAIModelProviderConfigSchema,
  init,
} satisfies AIModelProvider<typeof OpenAIModelProviderConfigSchema>;
