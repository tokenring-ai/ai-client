import {rerank, type RerankingModel, type RerankResult} from "ai";
import type {FeatureOptions, ModelSpec} from "../ModelTypeRegistry.js";

export type RerankingModelSpec = ModelSpec & {
  costPerMillionInputTokens?: number;
  impl: Exclude<RerankingModel, string>;
  mangleRequest?: (
    req: { query: string; documents: string[] },
    features?: Record<string, any>,
  ) => void;
};

export default class AIRerankingClient {
  public readonly modelSpec: RerankingModelSpec;
  private features: FeatureOptions = {};

  constructor(modelSpec: RerankingModelSpec, features: typeof this.features = {}) {
    this.modelSpec = modelSpec;
    this.features = features;
  }

  setFeatures(features: FeatureOptions | undefined): void {
    this.features = {...(features ?? {})};
  }

  getFeatures(): Record<string, any> {
    return {...this.features};
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
      this.modelSpec.mangleRequest(req, this.features);
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