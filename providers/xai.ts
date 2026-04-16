import {xai} from "@ai-sdk/xai";
import type TokenRingApp from "@tokenring-ai/app";
import cachedDataRetriever from "@tokenring-ai/utility/http/cachedDataRetriever";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import {ChatModelRegistry, ImageGenerationModelRegistry, VideoGenerationModelRegistry} from "../ModelRegistry.ts";
import modelConfigs from "../models/xai.yaml" with {type: "yaml"};
import type {AIModelProvider} from "../schema.ts";

const ChatModelSchema = z.object({
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  costPerMillionCachedInputTokens: z.number().optional(),
  maxContextLength: z.number(),
});

const ImageGenerationModelSchema = z.object({
  costPerImage: z.number(),
});

const VideoGenerationModelSchema = z.object({
  costPerSecond: z.number(),
});

const XAISchema = z.object({
  chat: z.record(z.string(), ChatModelSchema),
  imageGeneration: z.record(z.string(), ImageGenerationModelSchema),
  videoGeneration: z.record(z.string(), VideoGenerationModelSchema),
});

const parsedModelConfigs = XAISchema.parse(modelConfigs.models.xai);

export const XAIModelProviderConfigSchema = z.object({
  provider: z.literal("xai"),
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

export function init(
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
      | "isAvailable"
      | "provider"
      | "providerDisplayName"
      | "impl"
      | "modelId"
      | "settings"
      | "mangleRequest"
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
        if (settings.has("websearch")) {
          req.tools.web_search = xai.tools.webSearch({
            enableImageUnderstanding: settings.get(
              "webImageUnderstanding",
            ) as boolean,
          });
        }

        if (settings.has("XSearch")) {
          req.tools.x_search = xai.tools.xSearch({
            allowedXHandles: (
              settings.get("XAllowedHandles") as string | undefined
            )?.split(","),
            fromDate: settings.get("XFromDate") as string | undefined,
            toDate: settings.get("XToDate") as string | undefined,
            enableImageUnderstanding: settings.get(
              "XImageUnderstanding",
            ) as boolean,
            enableVideoUnderstanding: settings.get(
              "XVideoUnderstanding",
            ) as boolean,
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

  app.waitForService(ChatModelRegistry, (chatModelRegistry) => {
    chatModelRegistry.registerAllModelSpecs(
      Object.entries(parsedModelConfigs.chat).map(([modelId, config]) =>
        generateModelSpec(modelId, config),
      ),
    );
  });

  app.waitForService(
    ImageGenerationModelRegistry,
    (imageGenerationModelRegistry) => {
      imageGenerationModelRegistry.registerAllModelSpecs(
        Object.entries(parsedModelConfigs.imageGeneration).map(([modelId, config]) => ({
          modelId,
          providerDisplayName,
          impl: xai.imageModel(modelId),
          async isAvailable() {
            const modelList = await getModels();
            return !!modelList?.data.some((model) => model.id === modelId);
          },
          calculateImageCost() {
            return config.costPerImage;
          },
        })),
      );

      app.waitForService(
        VideoGenerationModelRegistry,
        (videoGenerationModelRegistry) => {
          videoGenerationModelRegistry.registerAllModelSpecs(
            Object.entries(parsedModelConfigs.videoGeneration).map(([modelId, config]) => ({
              modelId,
              providerDisplayName,
              impl: xai.videoModel(modelId),
              inputCapabilities: {image: true},
              async isAvailable() {
                const modelList = await getModels();
                return !!modelList?.data.some((model) => model.id === modelId);
              },
              calculateVideoCost(request: { duration?: number }) {
                return request.duration ? request.duration * config.costPerSecond : NaN;
              },
            })),
          );
        },
      );
    },
  );
}

export default {
  providerCode: "xai",
  configSchema: XAIModelProviderConfigSchema,
  init,
} satisfies AIModelProvider<typeof XAIModelProviderConfigSchema>;
