import {TokenRingService} from "@tokenring-ai/app/types";
import AIChatClient, {ChatModelSpec} from "./client/AIChatClient.js";
import AIEmbeddingClient, {EmbeddingModelSpec} from "./client/AIEmbeddingClient.js";
import AIImageGenerationClient, {ImageModelSpec} from "./client/AIImageGenerationClient.js";
import AIRerankingClient, {RerankingModelSpec} from "./client/AIRerankingClient.js";
import AISpeechClient, {SpeechModelSpec} from "./client/AISpeechClient.js";
import AITranscriptionClient, {TranscriptionModelSpec} from "./client/AITranscriptionClient.js";
import {ModelTypeRegistry} from "./ModelTypeRegistry.js";
import {
  ChatModelRequirements,
  EmbeddingModelRequirements,
  ImageModelRequirements, RerankingModelRequirements,
  SpeechModelRequirements, TranscriptionModelRequirements
} from "./schema.ts";


export class ChatModelRegistry extends ModelTypeRegistry<ChatModelSpec, AIChatClient, ChatModelRequirements> implements TokenRingService {
  name = "ChatModelRegistry";
  description = "Model registry for chat models";

  constructor() {
    super(AIChatClient);
  }

  getCheapestModelByRequirements(requirements: string, estimatedContextLength = 10000): string | null {
    const eligibleModels = this.getModelSpecsByRequirements(requirements);

    // Sort the matched chatModels by price, using the current context length + 1000 tokens to calculate the price
    return Object.entries(eligibleModels)
      .sort(([,a], [,b]) => {
        const aPrice =
          estimatedContextLength * (a.costPerMillionInputTokens ?? 600) +
          1000 * (a.costPerMillionOutputTokens ?? 600);
        const bPrice =
          estimatedContextLength * (b.costPerMillionInputTokens ?? 600) +
          1000 * (b.costPerMillionOutputTokens ?? 600);

        return aPrice - bPrice;
      })[0]?.[0] ?? null;
  }
}

export class EmbeddingModelRegistry extends ModelTypeRegistry<EmbeddingModelSpec, AIEmbeddingClient, EmbeddingModelRequirements> implements TokenRingService {
  name = "EmbeddingModelRegistry";
  description = "Model registry for embedding models";

  constructor() {
    super(AIEmbeddingClient);
  }
}

export class ImageGenerationModelRegistry extends ModelTypeRegistry<ImageModelSpec, AIImageGenerationClient, ImageModelRequirements> implements TokenRingService {
  name = "ImageGenerationModelRegistry";
  description = "Model registry for image generation models";

  constructor() {
    super(AIImageGenerationClient);
  }
}

export class SpeechModelRegistry extends ModelTypeRegistry<SpeechModelSpec, AISpeechClient, SpeechModelRequirements> implements TokenRingService {
  name = "SpeechModelRegistry";
  description = "Model registry for speech models";

  constructor() {
    super(AISpeechClient);
  }
}

export class TranscriptionModelRegistry extends ModelTypeRegistry<TranscriptionModelSpec, AITranscriptionClient, TranscriptionModelRequirements> implements TokenRingService {
  name = "TranscriptionModelRegistry";
  description = "Model registry for transcription models";

  constructor() {
    super(AITranscriptionClient);
  }
}

export class RerankingModelRegistry extends ModelTypeRegistry<RerankingModelSpec, AIRerankingClient, RerankingModelRequirements> implements TokenRingService {
  name = "RerankingModelRegistry";
  description = "Model registry for reranking models";

  constructor() {
    super(AIRerankingClient);
  }
}