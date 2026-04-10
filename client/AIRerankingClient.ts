import {rerank, type RerankingModel, type RerankResult} from "ai";
import {z} from "zod";
import type {ChatModelSettings, ModelSpec} from "../ModelTypeRegistry.ts";
import {createModelSpecSchema, type ModelInputCapabilities, ModelInputCapabilitiesSchema,} from "./modelCapabilities.ts";

export type RerankingModelSpec = ModelSpec & {
  costPerMillionInputTokens?: number;
  impl: Exclude<RerankingModel, string>;
  inputCapabilities?: Partial<ModelInputCapabilities>;
  mangleRequest?: (
    req: { query: string; documents: string[] },
    settings?: Record<string, any>,
  ) => void;
};

export const RerankingModelSpecSchema = createModelSpecSchema(
  ModelInputCapabilitiesSchema,
).extend({
  costPerMillionInputTokens: z.number().optional(),
});

export function normalizeRerankingModelSpec(
  modelSpec: RerankingModelSpec,
): RerankingModelSpec {
  return RerankingModelSpecSchema.parse({
    ...modelSpec,
    inputCapabilities: modelSpec.inputCapabilities ?? {},
  }) as RerankingModelSpec;
}

export default class AIRerankingClient {
  constructor(
    private readonly modelSpec: RerankingModelSpec,
    private settings: ChatModelSettings,
  ) {
  }

  /**
   * Set settings for this client instance.
   */
  setSettings(settings: ChatModelSettings): void {
    this.settings = new Map(settings.entries());
  }

  /**
   * Get a copy of the settings.
   */
  getSettings(): ChatModelSettings {
    return new Map(this.settings.entries());
  }

  getModelId(): string {
    return this.modelSpec.impl.modelId;
  }

  rerank({
           query,
           documents,
           topN,
         }: {
    query: string;
    documents: string[];
    topN?: number;
  }): Promise<RerankResult<string>> {
    if (this.modelSpec.mangleRequest) {
      const req = {query, documents};
      this.modelSpec.mangleRequest(req, this.settings);
      query = req.query;
      documents = req.documents;
    }

    return rerank({
      model: this.modelSpec.impl,
      query,
      documents,
      topN,
    });
  }
}
