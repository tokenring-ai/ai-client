import { audioMimeTypes, imageMimeTypes, textMimeTypes, videoMimeTypes } from "@tokenring-ai/agent/AgentEvents";
import type { PrimitiveType } from "@tokenring-ai/utility";
import type { GenerateImageResult, ImageModel, LanguageModel } from "ai";
import type { MaybePromise } from "bun";
import { z } from "zod";
import type { ParsedChatRequest } from "./client/AIChatClient.ts";

const primitiveTypeSchema: z.ZodType<PrimitiveType> = z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()]);
export const ModelSettingsDefinitionSchema = z.discriminatedUnion("type", [
  z.object({
    description: z.string(),
    type: z.literal("boolean"),
    defaultValue: z.boolean().optional(),
  }),
  z.object({
    description: z.string(),
    type: z.literal("number"),
    defaultValue: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    description: z.string(),
    type: z.literal("string"),
    defaultValue: z.string().optional(),
  }),
  z.object({
    description: z.string(),
    type: z.literal("enum"),
    defaultValue: primitiveTypeSchema.optional(),
    values: z.array(primitiveTypeSchema),
  }),
  z.object({
    description: z.string(),
    type: z.literal("array"),
    defaultValue: z.array(primitiveTypeSchema).optional(),
  }),
]);
export type SettingDefinition = z.infer<typeof ModelSettingsDefinitionSchema>;
export const SerializedModelSpecSchema = z.object({
  modelId: z.string(),
  providerDisplayName: z.string(),
});
export type ModelSettings = Map<string, PrimitiveType>;
export type ModelSpec = z.infer<typeof SerializedModelSpecSchema> & {
  isAvailable?: () => MaybePromise<boolean>;
  isHot?: () => MaybePromise<boolean>;
  settings?: Record<string, SettingDefinition> | undefined;
};

export interface ModelStatus<T> {
  status: string;
  available: boolean;
  hot: boolean;
  modelSpec: T;
}

export const AIResponseCostSchema = z
  .object({
    input: z.number().default(0),
    cachedInput: z.number().default(0),
    output: z.number().default(0),
    reasoning: z.number().default(0),
    total: z.number().default(0),
  })
  .prefault({});
export type AIResponseCost = z.infer<typeof AIResponseCostSchema>;
export const AIResponseTimingSchema = z.object({
  elapsedMs: z.number(),
  tokensPerSec: z.number().exactOptional(),
  totalTokens: z.number().exactOptional(),
});
export type AIResponseTiming = z.infer<typeof AIResponseTimingSchema>;
export const LanguageModelUsageSchema = z
  .object({
    inputTokens: z.number().default(0),
    inputTokenDetails: z
      .object({
        noCacheTokens: z.number().default(0),
        cacheReadTokens: z.number().default(0),
        cacheWriteTokens: z.number().default(0),
      })
      .prefault({}),
    outputTokens: z.number().default(0),
    outputTokenDetails: z
      .object({
        textTokens: z.number().default(0),
        reasoningTokens: z.number().default(0),
      })
      .prefault({}),
    totalTokens: z.number().default(0),
  })
  .prefault({});
