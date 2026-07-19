import type TokenRingApp from "@tokenring-ai/app";
import type { MaybePromise } from "bun";
import { z } from "zod";
import allModels from "./providers/configs/index.ts";
import { AIProviderConfigSchema } from "./providers.ts";

export type { FilePart, ImagePart, TextPart, UserModelMessage } from "ai";

export type ModelRequirements = {
  /**
   * The name of the provider and model, possibly including wildcards
   */
  nameLike?: string | undefined;
};

export type ChatModelRequirements = ModelRequirements & {
  /**
   * Maximum context length in tokens the model allows
   */
  contextLength?: number;
  /**
   * Maximum output tokens the model allows
   */
  maxCompletionTokens?: number;
  tools?: boolean;
  structuredOutput?: boolean;
  /**
   * Web search support
   */
  webSearch?: boolean;
};

export type EmbeddingModelRequirements = ModelRequirements & {
  /**
   * Maximum context length in tokens the model allows
   */
  contextLength?: number;
};

export type ImageModelRequirements = ModelRequirements & {
  /**
   * Maximum context length in tokens the model allows
   */
  contextLength?: number;
};

export type VideoModelRequirements = ModelRequirements & {
  /**
   * Maximum context length in tokens the model allows
   */
  contextLength?: number;
};

export type RerankingModelRequirements = ModelRequirements;

export type SpeechModelRequirements = ModelRequirements;

export type TranscriptionModelRequirements = ModelRequirements;

export interface AIModelProvider<T> {
  providerCode: string;
  configSchema: T;

  autoConfigure?: () => MaybePromise<z.output<T> | null>;

  init(providerDisplayName: string, config: z.output<T>, app: TokenRingApp): MaybePromise<void>;
}

export const AIClientConfigSchema = z
  .object({
    /**
     * Whether to automatically configure AI providers based on environment variables.
     */
    autoConfigure: z.boolean().default(true).meta({ description: "Automatically enable AI providers whose API key environment variables are set" }),
    /**
     * Configuration for AI providers
     */
    providers: z
      .record(z.string(), AIProviderConfigSchema)
      .default(allModels)
      .meta({ description: "AI model providers and their model registries, keyed by display name" }),
  })
  .meta({ label: "AI Models", description: "AI model providers, credentials, and model registries" });

export const AIPackageConfigSchema = z.object({
  ai: AIClientConfigSchema.prefault({}),
});

export type ParsedAIPackageConfig = z.output<typeof AIPackageConfigSchema>;
