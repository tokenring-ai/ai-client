import Agent from "@tokenring-ai/agent/Agent";
import {
  experimental_generateSpeech as generateSpeech,
  Experimental_SpeechResult,
  type SpeechModel,
} from "ai";
import type { ModelSpec } from "../ModelTypeRegistry.js";

export type SpeechRequest = {
	text: string;
	voice?: string;
	speed?: number;
};

export type SpeechModelSpec = ModelSpec & {
	costPerMillionCharacters?: number;
	impl: SpeechModel;
	providerOptions?: any;
};

export default class AISpeechClient {
	modelSpec: SpeechModelSpec;

	constructor(modelSpec: SpeechModelSpec) {
		this.modelSpec = modelSpec;
	}

	getModelId(): string {
		return this.modelSpec.impl.modelId;
	}

	async generateSpeech(
		request: SpeechRequest,
		agent: Agent,
	): Promise<[Uint8Array, Experimental_SpeechResult]> {
		const signal = agent.getAbortSignal();

		try {
			const result = await generateSpeech({
				...request,
				model: this.modelSpec.impl,
				providerOptions: this.modelSpec.providerOptions ?? {},
				abortSignal: signal,
			});

			return [result.audio.uint8Array, result];
		} catch (error) {
			agent.errorLine("Error generating speech: ", error as Error);
			throw error;
		}
	}

	getModelSpec(): SpeechModelSpec {
		return this.modelSpec;
	}
}
