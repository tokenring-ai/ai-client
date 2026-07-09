import type { TokenRingService } from "@tokenring-ai/app/types";
import AIChatClient, { type ChatModelSpec, ChatModelSpecSchema } from "./client/AIChatClient.ts";
import AIEmbeddingClient, { type EmbeddingModelSpec, EmbeddingModelSpecSchema } from "./client/AIEmbeddingClient.ts";
import AIImageGenerationClient, { type ImageModelSpec, ImageModelSpecSchema } from "./client/AIImageGenerationClient.ts";
import AIRerankingClient, { type RerankingModelSpec, RerankingModelSpecSchema } from "./client/AIRerankingClient.ts";
import AISpeechClient, { type SpeechModelSpec, SpeechModelSpecSchema } from "./client/AISpeechClient.ts";
import AITranscriptionClient, { type TranscriptionModelSpec, TranscriptionModelSpecSchema } from "./client/AITranscriptionClient.ts";
import AIVideoGenerationClient, { type VideoModelSpec, VideoModelSpecSchema } from "./client/AIVideoGenerationClient.ts";
import { ModelTypeRegistry } from "./ModelTypeRegistry.ts";

export class ChatModelRegistry extends ModelTypeRegistry<ChatModelSpec, AIChatClient> implements TokenRingService {
  readonly name = "ChatModelRegistry";
  description = "Model registry for chat models";

  constructor() {
    super(AIChatClient);
  }

  override registerAllModelSpecs(modelSpecs: ChatModelSpec[]): void {
    super.registerAllModelSpecs(modelSpecs.map(spec => ChatModelSpecSchema.parse(spec)));
  }

  getCheapestModelByRequirements(requirements: string, estimatedContextLength = 10000): string | null {
    const eligibleModels = this.getModelSpecsByRequirements(requirements);

    // Sort the matched chatModels by price, using the current context length + 1000 tokens to calculate the price
    return (
      Object.entries(eligibleModels).sort(([, a], [, b]) => {
        const aPrice = estimatedContextLength * a.costPerMillionInputTokens + 1000 * a.costPerMillionOutputTokens;
        const bPrice = estimatedContextLength * b.costPerMillionInputTokens + 1000 * b.costPerMillionOutputTokens;

        return aPrice - bPrice;
      })[0]?.[0] ?? null
    );
  }
}

export class EmbeddingModelRegistry extends ModelTypeRegistry<EmbeddingModelSpec, AIEmbeddingClient> implements TokenRingService {
  readonly name = "EmbeddingModelRegistry";
  description = "Model registry for embedding models";

  constructor() {
    super(AIEmbeddingClient);
  }

  override registerAllModelSpecs(modelSpecs: EmbeddingModelSpec[]): void {
    super.registerAllModelSpecs(modelSpecs.map(spec => EmbeddingModelSpecSchema.parse(spec)));
  }
}

export class ImageGenerationModelRegistry extends ModelTypeRegistry<ImageModelSpec, AIImageGenerationClient> implements TokenRingService {
  readonly name = "ImageGenerationModelRegistry";
  description = "Model registry for image generation models";

  constructor() {
    super(AIImageGenerationClient);
  }

  override registerAllModelSpecs(modelSpecs: ImageModelSpec[]): void {
    super.registerAllModelSpecs(modelSpecs.map(spec => ImageModelSpecSchema.parse(spec)));
  }
}

export class VideoGenerationModelRegistry extends ModelTypeRegistry<VideoModelSpec, AIVideoGenerationClient> implements TokenRingService {
  readonly name = "VideoGenerationModelRegistry";
  description = "Model registry for video generation models";

  constructor() {
    super(AIVideoGenerationClient);
  }

  override registerAllModelSpecs(modelSpecs: VideoModelSpec[]): void {
    super.registerAllModelSpecs(modelSpecs.map(spec => VideoModelSpecSchema.parse(spec)));
  }
}

export class SpeechModelRegistry extends ModelTypeRegistry<SpeechModelSpec, AISpeechClient> implements TokenRingService {
  readonly name = "SpeechModelRegistry";
  description = "Model registry for speech models";

  constructor() {
    super(AISpeechClient);
  }

  override registerAllModelSpecs(modelSpecs: SpeechModelSpec[]): void {
    super.registerAllModelSpecs(modelSpecs.map(spec => SpeechModelSpecSchema.parse(spec)));
  }
}

export class TranscriptionModelRegistry extends ModelTypeRegistry<TranscriptionModelSpec, AITranscriptionClient> implements TokenRingService {
  readonly name = "TranscriptionModelRegistry";
  description = "Model registry for transcription models";

  constructor() {
    super(AITranscriptionClient);
  }

  override registerAllModelSpecs(modelSpecs: TranscriptionModelSpec[]): void {
    super.registerAllModelSpecs(modelSpecs.map(spec => TranscriptionModelSpecSchema.parse(spec)));
  }
}

export class RerankingModelRegistry extends ModelTypeRegistry<RerankingModelSpec, AIRerankingClient> implements TokenRingService {
  readonly name = "RerankingModelRegistry";
  description = "Model registry for reranking models";

  constructor() {
    super(AIRerankingClient);
  }

  override registerAllModelSpecs(modelSpecs: RerankingModelSpec[]): void {
    super.registerAllModelSpecs(modelSpecs.map(spec => RerankingModelSpecSchema.parse(spec)));
  }
}
