import Agent from "@tokenring-ai/agent/Agent";
import {experimental_generateSpeech as generateSpeech, Experimental_SpeechResult, type SpeechModel,} from "ai";
import type {ChatModelSettings, ModelSpec} from "../ModelTypeRegistry.js";

export type SpeechRequest = {
  text: string;
  voice?: string;
  speed?: number;
};

export type SpeechModelSpec = ModelSpec & {
  costPerMillionCharacters?: number;
  impl: SpeechModel;
  providerOptions?: any;
  /** Optional hook to adjust the request prior to sending. */
  mangleRequest?: (
    req: SpeechRequest,
    settings?: Record<string, any>,
  ) => void;
};

export default class AISpeechClient {
  constructor(private modelSpec: SpeechModelSpec, private settings: ChatModelSettings = {}) {
  }

  setSettings(settings: ChatModelSettings | undefined): void {
    this.settings = {...(settings ?? {})};
  }

  getSettings(): Record<string, any> {
    return {...this.settings};
  }

  async generateSpeech(
    request: SpeechRequest,
    agent: Agent,
  ): Promise<[Uint8Array, Experimental_SpeechResult]> {
    const signal = agent.getAbortSignal();

    try {
      if (this.modelSpec.mangleRequest) {
        request = {...request};
        this.modelSpec.mangleRequest(request, this.settings);
      }
      const result = await generateSpeech({
        ...request,
        model: this.modelSpec.impl,
        providerOptions: this.modelSpec.providerOptions ?? {},
        abortSignal: signal,
      });

      return [result.audio.uint8Array, result];
    } catch (error) {
      agent.errorMessage("Error generating speech: ", error as Error);
      throw error;
    }
  }

  getModelSpec(): SpeechModelSpec {
    return this.modelSpec;
  }
}
