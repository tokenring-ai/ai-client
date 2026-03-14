import {createOpenAI, OpenAIResponsesProviderOptions} from "@ai-sdk/openai";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import type {ImageModelSpec} from "../client/AIImageGenerationClient.ts";
import {ChatModelRegistry, ImageGenerationModelRegistry, SpeechModelRegistry, TranscriptionModelRegistry} from "../ModelRegistry.ts";
import {AIModelProvider} from "../schema.ts";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";

const OpenAIModelProviderConfigSchema = z.object({
  provider: z.literal('openai'),
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

async function init(
  providerDisplayName: string,
  config: z.output<typeof OpenAIModelProviderConfigSchema>,
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
    > & { providerModelId?: string },
  ): ChatModelSpec {
    const providerModelId = modelSpec.providerModelId ?? modelId;
    const isReasoningModel = providerModelId.startsWith("gpt-5") || providerModelId.startsWith("o");
    const isGpt51 = providerModelId === "gpt-5.1" || providerModelId.startsWith("gpt-5.1-");
    const supportsImageInput =
      /^(gpt-(4\.1|4o|5)|o[134])/.test(providerModelId) ||
      providerModelId === "computer-use-preview";
    const supportsAudioInput =
      providerModelId.includes("audio") || providerModelId.includes("realtime");

    const baseSettings: any = {
      websearch: { description: "Enables web search", defaultValue: false, type: "boolean" },
      serviceTier: { description: "Service tier (auto, flex, priority, default)", defaultValue: "auto", type: "enum", values: ["auto", "flex", "priority", "default"] },
      textVerbosity: { description: "Text verbosity (low, medium, high)", defaultValue: "medium", type: "enum", values: ["low", "medium", "high"] },
      strictJsonSchema: {description: "Use strict JSON schema validation", defaultValue: false, type: "boolean"},

    };
    
    if (isReasoningModel) {
      if (isGpt51) {
        baseSettings.promptCacheRetention = {
          description: "The retention policy for the prompt cache",
            defaultValue: "in_memory",
            type: "enum",
            values: ["in_memory", "24h"]
        };
      }

      baseSettings.reasoningEffort = { 
        description: `Reasoning effort (${isGpt51 ? "none, " : ""}minimal, low, medium, high)`, 
        defaultValue: "medium", 
        type: "enum", 
        values: isGpt51 ? ["none", "minimal", "low", "medium", "high"] : ["minimal", "low", "medium", "high"] 
      };
      baseSettings.reasoningSummary = { description: "Reasoning summary mode (auto, detailed)", defaultValue: undefined, type: "enum", values: ["auto", "detailed"] };
    }

    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: openai(providerModelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some((model) => model.id === providerModelId);
      },
      mangleRequest(req, settings) {
        if (settings.has("websearch")) {
          (req.tools ??= {}).web_search = openai.tools.webSearch({});
        }
        
        const openaiOptions: OpenAIResponsesProviderOptions = (req.providerOptions ??= {}).openai ??= {};
        
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
      calculateImageCost(req) {
        const size = req.size.split("x").map(Number)
        return costPerMegapixel * size[0] * size[1] / 1000000;
      },
      ...modelSpec,
    };
  }

  const chatModelRegistry = app.requireService(ChatModelRegistry);
    chatModelRegistry.registerAllModelSpecs([
    generateModelSpec("gpt-4.1", {
      costPerMillionInputTokens: 2.0,
      costPerMillionOutputTokens: 8.0,
      costPerMillionCachedInputTokens: 0.5,
      maxContextLength: 1000000,
    }),
    generateModelSpec("gpt-4.1-mini", {
      costPerMillionInputTokens: 0.4,
      costPerMillionOutputTokens: 1.6,
      costPerMillionCachedInputTokens: 0.1,
      maxContextLength: 1000000,
    }),
    generateModelSpec("gpt-4.1-nano", {
      costPerMillionInputTokens: 0.1,
      costPerMillionOutputTokens: 0.4,
      costPerMillionCachedInputTokens: 0.025,
      maxContextLength: 1000000,
    }),
    generateModelSpec("gpt-5", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      maxContextLength: 400000,
    }),

    generateModelSpec("gpt-5.1", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      maxContextLength: 400000,
    }),
      generateModelSpec("gpt-5.2", {
        costPerMillionInputTokens: 1.75,
        costPerMillionCachedInputTokens: 0.175,
        costPerMillionOutputTokens: 14,
        maxContextLength: 400000,
      }),


      generateModelSpec("gpt-5.4", {
        costPerMillionInputTokens: 2.50,
        costPerMillionCachedInputTokens: 0.25,
        costPerMillionOutputTokens: 15.00,
        maxContextLength: 272000,
      }),

      generateModelSpec("gpt-5.4-long-context", {
        providerModelId: "gpt-5.4", // Assuming it uses the same base model ID
        costPerMillionInputTokens: 5.00,
        costPerMillionCachedInputTokens: 0.50,
        costPerMillionOutputTokens: 22.50,
        maxContextLength: 1000000,
      }),

      generateModelSpec("gpt-5.4-pro", {
        costPerMillionInputTokens: 30.00,
        costPerMillionOutputTokens: 180.00,
        maxContextLength: 272000,
      }),

      generateModelSpec("gpt-5.4-pro-long-context", {
        providerModelId: "gpt-5.4-pro", // Assuming it uses the same base model ID
        costPerMillionInputTokens: 60.00,
        costPerMillionOutputTokens: 270.00,
        maxContextLength: 1000000,
      }),

      generateModelSpec("gpt-5-codex", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 400000,
    }),

    generateModelSpec("gpt-5.1-codex", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 400000,
    }),

    generateModelSpec("gpt-5-mini", {
      costPerMillionInputTokens: 0.25,
      costPerMillionOutputTokens: 2,
      costPerMillionCachedInputTokens: 0.025,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 400000,
    }),
    generateModelSpec("gpt-5-nano", {
      costPerMillionInputTokens: 0.05,
      costPerMillionOutputTokens: 0.4,
      costPerMillionCachedInputTokens: 0.005,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 400000,
    }),
    generateModelSpec("o4-mini", {
      costPerMillionInputTokens: 1.1,
      costPerMillionOutputTokens: 4.4,
      costPerMillionCachedInputTokens: 0.275,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 200000,
    }),
    generateModelSpec("o3", {
      costPerMillionInputTokens: 2.0,
      costPerMillionOutputTokens: 8.0,
      costPerMillionCachedInputTokens: 0.5,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 200000,
    }),
    generateModelSpec("o3-mini", {
      costPerMillionInputTokens: 1.1,
      costPerMillionOutputTokens: 4.4,
      costPerMillionCachedInputTokens: 0.55,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 200000,
    }),
    generateModelSpec("o3-pro", {
      costPerMillionInputTokens: 20.0,
      costPerMillionOutputTokens: 80.0,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 200000,
    }),
    generateModelSpec("o3-deep-research", {
      costPerMillionInputTokens: 10.0,
      costPerMillionOutputTokens: 40.0,
      costPerMillionCachedInputTokens: 2.5,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 200000,
    }),
    generateModelSpec("o4-mini-deep-research", {
      costPerMillionInputTokens: 2.0,
      costPerMillionOutputTokens: 8.0,
      costPerMillionCachedInputTokens: 0.5,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 200000,
    }),
    generateModelSpec("o1", {
      costPerMillionInputTokens: 15.0,
      costPerMillionOutputTokens: 60.0,
      costPerMillionCachedInputTokens: 7.5,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 200000,
    }),
    generateModelSpec("o1-pro", {
      costPerMillionInputTokens: 150.0,
      costPerMillionOutputTokens: 600.0,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 200000,
    }),
    generateModelSpec("gpt-5-pro", {
      costPerMillionInputTokens: 15.0,
      costPerMillionOutputTokens: 120.0,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 400000,
    }),
    generateModelSpec("gpt-5-chat-latest", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 400000,
    }),
    generateModelSpec("gpt-5.1-chat-latest", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 400000,
    }),
    generateModelSpec("gpt-5.1-codex-mini", {
      costPerMillionInputTokens: 0.25,
      costPerMillionOutputTokens: 2,
      costPerMillionCachedInputTokens: 0.025,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
      maxContextLength: 400000,
    }),
    generateModelSpec("gpt-5-search-api", {
      costPerMillionInputTokens: 1.25,
      costPerMillionCachedInputTokens: 0.125,
      costPerMillionOutputTokens: 10,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: true,
          type: "boolean",
        }
      },
      maxContextLength: 400000,
    }),
    generateModelSpec("gpt-4o", {
      costPerMillionInputTokens: 2.5,
      costPerMillionOutputTokens: 10,
      costPerMillionCachedInputTokens: 1.25,
      maxContextLength: 128000,
    }),
    generateModelSpec("gpt-4o-2024-05-13", {
      costPerMillionInputTokens: 5.0,
      costPerMillionOutputTokens: 15.0,
      maxContextLength: 128000,
    }),
    generateModelSpec("gpt-4o-mini", {
      costPerMillionInputTokens: 0.15,
      costPerMillionOutputTokens: 0.6,
      costPerMillionCachedInputTokens: 0.075,
      maxContextLength: 128000,
    }),
    generateModelSpec("gpt-4o-mini-search-preview", {
      costPerMillionInputTokens: 0.15,
      costPerMillionOutputTokens: 0.6,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: true,
          type: "boolean",
        }
      },
      maxContextLength: 128000,
    }),
    generateModelSpec("gpt-4o-search-preview", {
      costPerMillionInputTokens: 2.5,
      costPerMillionOutputTokens: 10,
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: true,
          type: "boolean",
        }
      },
      maxContextLength: 128000,
    }),
    generateModelSpec("gpt-realtime", {
      costPerMillionInputTokens: 4.0,
      costPerMillionOutputTokens: 16.0,
      costPerMillionCachedInputTokens: 0.4,
      maxContextLength: 128000,
    }),
    generateModelSpec("gpt-realtime-mini", {
      costPerMillionInputTokens: 0.6,
      costPerMillionOutputTokens: 2.4,
      costPerMillionCachedInputTokens: 0.06,
      maxContextLength: 128000,
    }),
    generateModelSpec("gpt-4o-realtime-preview", {
      costPerMillionInputTokens: 5.0,
      costPerMillionOutputTokens: 20.0,
      costPerMillionCachedInputTokens: 2.5,
      maxContextLength: 128000,
    }),
    generateModelSpec("gpt-4o-mini-realtime-preview", {
      costPerMillionInputTokens: 0.6,
      costPerMillionOutputTokens: 2.4,
      costPerMillionCachedInputTokens: 0.3,
      maxContextLength: 128000,
    }),
    generateModelSpec("gpt-audio", {
      costPerMillionInputTokens: 2.5,
      costPerMillionOutputTokens: 10.0,
      maxContextLength: 128000,
    }),
    generateModelSpec("gpt-audio-mini", {
      costPerMillionInputTokens: 0.6,
      costPerMillionOutputTokens: 2.4,
      maxContextLength: 128000,
    }),
    generateModelSpec("gpt-4o-audio-preview", {
      costPerMillionInputTokens: 2.5,
      costPerMillionOutputTokens: 10.0,
      maxContextLength: 128000,
    }),
    generateModelSpec("gpt-4o-mini-audio-preview", {
      costPerMillionInputTokens: 0.15,
      costPerMillionOutputTokens: 0.6,
      maxContextLength: 128000,
    }),
    generateModelSpec("computer-use-preview", {
      costPerMillionInputTokens: 3.0,
      costPerMillionOutputTokens: 12.0,
      maxContextLength: 128000,
    }),
  ]);

  const imageGenerationModelRegistry = app.requireService(ImageGenerationModelRegistry);
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
    generateImageModelSpec("gpt-image-1.5", "gpt-image-1.5-high", {
      providerOptions: {
        openai: {quality: "high"},
      },
    }, 0.133),
    generateImageModelSpec("gpt-image-1.5", "gpt-image-1.5-medium", {
      providerOptions: {
        openai: {quality: "medium"},
      },
    }, 0.034),
    generateImageModelSpec("gpt-image-1.5", "gpt-image-1.5-low", {
      providerOptions: {
        openai: {quality: "low"},
      },
    }, 0.009),
    ]);

  const speechModelRegistry = app.requireService(SpeechModelRegistry);
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

  const transcriptionModelRegistry = app.requireService(TranscriptionModelRegistry);
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
}

export default {
  providerCode: 'openai',
  configSchema: OpenAIModelProviderConfigSchema,
  init
} satisfies AIModelProvider<typeof OpenAIModelProviderConfigSchema>;
