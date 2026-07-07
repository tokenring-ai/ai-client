import type { SharedV4ProviderOptions } from "@ai-sdk/provider";
import type Agent from "@tokenring-ai/agent/Agent";
import { type DataContent, type TranscriptionModel, transcribe } from "ai";
import { z } from "zod";
import type { ChatModelSettings, ModelSpec } from "../ModelTypeRegistry.ts";
import { createModelSpecSchema, type ModelInputCapabilities, TranscriptionModelInputCapabilitiesSchema } from "./modelCapabilities.ts";

export interface TranscriptionResult {
  text: string;
}

export type TranscriptionRequest = {
  audio: DataContent | URL;
};

export type TranscriptionModelSpec = ModelSpec & {
  costPerMinute?: number;
  impl: TranscriptionModel;
  inputCapabilities?: Partial<ModelInputCapabilities>;
  providerOptions?: SharedV4ProviderOptions;
  /** Optional hook to adjust the request prior to sending. */
  mangleRequest?: (req: TranscriptionRequest, settings?: Record<string, any>) => void;
};

export const TranscriptionModelSpecSchema = createModelSpecSchema(TranscriptionModelInputCapabilitiesSchema).extend({
  costPerMinute: z.number().exactOptional(),
});

export function normalizeTranscriptionModelSpec(modelSpec: TranscriptionModelSpec): TranscriptionModelSpec {
  return TranscriptionModelSpecSchema.parse({
    ...modelSpec,
    inputCapabilities: modelSpec.inputCapabilities ?? {},
  }) as TranscriptionModelSpec;
}

export default class AITranscriptionClient {
  constructor(
    private readonly modelSpec: TranscriptionModelSpec,
    private settings: ChatModelSettings,
  ) {}

  /**
   * Set settings for this client instance.
   */
  setSettings(settings: ChatModelSettings): void {
    this.settings = new Map(settings.entries());
  }

  /**
   * Get a copy of the settings.
   */
  getSettings(): ChatModelSettings {
    return new Map(this.settings.entries());
  }

  async transcribe(request: TranscriptionRequest, agent: Agent): Promise<[string, TranscriptionResult]> {
    const signal = agent.getAbortSignal();

    if (this.modelSpec.mangleRequest) {
      request = { ...request };
      this.modelSpec.mangleRequest(request, this.settings);
    }
    const result = await transcribe({
      ...request,
      model: this.modelSpec.impl,
      providerOptions: this.modelSpec.providerOptions ?? {},
      abortSignal: signal,
    });

    return [result.text, result];
  }

  getModelSpec(): TranscriptionModelSpec {
    return this.modelSpec;
  }
}
