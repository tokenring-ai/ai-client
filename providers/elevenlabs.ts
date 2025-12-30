import {createElevenLabs} from "@ai-sdk/elevenlabs";
import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";
import {SpeechModelRegistry, TranscriptionModelRegistry} from "../ModelRegistry.ts";
import {AIModelProvider} from "../schema.ts";

const ElevenLabsModelProviderConfigSchema = z.object({
  provider: z.literal('elevenlabs'),
  apiKey: z.string(),
});

async function init(
  providerDisplayName: string,
  config: z.output<typeof ElevenLabsModelProviderConfigSchema>,
  app: TokenRingApp,
) {
  let {apiKey} = config;
  if (!apiKey) {
    throw new Error("No config.apiKey provided for ElevenLabs provider.");
  }

  const elevenlabs = createElevenLabs({apiKey});

  app.waitForService(SpeechModelRegistry, speechModelRegistry => {
    speechModelRegistry.registerAllModelSpecs([
      {
        modelId: "eleven_v3",
        providerDisplayName: providerDisplayName,
        impl: elevenlabs.speech("eleven_v3"),
        async isAvailable() {
          return true;
        },
        costPerMillionCharacters: 100,
        features: {
          voice: {
            description: "Voice ID to use for speech synthesis",
            defaultValue: undefined,
            type: "string",
          },
          language_code: {
            description: "Language code (ISO 639-1) for the voice",
            defaultValue: undefined,
            type: "string",
          },
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
      },
      {
        modelId: "eleven_multilingual_v2",
        providerDisplayName: providerDisplayName,
        impl: elevenlabs.speech("eleven_multilingual_v2"),
        async isAvailable() {
          return true;
        },
        costPerMillionCharacters: 60,
        features: {
          voice: {
            description: "Voice ID to use for speech synthesis",
            defaultValue: undefined,
            type: "string",
          },
          language_code: {
            description: "Language code (ISO 639-1) for the voice",
            defaultValue: undefined,
            type: "string",
          },
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
      },
      {
        modelId: "eleven_flash_v2_5",
        providerDisplayName: providerDisplayName,
        impl: elevenlabs.speech("eleven_flash_v2_5"),
        async isAvailable() {
          return true;
        },
        costPerMillionCharacters: 30,
        features: {
          voice: {
            description: "Voice ID to use for speech synthesis",
            defaultValue: undefined,
            type: "string",
          },
          language_code: {
            description: "Language code (ISO 639-1) for the voice",
            defaultValue: undefined,
            type: "string",
          },
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
      },
      {
        modelId: "eleven_flash_v2",
        providerDisplayName: providerDisplayName,
        impl: elevenlabs.speech("eleven_flash_v2"),
        async isAvailable() {
          return true;
        },
        costPerMillionCharacters: 30,
        features: {
          voice: {
            description: "Voice ID to use for speech synthesis",
            defaultValue: undefined,
            type: "string",
          },
          language_code: {
            description: "Language code (ISO 639-1) for the voice",
            defaultValue: undefined,
            type: "string",
          },
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
      },
      {
        modelId: "eleven_turbo_v2_5",
        providerDisplayName: providerDisplayName,
        impl: elevenlabs.speech("eleven_turbo_v2_5"),
        async isAvailable() {
          return true;
        },
        costPerMillionCharacters: 45,
        features: {
          voice: {
            description: "Voice ID to use for speech synthesis",
            defaultValue: undefined,
            type: "string",
          },
          language_code: {
            description: "Language code (ISO 639-1) for the voice",
            defaultValue: undefined,
            type: "string",
          },
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
      },
      {
        modelId: "eleven_turbo_v2",
        providerDisplayName: providerDisplayName,
        impl: elevenlabs.speech("eleven_turbo_v2"),
        async isAvailable() {
          return true;
        },
        costPerMillionCharacters: 45,
        features: {
          voice: {
            description: "Voice ID to use for speech synthesis",
            defaultValue: undefined,
            type: "string",
          },
          language_code: {
            description: "Language code (ISO 639-1) for the voice",
            defaultValue: undefined,
            type: "string",
          },
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
      },
      {
        modelId: "eleven_monolingual_v1",
        providerDisplayName: providerDisplayName,
        impl: elevenlabs.speech("eleven_monolingual_v1"),
        async isAvailable() {
          return true;
        },
        costPerMillionCharacters: 50,
        features: {
          voice: {
            description: "Voice ID to use for speech synthesis",
            defaultValue: undefined,
            type: "string",
          },
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
        },
      },
      {
        modelId: "eleven_multilingual_v1",
        providerDisplayName: providerDisplayName,
        impl: elevenlabs.speech("eleven_multilingual_v1"),
        async isAvailable() {
          return true;
        },
        costPerMillionCharacters: 50,
        features: {
          voice: {
            description: "Voice ID to use for speech synthesis",
            defaultValue: undefined,
            type: "string",
          },
          language_code: {
            description: "Language code (ISO 639-1) for the voice",
            defaultValue: undefined,
            type: "string",
          },
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
        },
      },
    ]);
  });

  app.waitForService(TranscriptionModelRegistry, transcriptionModelRegistry => {
    transcriptionModelRegistry.registerAllModelSpecs([
      {
        modelId: "scribe_v1",
        providerDisplayName: providerDisplayName,
        impl: elevenlabs.transcription("scribe_v1"),
        async isAvailable() {
          return true;
        },
        costPerMinute: 0.034,
        features: {
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
      },
      {
        modelId: "scribe_v1_experimental",
        providerDisplayName: providerDisplayName,
        impl: elevenlabs.transcription("scribe_v1_experimental"),
        async isAvailable() {
          return true;
        },
        costPerMinute: 0.034,
        features: {
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
      },
    ]);
  });
}

export default {
  providerCode: 'elevenlabs',
  configSchema: ElevenLabsModelProviderConfigSchema,
  init
} satisfies AIModelProvider<typeof ElevenLabsModelProviderConfigSchema>;
