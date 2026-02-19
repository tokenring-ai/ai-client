import {rerank, type RerankingModel, type RerankResult} from "ai";
import type {ChatModelSettings, ModelSpec} from "../ModelTypeRegistry.js";

export type RerankingModelSpec = ModelSpec & {
  costPerMillionInputTokens?: number;
  impl: Exclude<RerankingModel, string>;
  mangleRequest?: (
    req: { query: string; documents: string[] },
    settings?: Record<string, any>,
  ) => void;
};

export default class AIRerankingClient {
  constructor(private readonly modelSpec: RerankingModelSpec, private settings: ChatModelSettings) {
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

  async rerank({
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
