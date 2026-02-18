import {xai} from "@ai-sdk/xai";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import {ChatModelRegistry, ImageGenerationModelRegistry, VideoGenerationModelRegistry} from "../ModelRegistry.ts";
import {AIModelProvider} from "../schema.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

export const XAIModelProviderConfigSchema = z.object({
  provider: z.literal('xai'),
  apiKey: z.string(),
});
interface Model {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

interface ModelList {
  object: "list";
  data: Model[];
}

export async function init(
  providerDisplayName: string,
  config: z.output<typeof XAIModelProviderConfigSchema>,
  app: TokenRingApp,
) {
  if (!config.apiKey) {
    throw new Error("No config.apiKey provided for xAI provider.");
  }

  const getModels = cachedDataRetriever("https://api.x.ai/v1/models", {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  }) as () => Promise<ModelList | null>;

  function generateModelSpec(
    modelId: string,
    modelSpec: Omit<
      ChatModelSpec,
      "isAvailable" | "provider" | "providerDisplayName" | "impl" | "modelId" | "settings" | "mangleRequest"
    >,
  ): ChatModelSpec {
    return {
      ...modelSpec,
      modelId,
      providerDisplayName: providerDisplayName,
      impl: xai.responses(modelId),
      async isAvailable() {
        const modelList = await getModels();
        return !!modelList?.data.some((model) => model.id === modelId);
      },
      mangleRequest(req, settings) {
        if (settings.websearch) {
          req.tools.web_search = xai.tools.webSearch({
            enableImageUnderstanding: settings.webImageUnderstanding as boolean,
          });
        }

        if (settings.XSearch) {
          req.tools.x_search = xai.tools.xSearch({
            allowedXHandles: (settings.XAllowedHandles as string | undefined)?.split(','),
            fromDate: settings.XFromDate as string | undefined,
            toDate: settings.XToDate as string | undefined,
            enableImageUnderstanding: settings.XImageUnderstanding as boolean,
            enableVideoUnderstanding: settings.XVideoUnderstanding as boolean,
          });
        }
      },
      settings: {
        websearch: {
          description: "Enables web search",
          defaultValue: false,
          type: "boolean",
        },
        webImageUnderstanding: {
          description: "Enables image understanding in web search",
          defaultValue: false,
          type: "boolean",
        },
        XSearch: {
          description: "Enables X search",
          defaultValue: false,
          type: "boolean",
        },
        XFromDate: {
          description: "From date for X search",
          defaultValue: undefined,
          type: "string",
        },
        XToDate: {
          description: "To date for X search",
          defaultValue: undefined,
          type: "string",
        },
        XAllowedHandles: {
          description: "Allowed handles for X search",
          defaultValue: undefined,
          type: "string",
        },
        XImageUnderstanding: {
          description: "Enables image understanding in X search",
          defaultValue: false,
          type: "boolean",
        },
        XVideoUnderstanding: {
          description: "Enables video understanding in X search",
          defaultValue: false,
          type: "boolean",
        },
      },
    };
  }


  /**
   * A collection of xAI chat model specifications.
   * Each key is a model ID, and the value is a `ChatModelSpec` object.
   * Assumes `ChatModelSpec` typedef is defined elsewhere (e.g., in AIChatClient.ts).
   */
  app.waitForService(ChatModelRegistry, chatModelRegistry => {
    chatModelRegistry.registerAllModelSpecs([
      generateModelSpec("grok-code-fast-1", {
        costPerMillionInputTokens: 0.2,
        costPerMillionCachedInputTokens: 0.02,
        costPerMillionOutputTokens: 1.5,
        reasoningText: 5,
        intelligence: 5,
        tools: 5,
        speed: 6,
        contextLength: 256000,
      }),
      generateModelSpec("grok-4-0709", {
        costPerMillionInputTokens: 3,
        costPerMillionOutputTokens: 15.0,
        reasoningText: 6,
        intelligence: 6,
        tools: 6,
        speed: 3,
        contextLength: 256000,
      }),
      generateModelSpec("grok-4-1-fast-reasoning", {
        costPerMillionInputTokens: 0.2,
        costPerMillionCachedInputTokens: 0.05,
        costPerMillionOutputTokens: 0.5,
        reasoningText: 6,
        intelligence: 6,
        tools: 6,
        speed: 5,
        contextLength: 2000000,
      }),
      generateModelSpec("grok-4-1-fast-non-reasoning", {
        costPerMillionInputTokens: 0.2,
        costPerMillionCachedInputTokens: 0.05,
        costPerMillionOutputTokens: 0.5,
        reasoningText: 0,
        intelligence: 6,
        tools: 6,
        speed: 6,
        contextLength: 2000000,
      }),
      generateModelSpec("grok-4-fast-reasoning", {
        costPerMillionInputTokens: 0.2,
        costPerMillionCachedInputTokens: 0.05,
        costPerMillionOutputTokens: 0.5,
        reasoningText: 5,
        intelligence: 5,
        tools: 5,
        speed: 3,
        contextLength: 2000000,
      }),
      generateModelSpec("grok-4-fast-non-reasoning", {
        costPerMillionInputTokens: 0.2,
        costPerMillionCachedInputTokens: 0.05,
        costPerMillionOutputTokens: 0.5,
        reasoningText: 0,
        intelligence: 5,
        tools: 5,
        speed: 6,
        contextLength: 2000000,
      }),
      generateModelSpec("grok-3", {
        costPerMillionInputTokens: 3,
        costPerMillionOutputTokens: 15.0,
        reasoningText: 0,
        intelligence: 5,
        tools: 5,
        speed: 2,
        contextLength: 131072,
      }),
      generateModelSpec("grok-3-mini", {
        costPerMillionInputTokens: 0.3,
        costPerMillionOutputTokens: 0.5,
        reasoningText: 4,
        intelligence: 4,
        tools: 4,
        speed: 3,
        contextLength: 131072,
      }),
      generateModelSpec("grok-4-0709", {
        costPerMillionInputTokens: 3,
        costPerMillionOutputTokens: 15.0,
        reasoningText: 6,
        intelligence: 6,
        tools: 6,
        speed: 3,
        contextLength: 256000,
      }),
    ]);
  });

  /**
   * A collection of xAI image generation model specifications.
   * Each key is a model ID, and the value is an `ImageModelSpec` object.
   */
  app.waitForService(ImageGenerationModelRegistry, imageGenerationModelRegistry => {
    imageGenerationModelRegistry.registerAllModelSpecs([
      {
        modelId: "grok-imagine-image-pro",
        providerDisplayName: providerDisplayName,
        impl: xai.imageModel("grok-imagine-image-pro"),
        async isAvailable() {
          const modelList = await getModels();
          return !!modelList?.data.some((model) => model.id === "grok-imagine-image-pro");
        },
        calculateImageCost() {
          return 0.07;
        },
      },
      {
        modelId: "grok-imagine-image",
        providerDisplayName: providerDisplayName,
        impl: xai.imageModel("grok-imagine-image"),
        async isAvailable() {
          const modelList = await getModels();
          return !!modelList?.data.some((model) => model.id === "grok-imagine-image");
        },
        calculateImageCost() {
          return 0.02;
        },
      },
      {
        modelId: "grok-2-image-1212",
        providerDisplayName: providerDisplayName,
        impl: xai.imageModel("grok-2-image-1212"),
        async isAvailable() {
          const modelList = await getModels();
          return !!modelList?.data.some(
            (model) => model.id === "grok-2-image-1212",
          );
        },
        calculateImageCost(req, result) {
          return 0.07;
        },
      },
    ]);

    /**
     * A collection of xAI video generation model specifications.
     * Each key is a model ID, and the value is an `VideoModelSpec` object.
     */
    app.waitForService(VideoGenerationModelRegistry, videoGenerationModelRegistry => {
      videoGenerationModelRegistry.registerAllModelSpecs([
        {
          modelId: "grok-imagine-video",
          providerDisplayName: providerDisplayName,
          impl: xai.videoModel("grok-imagine-video"),
          async isAvailable() {
            const modelList = await getModels();
            return !!modelList?.data.some((model) => model.id === "grok-imagine-video");
          },
          calculateVideoCost(request) {
            return request.duration ? request.duration * 0.05 : NaN;
          },
        },
      ]);
    });
  });
}

export default {
  providerCode: 'xai',
  configSchema: XAIModelProviderConfigSchema,
  init
} satisfies AIModelProvider<typeof XAIModelProviderConfigSchema>;

