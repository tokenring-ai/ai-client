import {createOpenAI} from "@ai-sdk/openai";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import type {ImageModelSpec} from "../client/AIImageGenerationClient.ts";
import ModelRegistry from "../ModelRegistry.ts";
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
  modelRegistry: ModelRegistry,
  config: OpenAIModelProviderConfig,
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
    return {
      modelId,
      providerDisplayName: providerDisplayName,
      impl: openai(modelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some((model) => model.id === modelId);
      },
      // Generic mangleRequest that applies enabled features when present
      mangleRequest(req, features) {
        if (features?.websearch) {
          (req.tools ??= {}).web_search = openai.tools.webSearch({});
        }
        return undefined;
      },
      ...modelSpec,
    } as ChatModelSpec;
  }

  function generateImageModelSpec(
    modelId: string,
    variantId: string,
    modelSpec: Omit<
      ImageModelSpec,
      "isAvailable" | "provider" | "providerDisplayName" | "impl" | "modelId"
    >,
  ): ImageModelSpec {
    return {
      modelId: variantId,
      providerDisplayName: providerDisplayName,
      impl: openai.imageModel(modelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some((model) => model.id === modelId);
      },
      ...modelSpec,
    };
  }

  modelRegistry.chat.registerAllModelSpecs([
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
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
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
      features: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        }
      },
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
    generateModelSpec("o3", {
      costPerMillionInputTokens: 10.0,
      costPerMillionOutputTokens: 40.0,
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
  ]);

  modelRegistry.imageGeneration.registerAllModelSpecs([
    generateImageModelSpec("gpt-image-1-mini", "gpt-image-1-mini-high", {
      providerOptions: {
        openai: {quality: "high"},
      },
      costPerMillionInputTokens: 10,
      costPerMegapixel: 0.067,
    }),
    generateImageModelSpec("gpt-image-1-mini", "gpt-image-1-mini-medium", {
      providerOptions: {
        openai: {quality: "medium"},
      },
      costPerMillionInputTokens: 10,
      costPerMegapixel: 0.042,
    }),
    generateImageModelSpec("gpt-image-1-mini", "gpt-image-1-mini-low", {
      providerOptions: {
        openai: {quality: "low"},
      },
      costPerMillionInputTokens: 10,
      costPerMegapixel: 0.011,
    }),
    generateImageModelSpec("gpt-image-1", "gpt-image-1-high", {
      providerOptions: {
        openai: {quality: "high"},
      },
      costPerMillionInputTokens: 10,
      costPerMegapixel: 0.067,
    }),
    generateImageModelSpec("gpt-image-1", "gpt-image-1-medium", {
      providerOptions: {
        openai: {quality: "medium"},
      },
      costPerMillionInputTokens: 10,
      costPerMegapixel: 0.042,
    }),
    generateImageModelSpec("gpt-image-1", "gpt-image-1-low", {
      providerOptions: {
        openai: {quality: "low"},
      },
      costPerMillionInputTokens: 10,
      costPerMegapixel: 0.011,
    }),
  ]);

  modelRegistry.speech.registerAllModelSpecs([
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

  modelRegistry.transcription.registerAllModelSpecs([
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
