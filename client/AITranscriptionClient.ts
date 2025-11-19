import Agent from "@tokenring-ai/agent/Agent";
import {
  type DataContent,
  experimental_transcribe as transcribe,
  type TranscriptionModel,
} from "ai";
import type { ModelSpec } from "../ModelTypeRegistry.js";


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
        features?: Record<string, any>,
    ) => void;
};

export default class AITranscriptionClient {
    modelSpec: TranscriptionModelSpec;
    private features: Record<string, number | boolean | string> = {};

 constructor(modelSpec: TranscriptionModelSpec,features: typeof this.features = {}) {
        this.modelSpec = modelSpec;
        this.features = features;
    }

    setFeatures(features: Record<string, any> | undefined): void {
        this.features = { ...(features ?? {}) };
    }

    getFeatures(): Record<string, any> {
        return { ...this.features };
    }

	getModelId(): string {
		return this.modelSpec.impl.modelId;
	}

 async transcribe(
        request: TranscriptionRequest,
        agent: Agent,
    ): Promise<[string, TranscriptionResult]> {
        const signal = agent.getAbortSignal();

        try {
            if (this.modelSpec.mangleRequest) {
                request = { ...request };
                this.modelSpec.mangleRequest(request, this.features);
            }
            const result = await transcribe({
                ...request,
                model: this.modelSpec.impl,
                providerOptions: {
          ...this.modelSpec.providerOptions,
          ...(request.language && { language: request.language}),
          ...(request.prompt && { prompt: request.prompt})
        },
                abortSignal: signal,
            });

			return [result.text, result];
		} catch (error) {
			agent.errorLine("Error transcribing audio: ", error as Error);
			throw error;
		}
	}

	getModelSpec(): TranscriptionModelSpec {
		return this.modelSpec;
	}
}
