# @tokenring-ai/ai-client Package

## Overview

The `@tokenring-ai/ai-client` package provides a unified interface for interacting with multiple AI providers through the Vercel AI SDK. It integrates with the Token Ring Agent framework to manage AI configurations, model selection, chat history, and request building.

**Key Features:**

- **Multi-Provider Support**: OpenAI, Anthropic, Google, Groq, DeepSeek, Cerebras, xAI, Perplexity, Azure, Ollama, OpenRouter, Fal, ElevenLabs, Llama, and OpenAI-compatible endpoints
- **Model Registry**: Automatic model selection based on cost, capabilities (reasoning, intelligence, speed, tools), and availability
- **Chat Management**: Conversation history, streaming responses, cost/timing analytics
- **Multiple Modalities**: Chat completions, embeddings, image generation, speech synthesis, and audio transcription
- **Reranking**: Document ranking and relevance scoring using AI models
- **Feature Management**: Dynamic feature selection and configuration per model

## Installation

Part of the Token Ring monorepo. Install dependencies and build:

```bash
bun install
bun run build
```

## Configuration

Configure providers in your `.tokenring/coder-config.mjs`:

```javascript
export default {
  ai: {
    autoConfigure: true, // Set to true to auto-configure from environment variables
    providers: {
      "OpenAI": {
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY
      },
      "Anthropic": {
        provider: "anthropic",
        apiKey: process.env.ANTHROPIC_API_KEY
      },
      "Google": {
        provider: "google",
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY
      },
      "xAI": {
        provider: "xai",
        apiKey: process.env.XAI_API_KEY
      },
      "Perplexity": {
        provider: "perplexity",
        apiKey: process.env.PERPLEXITY_API_KEY
      },
      "Groq": {
        provider: "groq",
        apiKey: process.env.GROQ_API_KEY
      },
      "DeepSeek": {
        provider: "deepseek",
        apiKey: process.env.DEEPSEEK_API_KEY
      },
      "Cerebras": {
        provider: "cerebras",
        apiKey: process.env.CEREBRAS_API_KEY
      },
      "Azure": {
        provider: "azure",
        apiKey: process.env.AZURE_API_KEY,
        baseURL: process.env.AZURE_API_ENDPOINT
      },
      "Ollama": {
        provider: "ollama",
        baseURL: process.env.LLAMA_BASE_URL ?? "http://127.0.0.1:11434"
      },
      "OpenRouter": {
        provider: "openrouter",
        apiKey: process.env.OPENROUTER_API_KEY
      },
      "Llama": {
        provider: "llama",
        apiKey: process.env.META_LLAMA_API_KEY
      },
      "OpenAI-Compatible": {
        provider: "openaiCompatible",
        baseURL: "https://api.example.com/v1",
        apiKey: process.env.API_KEY
      },
      "Fal": {
        provider: "fal",
        apiKey: process.env.FAL_API_KEY
      },
      "ElevenLabs": {
        provider: "elevenlabs",
        apiKey: process.env.ELEVENLABS_API_KEY
      }
    }
  }
};
```

### Auto-Configuration

Set `autoConfigure: true` to automatically detect providers from environment variables:

| Environment Variable | Provider |
|----------------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic |
| `AZURE_API_KEY` + `AZURE_API_ENDPOINT` | Azure |
| `CEREBRAS_API_KEY` | Cerebras |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google |
| `GROQ_API_KEY` | Groq |
| `META_LLAMA_API_KEY` | Llama |
| `OPENAI_API_KEY` | OpenAI |
| `LLAMA_BASE_URL` / `LLAMA_API_KEY` | Ollama |
| `OPENROUTER_API_KEY` | OpenRouter |
| `PERPLEXITY_API_KEY` | Perplexity |
| `XAI_API_KEY` | xAI |
| `DASHSCOPE_API_KEY` | Qwen (OpenAI-compatible) |
| `ZAI_API_KEY` | zAI (OpenAI-compatible) |

## Package Structure

