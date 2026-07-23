import { z } from "zod";
import allModels from "./providers/configs/index.ts";
import { AIProviderConfigSchema } from "./providers.ts";

export type { FilePart, ImagePart, TextPart, UserModelMessage } from "ai";

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
