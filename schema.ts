export type ModelRequirements = {
  /**
   * The name of the provider and model, possibly including wildcards
   */
  nameLike?: string;
}

export type ChatModelRequirements = ModelRequirements & {
  /**
   * Maximum context length in tokens the model allows
   */
  contextLength?: number;
  /**
   * Maximum output tokens the model allows
   */
  maxCompletionTokens?: number;
  /**
   * Research ability (0-infinity)
   */
  research?: number;
  /**
   * Reasoning capability score (0-infinity)
   */
  reasoningText?: number;
  /**
   * Intelligence capability score (0-infinity)
   */
  intelligence?: number;
  /**
   * Speed capability score (0-infinity)
   */
  speed?: number;
  /**
   * Web search capability score (0-infinity)
   */
  webSearch?: number;
};

export type EmbeddingModelRequirements = ModelRequirements & {
  /**
   * Maximum context length in tokens the model allows
   */
  contextLength?: number;
}

export type ImageModelRequirements = ModelRequirements & {
  /**
   * Maximum context length in tokens the model allows
   */
  contextLength?: number;
}

export type RerankingModelRequirements = ModelRequirements;

export type SpeechModelRequirements = ModelRequirements;

export type TranscriptionModelRequirements = ModelRequirements;