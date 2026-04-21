import { createElevenLabs } from "@ai-sdk/elevenlabs";
import type TokenRingApp from "@tokenring-ai/app";
import { z } from "zod";
import { SpeechModelRegistry, TranscriptionModelRegistry } from "../ModelRegistry.ts";
import modelConfigs from "../models/elevenlabs.yaml" with { type: "yaml" };
import type { AIModelProvider } from "../schema.ts";

const SpeechModelSchema = z.object({
  costPerMillionCharacters: z.number(),
  supportsLanguageCode: z.boolean(),
});

const TranscriptionModelSchema = z.object({
  costPerMinute: z.number(),
});

const ElevenLabsSchema = z.object({
  speech: z.record(z.string(), SpeechModelSchema),
  transcription: z.record(z.string(), TranscriptionModelSchema),
});

const parsedModelConfigs = ElevenLabsSchema.parse(modelConfigs.models.elevenlabs);

const ElevenLabsModelProviderConfigSchema = z.object({
  provider: z.literal("elevenlabs"),
  apiKey: z.string(),
});

function init(providerDisplayName: string, config: z.output<typeof ElevenLabsModelProviderConfigSchema>, app: TokenRingApp) {
  const { apiKey } = config;
  if (!apiKey) {
    throw new Error("No config.apiKey provided for ElevenLabs provider.");
  }

  const elevenlabs = createElevenLabs({ apiKey });

  app.waitForService(SpeechModelRegistry, speechModelRegistry => {
    speechModelRegistry.registerAllModelSpecs(
      Object.entries(parsedModelConfigs.speech).map(([modelId, config]) => ({
        modelId,
        providerDisplayName,
        impl: elevenlabs.speech(modelId),
        isAvailable() {
          return true;
        },
        costPerMillionCharacters: config.costPerMillionCharacters,
        settings: {
          voice: {
            description: "Voice ID to use for speech synthesis",
            defaultValue: undefined,
            type: "string",
          },
          ...(config.supportsLanguageCode && {
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
      })),
    );
  });

  app.waitForService(TranscriptionModelRegistry, transcriptionModelRegistry => {
    transcriptionModelRegistry.registerAllModelSpecs(
      Object.entries(parsedModelConfigs.transcription).map(([modelId, config]) => ({
        modelId,
        providerDisplayName,
        impl: elevenlabs.transcription(modelId),
        isAvailable() {
          return true;
        },
        costPerMinute: config.costPerMinute,
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
      })),
    );
  });
}

export default {
  providerCode: "elevenlabs",
  configSchema: ElevenLabsModelProviderConfigSchema,
  init,
} satisfies AIModelProvider<typeof ElevenLabsModelProviderConfigSchema>;