export const VideoSizingSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("direct"),
    aspectRatio: z
      .object({
        width: z.number(),
        height: z.number(),
      })
      .exactOptional(),
    resolution: z
      .object({
        width: z.number(),
        height: z.number(),
      })
      .exactOptional(),
  }),
  z.object({
    method: z.literal("guided"),
    quality: z.enum(["ultra", "high", "standard", "low"]).describe("Quality of the generated video"),
    shape: z.enum(["square", "landscape", "portrait", "ultrawide", "ultratall"]).describe("Shape of the generated video"),
  }),
]);
export type VideoSizing = z.input<typeof VideoSizingSchema>;
export type ParsedVideoSizing = z.output<typeof VideoSizingSchema>;
export type DeterminedVideoSizing = {
  aspectRatio?: `${number}:${number}`;
  resolution?: `${number}x${number}`;
  width?: number;
  height?: number;
};
export const ModelInputCapabilitiesSchema = z.array(z.enum([...textMimeTypes, ...audioMimeTypes, ...videoMimeTypes, ...imageMimeTypes]));
export type ModelInputCapabilities = z.infer<typeof ModelInputCapabilitiesSchema>;
/** Provider options map: provider name → option object. */
export const ProviderOptionsSchema = z.record(z.string(), z.record(z.string(), z.json()));
export type ProviderOptions = z.infer<typeof ProviderOptionsSchema>;
export const BaseModelSpecSchema = z.object({
  modelId: z.string(),
  providerDisplayName: z.string(),
  isAvailable: z.function({ input: z.tuple([]), output: z.promise(z.boolean()) }).exactOptional(),
  isHot: z.function({ input: z.tuple([]), output: z.promise(z.boolean()) }).exactOptional(),
  settings: z.record(z.string(), z.any()).exactOptional(),
  inputCapabilities: ModelInputCapabilitiesSchema,
  /** Default provider options merged into every request (request values win). */
  providerOptions: ProviderOptionsSchema.exactOptional(),
});
export const VideoRequestSchema = z.object({
  prompt: z.union([
    z.string(),
    z.object({
      image: z.union([z.string(), z.custom<Uint8Array>()]),
      text: z.string().exactOptional(),
    }),
  ]),
  aspectRatio: z.custom<`${number}:${number}`>().exactOptional(),
  resolution: z.custom<`${number}x${number}`>().exactOptional(),
  duration: z.number().exactOptional(),
  fps: z.number().exactOptional(),
  seed: z.number().exactOptional(),
  n: z.number().exactOptional(),
  providerOptions: ProviderOptionsSchema.prefault({}),
});
export type VideoRequest = z.input<typeof VideoRequestSchema>;
export const ImageSizingSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("direct"),
    size: z.object({
      width: z.number(),
      height: z.number(),
    }),
  }),
  z.object({
    method: z.literal("guided"),
    quality: z.enum(["ultra", "high", "standard", "low"]).describe("Quality of the generated image"),
    shape: z.enum(["square", "landscape", "portrait", "ultrawide", "ultratall"]).describe("Shape of the generated image"),
  }),
]);
export const ImageRequestSchema = z.object({
  prompt: z.string(),
  n: z.literal(1).default(1),
  maxImagesPerCall: z.number().exactOptional(),
  widthAndHeight: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .nullable(),
  seed: z.number().exactOptional(),
  providerOptions: ProviderOptionsSchema.prefault({}),
});
export type ImageRequest = z.input<typeof ImageRequestSchema>;
export type ParsedImageRequest = z.output<typeof ImageRequestSchema>;
export const ImageModelSpecSchema = BaseModelSpecSchema.extend({
  impl: z.custom<ImageModel>(),
  mangleRequest: z.custom<(req: ParsedImageRequest, settings: ModelSettings) => void>().exactOptional(),

  contextLength: z.number().exactOptional(),
  calculateImageCost: z.custom<(req: ParsedImageRequest, res: GenerateImageResult) => number>(),

  promptBasedAutomaticSizing: z.boolean().default(false),
  minimumMegapixels: z.number().default(0.25),
  maximumMegapixels: z.number().default(10),
  explicitSizes: z.array(z.array(z.number())).exactOptional(),
  supportsSizeParameter: z.boolean().default(true),
});
export const ChatModelSpecSchema = BaseModelSpecSchema.extend({
  impl: z.custom<Exclude<LanguageModel, string>>(),
  mangleRequest: z.custom<(req: ParsedChatRequest, settings: ModelSettings) => void>().exactOptional(),
  tools: z.boolean().default(true),
  structuredOutput: z.boolean().default(true),
  webSearch: z.boolean().exactOptional(),
  maxCompletionTokens: z.number().exactOptional(),
  maxContextLength: z.number(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  costPerMillionCachedInputTokens: z.number().exactOptional(),
  costPerMillionReasoningTokens: z.number().exactOptional(),
});
export type ChatModelSpec = z.input<typeof ChatModelSpecSchema>;
export type ParsedChatModelSpec = z.output<typeof ChatModelSpecSchema>;
export const SerializedChatModelSpecSchema = ChatModelSpecSchema.omit({
  impl: true,
  mangleRequest: true,
  isAvailable: true,
  isHot: true,
});
