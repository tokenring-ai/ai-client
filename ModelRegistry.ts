import {TokenRingService} from "@tokenring-ai/app/types";
import AIChatClient, {ChatModelSpec} from "./client/AIChatClient.js";
import AIEmbeddingClient, {EmbeddingModelSpec} from "./client/AIEmbeddingClient.js";
import AIImageGenerationClient, {ImageModelSpec} from "./client/AIImageGenerationClient.js";
import AIRerankingClient, {RerankingModelSpec} from "./client/AIRerankingClient.js";
import AISpeechClient, {SpeechModelSpec} from "./client/AISpeechClient.js";
import AITranscriptionClient, {TranscriptionModelSpec} from "./client/AITranscriptionClient.js";
import {ModelTypeRegistry} from "./ModelTypeRegistry.js";

export class ChatModelRegistry extends ModelTypeRegistry<ChatModelSpec, AIChatClient> implements TokenRingService {
  name = "ChatModelRegistry";
  description = "Model registry for chat models";

  constructor() {
    super(AIChatClient);
  }
}

export class EmbeddingModelRegistry extends ModelTypeRegistry<EmbeddingModelSpec, AIEmbeddingClient> implements TokenRingService {
  name = "EmbeddingModelRegistry";
  description = "Model registry for embedding models";

  constructor() {
    super(AIEmbeddingClient);
  }
}

export class ImageGenerationModelRegistry extends ModelTypeRegistry<ImageModelSpec, AIImageGenerationClient> implements TokenRingService {
  name = "ImageGenerationModelRegistry";
  description = "Model registry for image generation models";

  constructor() {
    super(AIImageGenerationClient);
  }
}

export class SpeechModelRegistry extends ModelTypeRegistry<SpeechModelSpec, AISpeechClient> implements TokenRingService {
  name = "SpeechModelRegistry";
  description = "Model registry for speech models";

  constructor() {
    super(AISpeechClient);
  }
}

export class TranscriptionModelRegistry extends ModelTypeRegistry<TranscriptionModelSpec, AITranscriptionClient> implements TokenRingService {
  name = "TranscriptionModelRegistry";
  description = "Model registry for transcription models";

  constructor() {
    super(AITranscriptionClient);
  }
}

export class RerankingModelRegistry extends ModelTypeRegistry<RerankingModelSpec, AIRerankingClient> implements TokenRingService {
  name = "RerankingModelRegistry";
  description = "Model registry for reranking models";

  constructor() {
    super(AIRerankingClient);
  }
}