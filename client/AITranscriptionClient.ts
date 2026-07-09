import type Agent from "@tokenring-ai/agent/Agent";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import { type DataContent, type TranscriptionModel, transcribe } from "ai";
import { z } from "zod";
import type { ModelSettings } from "../ModelTypeRegistry.ts";
import { BaseModelSpecSchema, ProviderOptionsSchema } from "./modelCapabilities.ts";

export interface TranscriptionResult {
  text: string;
}

export const TranscriptionRequestSchema = z.object({
  audio: z.custom<DataContent | URL>(),
  providerOptions: ProviderOptionsSchema.prefault({}),
});

export type TranscriptionRequest = z.input<typeof TranscriptionRequestSchema>;
export type ParsedTranscriptionRequest = z.output<typeof TranscriptionRequestSchema>;

export const TranscriptionModelSpecSchema = BaseModelSpecSchema.extend({
  impl: z.custom<TranscriptionModel>(),
  mangleRequest: z.custom<(req: ParsedTranscriptionRequest, settings: ModelSettings) => void>().exactOptional(),
  costPerMinute: z.number().exactOptional(),
});

export type TranscriptionModelSpec = z.input<typeof TranscriptionModelSpecSchema>;
export type ParsedTranscriptionModelSpec = z.output<typeof TranscriptionModelSpecSchema>;

export default class AITranscriptionClient {
  constructor(
    private readonly modelSpec: TranscriptionModelSpec,
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

  async transcribe(request: TranscriptionRequest, agent: Agent): Promise<[string, TranscriptionResult]> {
    const signal = agent.getAbortSignal();

    const parsedRequest = TranscriptionRequestSchema.parse(request);
    parsedRequest.providerOptions = deepClone(this.modelSpec.providerOptions, parsedRequest.providerOptions);

    this.modelSpec.mangleRequest?.(parsedRequest, this.settings);

    const result = await transcribe({
      ...parsedRequest,
      model: this.modelSpec.impl,
      abortSignal: signal,
    });

    return [result.text, result];
  }

  getModelSpec(): TranscriptionModelSpec {
    return this.modelSpec;
  }
}
