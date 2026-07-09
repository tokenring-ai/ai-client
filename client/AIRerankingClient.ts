import deepClone from "@tokenring-ai/utility/object/deepClone";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import { type RerankingModel, type RerankResult, rerank } from "ai";
import { z } from "zod";
import type { ModelSettings } from "../ModelTypeRegistry.ts";
import { BaseModelSpecSchema, ProviderOptionsSchema } from "./modelCapabilities.ts";

export const RerankingRequestSchema = z.object({
  query: z.string(),
  documents: z.array(z.string()),
  topN: z.number().exactOptional(),
  providerOptions: ProviderOptionsSchema.prefault({}),
});

export type RerankingRequest = z.input<typeof RerankingRequestSchema>;
export type ParsedRerankingRequest = z.output<typeof RerankingRequestSchema>;

export const RerankingModelSpecSchema = BaseModelSpecSchema.extend({
  impl: z.custom<Exclude<RerankingModel, string>>(),
  mangleRequest: z.custom<(req: ParsedRerankingRequest, settings: ModelSettings) => void>().exactOptional(),

  costPerMillionInputTokens: z.number().exactOptional(),
});

export type RerankingModelSpec = z.input<typeof RerankingModelSpecSchema>;
export type ParsedRerankingModelSpec = z.output<typeof RerankingModelSpecSchema>;

export default class AIRerankingClient {
  constructor(
    private readonly modelSpec: RerankingModelSpec,
    private settings: ModelSettings,
  ) {}

  /**
   * Set settings for this client instance.
   */
  setSettings(settings: ModelSettings): void {
    this.settings = new Map(settings.entries());
  }

  /**
   * Get a copy of the settings.
   */
  getSettings(): ModelSettings {
    return new Map(this.settings.entries());
  }

  getModelId(): string {
    return this.modelSpec.impl.modelId;
  }

  rerank(request: RerankingRequest): Promise<RerankResult<string>> {
    const parsedRequest = RerankingRequestSchema.parse(request);
    parsedRequest.providerOptions = deepClone(this.modelSpec.providerOptions, parsedRequest.providerOptions);

    this.modelSpec.mangleRequest?.(parsedRequest, this.settings);

    return rerank(
      stripUndefinedKeys({
        model: this.modelSpec.impl,
        ...parsedRequest,
      }),
    );
  }
}