```
pkg/ai-client/
├── client/
│   ├── AIChatClient.ts           # Chat completion client with streaming support
│   ├── AIEmbeddingClient.ts      # Text embedding client
│   ├── AIImageGenerationClient.ts # Image generation client
│   ├── AISpeechClient.ts         # Text-to-speech client
│   ├── AITranscriptionClient.ts  # Audio transcription client
│   └── AIRerankingClient.ts      # Document reranking client
├── providers/
│   ├── anthropic.ts              # Anthropic provider
│   ├── azure.ts                  # Azure provider
│   ├── cerebras.ts               # Cerebras provider
│   ├── deepseek.ts               # DeepSeek provider
│   ├── elevenlabs.ts             # ElevenLabs provider (speech & transcription)
│   ├── fal.ts                    # Fal provider (image generation)
│   ├── google.ts                 # Google provider
│   ├── groq.ts                   # Groq provider
│   ├── llama.ts                  # Llama provider
│   ├── ollama.ts                 # Ollama provider (local models)
│   ├── openai.ts                 # OpenAI provider
│   ├── openaiCompatible.ts       # OpenAI-compatible provider
│   ├── openrouter.ts             # OpenRouter provider
│   ├── perplexity.ts             # Perplexity provider
│   ├── xai.ts                    # xAI provider
├── util/
│   ├── cachedDataRetriever.ts    # Data caching utilities
│   └── resequenceMessages.ts     # Message resequencing utilities
├── ModelRegistry.ts              # Model registries for each modality
├── ModelTypeRegistry.ts          # Generic model registry with features
├── providers.ts                  # Provider registration and config schema
├── schema.ts                     # AI model provider interface and schemas
├── autoConfig.ts                 # Auto-configuration from environment
├── plugin.ts                     # Plugin entry point
└── index.ts                      # Package exports
```

## Core Components

### ModelTypeRegistry

Generic registry for managing different types of AI models with features and capabilities.

```typescript
export type FeatureSpec = {
  description: string;
} & ({
  type: "boolean";
  defaultValue?: boolean;
} | {
  type: "number";
  defaultValue?: number;
  min?: number;
  max?: number;
} | {
  type: "string";
  defaultValue?: string;
} | {
  type: "enum";
  defaultValue?: PrimitiveType;
  values: PrimitiveType[];
} | {
  type: "array";
  defaultValue?: PrimitiveType[];
});

export type FeatureOptions = Record<string, PrimitiveType | PrimitiveType[]>;

export type ModelSpec = {
  modelId: string;
  providerDisplayName: string;
  isAvailable?: () => Promise<boolean>;
  isHot?: () => Promise<boolean>;
  features?: Record<string, FeatureSpec>;
};
```

### Model Registries

Specialized registries for different AI modalities:

| Registry | Description |
|----------|-------------|
| `ChatModelRegistry` | Chat models with conversation capabilities |
| `EmbeddingModelRegistry` | Text embedding models |
| `ImageGenerationModelRegistry` | Image generation models |
| `SpeechModelRegistry` | Text-to-speech models |
| `TranscriptionModelRegistry` | Audio transcription models |
| `RerankingModelRegistry` | Document reranking models |

### AIChatClient

Handles chat completions with streaming support and model features.

**Key Methods:**

- `streamChat(request, agent)` - Stream chat response
- `textChat(request, agent)` - Non-streaming chat
- `generateObject(request, agent)` - Structured output with Zod schema
- `rerank(request, agent)` - Document ranking and relevance scoring
- `calculateCost(usage)` - Calculate USD cost
- `calculateTiming(elapsedMs, usage)` - Calculate throughput
- `setFeatures(features)` - Set model features
- `getFeatures()` - Get current features
- `getModelId()` - Get model ID

**Response:**

```typescript
type AIResponse = {
  providerMetadata: any;
  finishReason: "stop" | "length" | "content-filter" | "tool-calls" | "error" | "other" | "unknown";
  timestamp: number;
  modelId: string;
  messages?: ChatInputMessage[];
  text?: string;
  lastStepUsage: LanguageModelV2Usage;
  totalUsage: LanguageModelV2Usage;
  cost: AIResponseCost;
  timing: AIResponseTiming;
  sources?: LanguageModelV3Source[];
  warnings?: SharedV3Warning[];
};

type AIResponseCost = {
  input?: number;
  cachedInput?: number;
  output?: number;
  reasoning?: number;
  total?: number;
};

type AIResponseTiming = {
  elapsedMs: number;
  tokensPerSec?: number;
  totalTokens?: number;
};
```

### AIEmbeddingClient

Generate embeddings for text.

**Methods:**

- `getEmbeddings({ input: string[] })` - Generate embeddings for multiple inputs

### AIImageGenerationClient

Generate images from prompts.

**Methods:**

- `generateImage(request, agent)` - Generate image

**Request:**

