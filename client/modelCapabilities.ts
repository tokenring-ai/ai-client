import { z } from "zod";

export const ModelInputCapabilitySchema = z.union([z.boolean(), z.array(z.string())]);
export type ModelInputCapability = z.infer<typeof ModelInputCapabilitySchema>;

export const ModelInputCapabilitiesSchema = z.object({
  text: z.boolean().default(true),
  image: ModelInputCapabilitySchema.default(false),
  video: ModelInputCapabilitySchema.default(false),
  audio: ModelInputCapabilitySchema.default(false),
  file: ModelInputCapabilitySchema.default(false),
});
export type ModelInputCapabilities = z.infer<typeof ModelInputCapabilitiesSchema>;

export const TranscriptionModelInputCapabilitiesSchema = ModelInputCapabilitiesSchema.extend({
  text: z.boolean().default(false),
  audio: ModelInputCapabilitySchema.default(true),
});

export const BaseModelSpecSchema = z.object({
  modelId: z.string(),
  providerDisplayName: z.string(),
  isAvailable: z.function({ input: z.tuple([]), output: z.promise(z.boolean()) }).exactOptional(),
  isHot: z.function({ input: z.tuple([]), output: z.promise(z.boolean()) }).exactOptional(),
  settings: z.record(z.string(), z.any()).exactOptional(),
});

export function createModelSpecSchema<TInputCapabilities extends z.ZodTypeAny>(inputCapabilitiesSchema: TInputCapabilities) {
  return BaseModelSpecSchema.extend({
    impl: z.any(),
    mangleRequest: z.function().exactOptional(),
    providerOptions: z.any().exactOptional(),
    inputCapabilities: inputCapabilitiesSchema.exactOptional(),
  }).passthrough();
}
