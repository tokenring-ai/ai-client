import Agent from "@tokenring-ai/agent/Agent";
import {type DataContent, experimental_transcribe as transcribe, type TranscriptionModel,} from "ai";
import type {ChatModelSettings, ModelSpec} from "../ModelTypeRegistry.js";

export interface TranscriptionResult {
  text: string;
}

export type TranscriptionRequest = {
  audio: DataContent | URL;
  language?: string;
  prompt?: string;
};

export type TranscriptionModelSpec = ModelSpec & {
  costPerMinute?: number;
  impl: TranscriptionModel;
  providerOptions?: any;
  /** Optional hook to adjust the request prior to sending. */
  mangleRequest?: (
    req: TranscriptionRequest,
    settings?: Record<string, any>,
  ) => void;
};

export default class AITranscriptionClient {
  constructor(private readonly modelSpec: TranscriptionModelSpec, private settings: ChatModelSettings = {}) {
  }

  setSettings(settings: ChatModelSettings | undefined): void {
    this.settings = {...(settings ?? {})};
  }

  getSettings(): Record<string, any> {
    return {...this.settings};
  }

  async transcribe(
    request: TranscriptionRequest,
    agent: Agent,
  ): Promise<[string, TranscriptionResult]> {
    const signal = agent.getAbortSignal();

    try {
      if (this.modelSpec.mangleRequest) {
        request = {...request};
        this.modelSpec.mangleRequest(request, this.settings);
      }
      const result = await transcribe({
        ...request,
        model: this.modelSpec.impl,
        providerOptions: {
          ...this.modelSpec.providerOptions,
          ...(request.language && {language: request.language}),
          ...(request.prompt && {prompt: request.prompt})
        },
        abortSignal: signal,
      });

      return [result.text, result];
    } catch (error) {
      agent.errorMessage("Error transcribing audio: ", error as Error);
      throw error;
    }
  }

  getModelSpec(): TranscriptionModelSpec {
    return this.modelSpec;
  }
}