```typescript
type ImageRequest = {
  prompt: string;
  quality?: string;
  size: `${number}x${number}`;
  n: number;
};
```

### AISpeechClient

Generate speech from text.

**Methods:**

- `generateSpeech(request, agent)` - Generate speech audio

**Request:**

```typescript
type SpeechRequest = {
  text: string;
  voice?: string;
  speed?: number;
};
```

### AITranscriptionClient

Transcribe audio to text.

**Methods:**

- `transcribe(request, agent)` - Transcribe audio

**Request:**

```typescript
type TranscriptionRequest = {
  audio: DataContent | URL;
  language?: string;
  prompt?: string;
};
```

### AIRerankingClient

Rank documents by relevance to a query.

**Methods:**

- `rerank({ query, documents, topN })` - Rank documents by relevance

## Usage

### Running a Chat

```typescript
import runChat from '@tokenring-ai/ai-client/runChat';

const [output, response] = await runChat(
  {
    input: 'Explain quantum computing',
    includeTools: true,
    includePriorMessages: true,
    includeContextItems: true
  },
  agent
);

console.log(output);
console.log(`Cost: $${response.cost.total.toFixed(4)}`);
console.log(`Time: ${(response.timing.elapsedMs / 1000).toFixed(2)}s`);
```

### Creating Chat Requests

```typescript
import { createChatRequest } from '@tokenring-ai/ai-client/chatRequestBuilder/createChatRequest';

const request = await createChatRequest(
  {
    input: 'Hello, world!',
    systemPrompt: 'You are a helpful assistant',
    includeTools: true,
    includePriorMessages: true,
    includeContextItems: true,
    maxSteps: 15,
    temperature: 0.7
  },
  agent
);

const client = await modelRegistry.chat.getClient('openai:gpt-5');
const [text, response] = await client.streamChat(request, agent);
```

### Selecting Models by Capability

```typescript
// Get cheapest model with high reasoning
const client = await modelRegistry.chat.getClientByRequirements({
  reasoningText: '>4',
  contextLength: '>100000'
});

// Get fastest model
const fastClient = await modelRegistry.chat.getClientByRequirements({
  speed: '>5'
});

// Get cheapest model
const cheapest = await modelRegistry.chat.getCheapestModelByRequirements({
  reasoningText: '>3',
  contextLength: '>100000'
});
```

### Generating Embeddings

```typescript
const embeddingClient = await modelRegistry.embedding.getClient('openai:text-embedding-3-small');
const results = await embeddingClient.getEmbeddings({
  input: ['Hello', 'World']
});
console.log(results[0].embedding); // Vector array
```

### Generating Images

```typescript
const imageClient = await modelRegistry.imageGeneration.getClient('openai:gpt-image-1-high');
const [image, result] = await imageClient.generateImage(
  {
    prompt: 'A serene mountain landscape',
    size: '1024x1024',
    n: 1
  },
  agent
);
```

### Generating Speech

```typescript
const speechClient = await modelRegistry.speech.getClient('openai:tts-1-hd');
const [audioData, result] = await speechClient.generateSpeech(
  {
    text: 'Hello, world!',
    voice: 'alloy',
    speed: 1.0
  },
  agent
);
```

### Transcribing Audio

```typescript
const transcriptionClient = await modelRegistry.transcription.getClient('openai:whisper-1');
const audioBuffer = fs.readFileSync('audio.mp3');
const [text, result] = await transcriptionClient.transcribe(
  {
    audio: audioBuffer,
    language: 'en'
  },
  agent
);
```

### Reranking Documents

```typescript
const client = await modelRegistry.chat.getClient('openai:gpt-5');
const rankings = await client.rerank(
  {
    query: 'What is artificial intelligence?',
    documents: [
      'Artificial intelligence is the simulation of human intelligence in machines.',
      'Machine learning is a subset of artificial intelligence.',
      'Deep learning is a type of machine learning.'
    ],
    topK: 2
  },
  agent
);

console.log('Ranked documents:', rankings.rankings);
```

## Supported Providers

