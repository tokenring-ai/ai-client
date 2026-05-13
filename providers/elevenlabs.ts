import { createElevenLabs } from "@ai-sdk/elevenlabs";
import type TokenRingApp from "@tokenring-ai/app";
import { z } from "zod";
import type { SpeechModelSpec } from "../client/AISpeechClient.ts";
import type { TranscriptionModelSpec } from "../client/AITranscriptionClient.ts";
import { ModelProvider } from "../ModelProvider.ts";
import { SpeechModelRegistry, TranscriptionModelRegistry } from "../ModelRegistry.ts";

const SpeechModelSchema = z.object({
  costPerMillionCharacters: z.number(),
  supportsLanguageCode: z.boolean(),
});

const TranscriptionModelSchema = z.object({
  costPerMinute: z.number(),
});

const ElevenLabsModelsSchema = z.object({
  speech: z.record(z.string(), SpeechModelSchema),
  transcription: z.record(z.string(), TranscriptionModelSchema),
});

const ElevenLabsModelProviderConfigSchema = z.object({
  provider: z.literal("elevenlabs"),
  apiKeyFromEnv: z.string().default("ELEVENLABS_API_KEY"),
  models: ElevenLabsModelsSchema,
});

type ElevenLabsConfig = z.output<typeof ElevenLabsModelProviderConfigSchema>;

export default class ElevenLabsProvider extends ModelProvider<ElevenLabsConfig> {
  static readonly providerCode = "elevenlabs" as const;
  static readonly configSchema = ElevenLabsModelProviderConfigSchema;

  readonly name: string;
  readonly description = "ElevenLabs AI provider";

  private config!: ElevenLabsConfig;
  private apiKey: string | undefined;
  private elevenlabs: ReturnType<typeof createElevenLabs> | undefined;

  private speechRegistry: SpeechModelRegistry | undefined;
  private transcriptionRegistry: TranscriptionModelRegistry | undefined;

  private registeredSpeechKeys = new Set<string>();
  private registeredTranscriptionKeys = new Set<string>();

  constructor(
    providerDisplayName: string,
    config: ElevenLabsConfig,
    private readonly app: TokenRingApp,
  ) {
    super();
    this.name = providerDisplayName;
    this.app.waitForService(SpeechModelRegistry, r => { this.speechRegistry = r; });
    this.app.waitForService(TranscriptionModelRegistry, r => { this.transcriptionRegistry = r; });
    this.applyConfig(config);
  }

  async reconfigure(config: ElevenLabsConfig): Promise<void> {
    this.applyConfig(config);
  }

  ready(): Promise<void> {
    return Promise.resolve();
  }

  private applyConfig(config: ElevenLabsConfig): void {
    this.config = config;
    this.apiKey = process.env[config.apiKeyFromEnv];

    if (!this.apiKey) {
      this.elevenlabs = undefined;
      this.syncSpeechModels([]);
      this.syncTranscriptionModels([]);
      return;
    }

    this.elevenlabs = createElevenLabs({ apiKey: this.apiKey });

    this.syncSpeechModels(this.buildSpeechSpecs());
    this.syncTranscriptionModels(this.buildTranscriptionSpecs());
  }

  private buildSpeechSpecs(): SpeechModelSpec[] {
    if (!this.elevenlabs) return [];
    const elevenlabs = this.elevenlabs;
    return Object.entries(this.config.models.speech).map(([modelId, modelConfig]) => ({
      modelId,
      providerDisplayName: this.name,
      impl: elevenlabs.speech(modelId),
      isAvailable() {
        return true;
      },
      costPerMillionCharacters: modelConfig.costPerMillionCharacters,
      settings: {
        voice: {
          description: "Voice ID to use for speech synthesis",
          defaultValue: undefined,
          type: "string",
        },
        ...(modelConfig.supportsLanguageCode && {
          language_code: {
            description: "Language code (ISO 639-1) for the voice",
            defaultValue: undefined,
            type: "string",
          },
        }),
        stability: {
          description: "Voice stability (0-1, lower = more variation)",
          defaultValue: 0.5,
          type: "number",
        },
        similarity_boost: {
          description: "Similarity boost (0-1, controls adherence to voice)",
          defaultValue: 0.75,
          type: "number",
        },
        style: {
          description: "Style amplification (0-1)",
          defaultValue: 0,
          type: "number",
        },
        use_speaker_boost: {
          description: "Boost similarity to original speaker",
          defaultValue: false,
          type: "boolean",
        },
      },
    } satisfies SpeechModelSpec));
  }

  private buildTranscriptionSpecs(): TranscriptionModelSpec[] {
    if (!this.elevenlabs) return [];
    const elevenlabs = this.elevenlabs;
    return Object.entries(this.config.models.transcription).map(([modelId, modelConfig]) => ({
      modelId,
      providerDisplayName: this.name,
      impl: elevenlabs.transcription(modelId),
      isAvailable() {
        return true;
      },
      costPerMinute: modelConfig.costPerMinute,
      settings: {
        languageCode: {
          description: "Language code (ISO 639-1 or ISO 639-3)",
          defaultValue: undefined,
          type: "string",
        },
        tagAudioEvents: {
          description: "Tag audio events like laughter and footsteps",
          defaultValue: true,
          type: "boolean",
        },
        numSpeakers: {
          description: "Maximum number of speakers (1-32)",
          defaultValue: undefined,
          type: "number",
        },
        timestampsGranularity: {
          description: "Timestamp granularity",
          defaultValue: "word",
          type: "enum",
          values: ["none", "word", "character"],
        },
        diarize: {
          description: "Annotate which speaker is talking",
          defaultValue: true,
          type: "boolean",
        },
        fileFormat: {
          description: "Input audio format",
          defaultValue: "other",
          type: "enum",
          values: ["pcm_s16le_16", "other"],
        },
      },
    } satisfies TranscriptionModelSpec));
  }

  private syncSpeechModels(specs: SpeechModelSpec[]): void {
    const newKeys = new Set<string>(specs.map(s => `${s.providerDisplayName}:${s.modelId}`.toLowerCase()));
    if (this.speechRegistry) {
      if (specs.length > 0) {
        this.speechRegistry.registerAllModelSpecs(specs);
      }
      for (const oldKey of this.registeredSpeechKeys) {
        if (!newKeys.has(oldKey)) {
          this.speechRegistry.modelSpecs.unregister(oldKey);
        }
      }
    }
    this.registeredSpeechKeys = newKeys;
  }

  private syncTranscriptionModels(specs: TranscriptionModelSpec[]): void {
    const newKeys = new Set<string>(specs.map(s => `${s.providerDisplayName}:${s.modelId}`.toLowerCase()));
    if (this.transcriptionRegistry) {
      if (specs.length > 0) {
        this.transcriptionRegistry.registerAllModelSpecs(specs);
      }
      for (const oldKey of this.registeredTranscriptionKeys) {
        if (!newKeys.has(oldKey)) {
          this.transcriptionRegistry.modelSpecs.unregister(oldKey);
        }
      }
    }
    this.registeredTranscriptionKeys = newKeys;
  }
}
