import {createOpenAI, OpenAIResponsesProviderOptions} from "@ai-sdk/openai";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import type {ImageModelSpec} from "../client/AIImageGenerationClient.ts";
import {ChatModelRegistry, ImageGenerationModelRegistry, SpeechModelRegistry, TranscriptionModelRegistry} from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

export const OpenAIModelProviderConfigSchema = z.object({
  apiKey: z.string(),
});

export type OpenAIModelProviderConfig = z.infer<
  typeof OpenAIModelProviderConfigSchema
>;

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

export async function init(
  providerDisplayName: string,
  config: OpenAIModelProviderConfig,
  app: TokenRingApp,
) {
  let {apiKey} = config;
  if (!apiKey) {
    throw new Error("No config.apiKey provided for OpenAI provider.");
  }

  const openai = createOpenAI({apiKey});

  const getModels = cachedDataRetriever(`https://api.openai.com/v1/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  }) as () => Promise<ModelList | null>;

  function generateModelSpec(
    modelId: string,
    modelSpec: Omit<
      ChatModelSpec,
      "isAvailable" | "providerDisplayName" | "impl" | "modelId"
    >,
  ): ChatModelSpec {
    const isReasoningModel = modelId.startsWith("gpt-5") || modelId.startsWith("o");
    const isGpt51 = modelId === "gpt-5.1" || modelId.startsWith("gpt-5.1-");
    
    const baseFeatures: any = {
      websearch: { description: "Enables web search", defaultValue: false, type: "boolean" },
      serviceTier: { description: "Service tier (auto, flex, priority, default)", defaultValue: "auto", type: "enum", values: ["auto", "flex", "priority", "default"] },
      textVerbosity: { description: "Text verbosity (low, medium, high)", defaultValue: "medium", type: "enum", values: ["low", "medium", "high"] },
      strictJsonSchema: {description: "Use strict JSON schema validation", defaultValue: false, type: "boolean"},

    };
    
    if (isReasoningModel) {
      if (isGpt51) {
        baseFeatures.promptCacheRetention = {
          description: "The retention policy for the prompt cache",
            defaultValue: "in_memory",
            type: "enum",
            values: ["in_memory", "24h"]
        };
      }

      baseFeatures.reasoningEffort = { 
        description: `Reasoning effort (${isGpt51 ? "none, " : ""}minimal, low, medium, high)`, 
        defaultValue: "medium", 
        type: "enum", 
        values: isGpt51 ? ["none", "minimal", "low", "medium", "high"] : ["minimal", "low", "medium", "high"] 
      };
      baseFeatures.reasoningSummary = { description: "Reasoning summary mode (auto, detailed)", defaultValue: undefined, type: "enum", values: ["auto", "detailed"] };
    }

    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: openai(modelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some((model) => model.id === modelId);
      },
      mangleRequest(req, features) {
        if (features?.websearch) {
          (req.tools ??= {}).web_search = openai.tools.webSearch({});
        }
        
        const openaiOptions: OpenAIResponsesProviderOptions = (req.providerOptions ??= {}).openai ??= {};
        
        if (features?.reasoningEffort !== undefined) {
          openaiOptions.reasoningEffort = features.reasoningEffort as string;
        }
        if (features?.reasoningSummary !== undefined) {
          openaiOptions.reasoningSummary = features.reasoningSummary as string;
        }
        if (features?.strictJsonSchema !== undefined) {
          openaiOptions.strictJsonSchema = features.strictJsonSchema as boolean;
        }
        if (features?.serviceTier !== undefined) {
          openaiOptions.serviceTier = features.serviceTier as any;
        }
        if (features?.textVerbosity !== undefined) {
          openaiOptions.textVerbosity = features.textVerbosity as any;
        }
        if (features?.promptCacheRetention !== undefined) {
          openaiOptions.promptCacheRetention = features.promptCacheRetention as any;
        }

        return undefined;
      },
      features: { ...baseFeatures, ...modelSpec.features },
      ...modelSpec,
    } satisfies ChatModelSpec;
  }

  function generateImageModelSpec(
    modelId: string,
    variantId: string,
    modelSpec: Omit<
      ImageModelSpec,
      "isAvailable" | "provider" | "providerDisplayName" | "impl" | "modelId" | "calculateImageCost"
    >,
    costPerMegapixel: number,
   ): ImageModelSpec {
    return {
      modelId: variantId,
      providerDisplayName: providerDisplayName,
      impl: openai.imageModel(modelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some((model) => model.id === modelId);
      },
      calculateImageCost(req, result) {
        const size = req.size.split("x").map(Number)
        return costPerMegapixel * size[0] * size[1] / 1000000;
      },
      ...modelSpec,
    };
  }

  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs([
    generateModelSpec("gpt-4.1", {
      costPerMillionInputTokens: 2.0,
      costPerMillionOutputTokens: 8.0,
      costPerMillionCachedInputTokens: 0.5,
      reasoningText: 3,
      intelligence: 5,
      tools: 5,
      speed: 3,
      contextLength: 1000000,
    }),
    generateModelSpec("gpt-4.1-mini", {
      costPerMillionInputTokens: 0.4,
      costPerMillionOutputTokens: 1.6,
      costPerMillionCachedInputTokens: 0.1,
      reasoningText: 2,
      intelligence: 4,
      tools: 4,
      speed: 4,
      contextLength: 1000000,
    }),
    generateModelSpec("gpt-4.1-nano", {
      costPerMillionInputTokens: 0.1,
      costPerMillionOutputTokens: 0.4,
      costPerMillionCachedInputTokens: 0.025,
      reasoningText: 1,
      intelligence: 2,
      tools: 2,
      speed: 5,
      contextLength: 1000000,
    }),
    generateModelSpec("gpt-5", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      reasoningText: 4,
      intelligence: 6,
      tools: 6,
      speed: 3,
      contextLength: 400000,
    }),

    generateModelSpec("gpt-5.1", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      reasoningText: 4,
      intelligence: 6,
      tools: 6,
      speed: 3,
      contextLength: 400000,
    }),
    generateModelSpec("gpt-5-codex", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      reasoningText: 4,
      intelligence: 6,
      tools: 6,
      speed: 3,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 400000,
    }),

    generateModelSpec("gpt-5.1-codex", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      reasoningText: 4,
      intelligence: 6,
      tools: 6,
      speed: 3,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 400000,
    }),

    generateModelSpec("gpt-5-mini", {
      costPerMillionInputTokens: 0.25,
      costPerMillionOutputTokens: 2,
      costPerMillionCachedInputTokens: 0.025,
      reasoningText: 3,
      intelligence: 5,
      tools: 5,
      speed: 4,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 400000,
    }),
    generateModelSpec("gpt-5-nano", {
      costPerMillionInputTokens: 0.05,
      costPerMillionOutputTokens: 0.4,
      costPerMillionCachedInputTokens: 0.005,
      reasoningText: 2,
      intelligence: 3,
      tools: 3,
      speed: 5,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 400000,
    }),
    generateModelSpec("o4-mini", {
      costPerMillionInputTokens: 1.1,
      costPerMillionOutputTokens: 4.4,
      costPerMillionCachedInputTokens: 0.275,
      reasoningText: 5,
      intelligence: 5,
      tools: 5,
      speed: 3,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 200000,
    }),
    generateModelSpec("o3", {
      costPerMillionInputTokens: 2.0,
      costPerMillionOutputTokens: 8.0,
      costPerMillionCachedInputTokens: 0.5,
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
      contextLength: 200000,
    }),
    generateModelSpec("o3-mini", {
      costPerMillionInputTokens: 1.1,
      costPerMillionOutputTokens: 4.4,
      costPerMillionCachedInputTokens: 0.55,
      reasoningText: 5,
      intelligence: 5,
      tools: 5,
      speed: 3,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 200000,
    }),
    generateModelSpec("o3-pro", {
      costPerMillionInputTokens: 20.0,
      costPerMillionOutputTokens: 80.0,
      reasoningText: 7,
      intelligence: 7,
      tools: 6,
      speed: 1,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 200000,
    }),
    generateModelSpec("o3-deep-research", {
      costPerMillionInputTokens: 10.0,
      costPerMillionOutputTokens: 40.0,
      costPerMillionCachedInputTokens: 2.5,
      reasoningText: 7,
      intelligence: 7,
      tools: 6,
      speed: 1,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 200000,
    }),
    generateModelSpec("o4-mini-deep-research", {
      costPerMillionInputTokens: 2.0,
      costPerMillionOutputTokens: 8.0,
      costPerMillionCachedInputTokens: 0.5,
      reasoningText: 6,
      intelligence: 6,
      tools: 5,
      speed: 2,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 200000,
    }),
    generateModelSpec("o1", {
      costPerMillionInputTokens: 15.0,
      costPerMillionOutputTokens: 60.0,
      costPerMillionCachedInputTokens: 7.5,
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
      contextLength: 200000,
    }),
    generateModelSpec("o1-pro", {
      costPerMillionInputTokens: 150.0,
      costPerMillionOutputTokens: 600.0,
      reasoningText: 8,
      intelligence: 8,
      tools: 6,
      speed: 1,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 200000,
    }),
    generateModelSpec("gpt-5-pro", {
      costPerMillionInputTokens: 15.0,
      costPerMillionOutputTokens: 120.0,
      reasoningText: 5,
      intelligence: 7,
      tools: 6,
      speed: 2,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 400000,
    }),
    generateModelSpec("gpt-5-chat-latest", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      reasoningText: 4,
      intelligence: 6,
      tools: 6,
      speed: 3,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 400000,
    }),
    generateModelSpec("gpt-5.1-chat-latest", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      reasoningText: 4,
      intelligence: 6,
      tools: 6,
      speed: 3,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 400000,
    }),
    generateModelSpec("gpt-5.1-codex-mini", {
      costPerMillionInputTokens: 0.25,
      costPerMillionOutputTokens: 2,
      costPerMillionCachedInputTokens: 0.025,
      reasoningText: 3,
      intelligence: 5,
      tools: 5,
      speed: 4,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 400000,
    }),
    generateModelSpec("codex-mini-latest", {
      costPerMillionInputTokens: 1.5,
      costPerMillionOutputTokens: 6,
      costPerMillionCachedInputTokens: 0.375,
      reasoningText: 4,
      intelligence: 5,
      tools: 5,
      speed: 3,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      contextLength: 400000,
    }),
    generateModelSpec("gpt-5-search-api", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      reasoningText: 4,
      intelligence: 6,
      tools: 6,
      speed: 3,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: true,
          type: "boolean",
        }
      },
      contextLength: 400000,
    }),
    generateModelSpec("gpt-4o", {
      costPerMillionInputTokens: 2.5,
      costPerMillionOutputTokens: 10,
      costPerMillionCachedInputTokens: 1.25,
      reasoningText: 4,
      intelligence: 5,
      tools: 5,
      speed: 4,
      contextLength: 128000,
    }),
    generateModelSpec("gpt-4o-2024-05-13", {
      costPerMillionInputTokens: 5.0,
      costPerMillionOutputTokens: 15.0,
      reasoningText: 4,
      intelligence: 5,
      tools: 5,
      speed: 4,
      contextLength: 128000,
    }),
    generateModelSpec("gpt-4o-mini", {
      costPerMillionInputTokens: 0.15,
      costPerMillionOutputTokens: 0.6,
      costPerMillionCachedInputTokens: 0.075,
      reasoningText: 3,
      intelligence: 4,
      tools: 4,
      speed: 5,
      contextLength: 128000,
    }),
    generateModelSpec("gpt-4o-mini-search-preview", {
      costPerMillionInputTokens: 0.15,
      costPerMillionOutputTokens: 0.6,
      reasoningText: 3,
      intelligence: 4,
      tools: 4,
      speed: 5,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: true,
          type: "boolean",
        }
      },
      contextLength: 128000,
    }),
    generateModelSpec("gpt-4o-search-preview", {
      costPerMillionInputTokens: 2.5,
      costPerMillionOutputTokens: 10,
      reasoningText: 4,
      intelligence: 5,
      tools: 5,
      speed: 4,
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: true,
          type: "boolean",
        }
      },
      contextLength: 128000,
    }),
    generateModelSpec("gpt-realtime", {
      costPerMillionInputTokens: 4.0,
      costPerMillionOutputTokens: 16.0,
      costPerMillionCachedInputTokens: 0.4,
      reasoningText: 3,
      intelligence: 4,
      tools: 4,
      speed: 5,
      contextLength: 128000,
    }),
    generateModelSpec("gpt-realtime-mini", {
      costPerMillionInputTokens: 0.6,
      costPerMillionOutputTokens: 2.4,
      costPerMillionCachedInputTokens: 0.06,
      reasoningText: 2,
      intelligence: 3,
      tools: 3,
      speed: 5,
      contextLength: 128000,
    }),
    generateModelSpec("gpt-4o-realtime-preview", {
      costPerMillionInputTokens: 5.0,
      costPerMillionOutputTokens: 20.0,
      costPerMillionCachedInputTokens: 2.5,
      reasoningText: 4,
      intelligence: 5,
      tools: 5,
      speed: 4,
      contextLength: 128000,
    }),
    generateModelSpec("gpt-4o-mini-realtime-preview", {
      costPerMillionInputTokens: 0.6,
      costPerMillionOutputTokens: 2.4,
      costPerMillionCachedInputTokens: 0.3,
      reasoningText: 3,
      intelligence: 4,
      tools: 4,
      speed: 5,
      contextLength: 128000,
    }),
    generateModelSpec("gpt-audio", {
      costPerMillionInputTokens: 2.5,
      costPerMillionOutputTokens: 10.0,
      reasoningText: 3,
      intelligence: 4,
      tools: 4,
      speed: 4,
      contextLength: 128000,
    }),
    generateModelSpec("gpt-audio-mini", {
      costPerMillionInputTokens: 0.6,
      costPerMillionOutputTokens: 2.4,
      reasoningText: 2,
      intelligence: 3,
      tools: 3,
      speed: 5,
      contextLength: 128000,
    }),
    generateModelSpec("gpt-4o-audio-preview", {
      costPerMillionInputTokens: 2.5,
      costPerMillionOutputTokens: 10.0,
      reasoningText: 4,
      intelligence: 5,
      tools: 5,
      speed: 4,
      contextLength: 128000,
    }),
    generateModelSpec("gpt-4o-mini-audio-preview", {
      costPerMillionInputTokens: 0.15,
      costPerMillionOutputTokens: 0.6,
      reasoningText: 3,
      intelligence: 4,
      tools: 4,
      speed: 5,
      contextLength: 128000,
    }),
    generateModelSpec("computer-use-preview", {
      costPerMillionInputTokens: 3.0,
      costPerMillionOutputTokens: 12.0,
      reasoningText: 4,
      intelligence: 5,
      tools: 6,
      speed: 3,
      contextLength: 128000,
    }),
    ]);
  });

  app.waitForService(ImageGenerationModelRegistry, imageGenerationModelRegistry => {
    imageGenerationModelRegistry.registerAllModelSpecs([
    generateImageModelSpec("gpt-image-1-mini", "gpt-image-1-mini-high", {
      providerOptions: {
        openai: {quality: "high"},
      },
      //costPerMillionInputTokens: 10,
      //costPerMegapixel: 0.067,
    }, 0.036),
    generateImageModelSpec("gpt-image-1-mini", "gpt-image-1-mini-medium", {
      providerOptions: {
        openai: {quality: "medium"},
      },
      //costPerMillionInputTokens: 10,
      //costPerMegapixel: 0.042,
    }, 0.011),
    generateImageModelSpec("gpt-image-1-mini", "gpt-image-1-mini-low", {
      providerOptions: {
        openai: {quality: "low"},
      },
      //costPerMillionInputTokens: 10,
      //costPerMegapixel: 0.011,
    }, 0.005),
    generateImageModelSpec("gpt-image-1", "gpt-image-1-high", {
      providerOptions: {
        openai: {quality: "high"},
      },
      //costPerMillionInputTokens: 10,
      //costPerMegapixel: 0.067,
    }, 0.167),
    generateImageModelSpec("gpt-image-1", "gpt-image-1-medium", {
      providerOptions: {
        openai: {quality: "medium"},
      },
      //costPerMillionInputTokens: 10,
      //costPerMegapixel: 0.042,
    }, 0.042),
    generateImageModelSpec("gpt-image-1", "gpt-image-1-low", {
      providerOptions: {
        openai: {quality: "low"},
      },
      //costPerMillionInputTokens: 10,
      //costPerMegapixel: 0.011,
    }, 0.011),
    ]);
  });

  app.waitForService(SpeechModelRegistry, speechModelRegistry => {
    speechModelRegistry.registerAllModelSpecs([
    {
      modelId: "tts-1",
      providerDisplayName: providerDisplayName,
      impl: openai.speech("tts-1"),
      async isAvailable() {
        return true;
      },
      costPerMillionCharacters: 15,
    },
    {
      modelId: "tts-1-hd",
      providerDisplayName: providerDisplayName,
      impl: openai.speech("tts-1-hd"),
      async isAvailable() {
        return true;
      },
      costPerMillionCharacters: 30,
    },
    ]);
  });

  app.waitForService(TranscriptionModelRegistry, transcriptionModelRegistry => {
    transcriptionModelRegistry.registerAllModelSpecs([
    {
      modelId: "whisper-1",
      providerDisplayName: providerDisplayName,
      impl: openai.transcription("whisper-1"),
      async isAvailable() {
        return true;
      },
      costPerMinute: 0.006,
    },
    ]);
  });
}