| Provider | Chat | Embeddings | Images | Speech | Transcription | Reranking | Notes |
|----------|------|------------|--------|--------|---------------|-----------|-------|
| OpenAI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | GPT-4.1, GPT-5, O3, O4-mini, TTS, Whisper |
| Anthropic | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Claude 4.5, 4.1 |
| Google | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Gemini 2.5 Pro/Flash, Imagen |
| xAI | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Grok 3, 4, 4.1 |
| DeepSeek | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | DeepSeek Chat, Reasoner |
| Groq | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Fast inference, Llama models |
| Cerebras | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Ultra-fast inference |
| Perplexity | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Sonar models with web search |
| Azure | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Azure OpenAI Service |
| Ollama | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | Local models |
| OpenRouter | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Access to many providers |
| Fal | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | Image generation |
| OpenAI-Compatible | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | Custom endpoints |
| Llama | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Meta Llama models |
| ElevenLabs | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | TTS and transcription |

## Model Features

Models can have various features that can be enabled/disabled:

### OpenAI Models

| Feature | Description | Default |
|---------|-------------|---------|
| `websearch` | Enables web search capability | false |
| `reasoningEffort` | Reasoning effort level | "medium" |
| `reasoningSummary` | Reasoning summary mode | undefined |
| `serviceTier` | Service tier (auto, flex, priority, default) | "auto" |
| `textVerbosity` | Text verbosity (low, medium, high) | "medium" |
| `strictJsonSchema` | Use strict JSON schema validation | false |
| `promptCacheRetention` | Prompt cache retention policy | "in_memory" |

### Anthropic Models

| Feature | Description | Default |
|---------|-------------|---------|
| `maxSearchUses` | Maximum web searches (0-20) | 0 |

### Google Models

| Feature | Description | Default |
|---------|-------------|---------|
| `websearch` | Enables web search | false |
| `responseModalities` | Response modalities | ["TEXT"] |
| `thinkingBudget` | Thinking token budget | undefined |
| `thinkingLevel` | Thinking depth (Gemini 3) | undefined |
| `includeThoughts` | Include thought summaries | false |

### xAI Models

| Feature | Description | Default |
|---------|-------------|---------|
| `websearch` | Enables web search | false |
| `maxSearchResults` | Max search results | 20 |
| `returnCitations` | Return citations | false |

### Perplexity Models

| Feature | Description | Default |
|---------|-------------|---------|
| `websearch` | Enables web search | true |
| `searchContextSize` | Search context size (low, medium, high) | "low" |

### OpenRouter Models

| Feature | Description | Default |
|---------|-------------|---------|
| `websearch` | Enables web search plugin | false |
| `searchEngine` | Search engine (native, exa) | undefined |
| `maxResults` | Max search results | 5 |
| `searchContextSize` | Search context size | "low" |
| `temperature` | Temperature (0-2.0) | undefined |
| `topP` | Top P sampling (0-1.0) | undefined |
| `topK` | Top K sampling | undefined |
| `maxTokens` | Max tokens | undefined |
| `frequencyPenalty` | Frequency penalty (-2.0 to 2.0) | undefined |
| `presencePenalty` | Presence penalty (-2.0 to 2.0) | undefined |
| `repetitionPenalty` | Repetition penalty (0-2.0) | undefined |
| `minP` | Min P sampling (0-1.0) | undefined |
| `includeReasoning` | Include reasoning | undefined |

### ElevenLabs Speech Models

| Feature | Description | Default |
|---------|-------------|---------|
| `voice` | Voice ID | undefined |
| `language_code` | Language code (ISO 639-1) | undefined |
| `stability` | Voice stability (0-1) | 0.5 |
| `similarity_boost` | Similarity boost (0-1) | 0.75 |
| `style` | Style amplification (0-1) | 0 |
| `use_speaker_boost` | Boost similarity to speaker | false |

**Example:**

```typescript
// Select model with web search enabled
const client = await modelRegistry.chat.getClient('openai:gpt-5?websearch=1');

// Set features on a client
client.setFeatures({
  websearch: true,
  reasoningEffort: 'high',
  serviceTier: 'priority'
});
```

## Cost Tracking

All responses include detailed cost information:

```typescript
const [output, response] = await runChat({ input: 'Hello' }, agent);

console.log(`Input: $${response.cost.input.toFixed(4)}`);
console.log(`Cached: $${response.cost.cachedInput?.toFixed(4) || 0}`);
console.log(`Output: $${response.cost.output.toFixed(4)}`);
console.log(`Reasoning: $${response.cost.reasoning?.toFixed(4) || 0}`);
console.log(`Total: $${response.cost.total.toFixed(4)}`);
```

## Testing

```bash
vitest run                # Run tests
bun run test:watch        # Watch mode
bun run test:coverage     # Coverage report
```

## License

MIT License - see [LICENSE](./LICENSE) file for details.
