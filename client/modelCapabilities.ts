import type { JSONObject } from "@ai-sdk/provider";
import { audioMimeTypes, imageMimeTypes, textMimeTypes, videoMimeTypes } from "@tokenring-ai/agent/AgentEvents";
import { z } from "zod";

export const ModelInputCapabilitiesSchema = z.array(z.enum([...textMimeTypes, ...audioMimeTypes, ...videoMimeTypes, ...imageMimeTypes]));

export type ModelInputCapabilities = z.infer<typeof ModelInputCapabilitiesSchema>;

/** Provider options map: provider name → option object. */
export const ProviderOptionsSchema = z.record(z.string(), z.custom<JSONObject>());
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
