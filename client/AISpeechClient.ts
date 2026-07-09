import type Agent from "@tokenring-ai/agent/Agent";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import { generateSpeech, type SpeechModel, type SpeechResult } from "ai";
import { z } from "zod";
import type { ModelSettings } from "../ModelTypeRegistry.ts";
import { BaseModelSpecSchema, ProviderOptionsSchema } from "./modelCapabilities.ts";

export const SpeechRequestSchema = z.object({
  text: z.string(),
  voice: z.string().exactOptional(),
  speed: z.number().exactOptional(),
  providerOptions: ProviderOptionsSchema.prefault({}),
});

export type SpeechRequest = z.input<typeof SpeechRequestSchema>;
export type ParsedSpeechRequest = z.output<typeof SpeechRequestSchema>;

export const SpeechModelSpecSchema = BaseModelSpecSchema.extend({
  impl: z.custom<SpeechModel>(),
  mangleRequest: z.custom<(req: ParsedSpeechRequest, settings: ModelSettings) => void>().exactOptional(),

  costPerMillionCharacters: z.number().exactOptional(),
});

export type SpeechModelSpec = z.input<typeof SpeechModelSpecSchema>;
export type ParsedSpeechModelSpec = z.output<typeof SpeechModelSpecSchema>;

export default class AISpeechClient {
  constructor(
    private modelSpec: SpeechModelSpec,
    private settings: ModelSettings,
  ) {}

  /**
   * Set settings for this client instance.
   */
  setSettings(settings: ModelSettings): void {
    this.settings = new Map(settings.entries());
  }

  /**
   * Get a copy of the settings.
   */
  getSettings(): ModelSettings {
    return new Map(this.settings.entries());
  }

  async generateSpeech(request: SpeechRequest, agent: Agent): Promise<[Uint8Array, SpeechResult]> {
    const signal = agent.getAbortSignal();

    const parsedRequest = SpeechRequestSchema.parse(request);
    parsedRequest.providerOptions = deepClone(this.modelSpec.providerOptions, parsedRequest.providerOptions);

    this.modelSpec.mangleRequest?.(parsedRequest, this.settings);

    const result = await generateSpeech({
      ...parsedRequest,
      model: this.modelSpec.impl,
      abortSignal: signal,
    });

    return [result.audio.uint8Array, result];
  }

  getModelSpec(): SpeechModelSpec {
    return this.modelSpec;
  }
}
