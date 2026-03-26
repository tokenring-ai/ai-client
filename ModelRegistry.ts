import {TokenRingService} from "@tokenring-ai/app/types";
import AIChatClient, {ChatModelSpec, normalizeChatModelSpec} from "./client/AIChatClient.ts";
import AIEmbeddingClient, {EmbeddingModelSpec, normalizeEmbeddingModelSpec} from "./client/AIEmbeddingClient.ts";
import AIImageGenerationClient, {ImageModelSpec, normalizeImageModelSpec} from "./client/AIImageGenerationClient.ts";
import AIRerankingClient, {normalizeRerankingModelSpec, RerankingModelSpec} from "./client/AIRerankingClient.ts";
import AISpeechClient, {normalizeSpeechModelSpec, SpeechModelSpec} from "./client/AISpeechClient.ts";
import AITranscriptionClient, {normalizeTranscriptionModelSpec, TranscriptionModelSpec} from "./client/AITranscriptionClient.ts";
import AIVideoGenerationClient, {normalizeVideoModelSpec, type VideoModelSpec} from "./client/AIVideoGenerationClient.ts";
import {ModelTypeRegistry} from "./ModelTypeRegistry.ts";
import {
  ChatModelRequirements,
  EmbeddingModelRequirements,
  ImageModelRequirements,
  RerankingModelRequirements,
  SpeechModelRequirements,
  TranscriptionModelRequirements,
  VideoModelRequirements
} from "./schema.ts";

export class ChatModelRegistry extends ModelTypeRegistry<ChatModelSpec, AIChatClient, ChatModelRequirements> implements TokenRingService {
  readonly name = "ChatModelRegistry";
  description = "Model registry for chat models";

  constructor() {
    super(AIChatClient);
  }

  override registerAllModelSpecs(modelSpecs: ChatModelSpec[]): void {
    super.registerAllModelSpecs(modelSpecs.map(normalizeChatModelSpec));
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
  readonly name = "EmbeddingModelRegistry";
  description = "Model registry for embedding models";

  constructor() {
    super(AIEmbeddingClient);
  }

  override registerAllModelSpecs(modelSpecs: EmbeddingModelSpec[]): void {
    super.registerAllModelSpecs(modelSpecs.map(normalizeEmbeddingModelSpec));
  }
}

export class ImageGenerationModelRegistry extends ModelTypeRegistry<ImageModelSpec, AIImageGenerationClient, ImageModelRequirements> implements TokenRingService {
  readonly name = "ImageGenerationModelRegistry";
  description = "Model registry for image generation models";

  constructor() {
    super(AIImageGenerationClient);
  }

  override registerAllModelSpecs(modelSpecs: ImageModelSpec[]): void {
    super.registerAllModelSpecs(modelSpecs.map(normalizeImageModelSpec));
  }
}

export class VideoGenerationModelRegistry extends ModelTypeRegistry<VideoModelSpec, AIVideoGenerationClient, VideoModelRequirements> implements TokenRingService {
  readonly name = "VideoGenerationModelRegistry";
  description = "Model registry for video generation models";

  constructor() {
    super(AIVideoGenerationClient);
  }

  override registerAllModelSpecs(modelSpecs: VideoModelSpec[]): void {
    super.registerAllModelSpecs(modelSpecs.map(normalizeVideoModelSpec));
  }
}

export class SpeechModelRegistry extends ModelTypeRegistry<SpeechModelSpec, AISpeechClient, SpeechModelRequirements> implements TokenRingService {
  readonly name = "SpeechModelRegistry";
  description = "Model registry for speech models";

  constructor() {
    super(AISpeechClient);
  }

  override registerAllModelSpecs(modelSpecs: SpeechModelSpec[]): void {
    super.registerAllModelSpecs(modelSpecs.map(normalizeSpeechModelSpec));
  }
}

export class TranscriptionModelRegistry extends ModelTypeRegistry<TranscriptionModelSpec, AITranscriptionClient, TranscriptionModelRequirements> implements TokenRingService {
  readonly name = "TranscriptionModelRegistry";
  description = "Model registry for transcription models";

  constructor() {
    super(AITranscriptionClient);
  }

  override registerAllModelSpecs(modelSpecs: TranscriptionModelSpec[]): void {
    super.registerAllModelSpecs(modelSpecs.map(normalizeTranscriptionModelSpec));
  }
}

export class RerankingModelRegistry extends ModelTypeRegistry<RerankingModelSpec, AIRerankingClient, RerankingModelRequirements> implements TokenRingService {
  readonly name = "RerankingModelRegistry";
  description = "Model registry for reranking models";

  constructor() {
    super(AIRerankingClient);
  }

  override registerAllModelSpecs(modelSpecs: RerankingModelSpec[]): void {
    super.registerAllModelSpecs(modelSpecs.map(normalizeRerankingModelSpec));
  }
}
