# @tokenring-ai/ai-client Package

## Overview

The `@tokenring-ai/ai-client` package provides a unified interface for interacting with multiple AI providers through the Vercel AI SDK. It integrates with the Token Ring Agent framework to manage AI configurations, model selection, chat history, and request building.

**Key Features:**

- **Multi-Provider Support**: OpenAI, Anthropic, Google, Groq, DeepSeek, Cerebras, xAI, Perplexity, Azure, Ollama, OpenRouter, Fal, and OpenAI-compatible endpoints
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
    defaultModel: "gpt-4.1",
    models: {
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
        apiKey: process.env.GOOGLE_API_KEY
      },
      "Ollama": {
        provider: "ollama",
        baseURL: "http://localhost:11434",
        generateModelSpec: (modelInfo) => ({
          type: modelInfo.model.match(/embed/i) ? "embedding" : "chat",
          capabilities: {
            contextLength: 128000,
            costPerMillionInputTokens: 0,
            costPerMillionOutputTokens: 0,
            reasoningText: 3,
            intelligence: 3,
            speed: 4
          }
        })
      }
    }
  }
};
```

## Package Structure

```
pkg/ai-client/
├── client/
│   ├── AIChatClient.ts        # Chat completion client with streaming support
│   ├── AIEmbeddingClient.ts   # Text embedding client
│   ├── AIImageGenerationClient.ts # Image generation client
│   ├── AISpeechClient.ts      # Text-to-speech client
│   └── AITranscriptionClient.ts # Audio transcription client
├── providers/
│   ├── anthropic.ts          # Anthropic provider
│   ├── azure.ts              # Azure provider
│   ├── cerebras.ts           # Cerebras provider
│   ├── deepseek.ts           # DeepSeek provider
│   ├── fal.ts                # Fal provider
│   ├── google.ts             # Google provider
│   ├── groq.ts               # Groq provider
│   ├── llama.ts              # Llama provider
│   ├── ollama.ts             # Ollama provider
│   ├── openai.ts             # OpenAI provider
│   ├── openaiCompatible.ts   # OpenAI-compatible provider
│   ├── openrouter.ts         # OpenRouter provider
│   ├── perplexity.ts         # Perplexity provider
│   ├── xai.ts                # xAI provider
│   └── elevenlabs.ts         # ElevenLabs provider
├── util/
│   ├── cachedDataRetriever.ts # Data caching utilities
│   └── resequenceMessages.ts # Message resequencing utilities
├── ModelRegistry.ts          # Model registry for chat models
├── ModelTypeRegistry.ts      # Generic model registry
├── providers.ts              # Provider registration
└── index.ts                  # Package exports
```

## Core Components

### ModelTypeRegistry

Generic registry for managing different types of AI models with features and capabilities.

```typescript
export type ModelSpec = {
  modelId: string;
  providerDisplayName: string;
  isAvailable?: () => Promise<boolean>;
  isHot?: () => Promise<boolean>;
  features?: Record<string, FeatureSpec>;
};

export type FeatureOptions = Record<string, PrimitiveType | PrimitiveType[]>;
```

### Model Registries

Specialized registries for different AI modalities:

- **ChatModelRegistry**: Chat models with conversation capabilities
- **EmbeddingModelRegistry**: Text embedding models
- **ImageGenerationModelRegistry**: Image generation models
- **SpeechModelRegistry**: Text-to-speech models
- **TranscriptionModelRegistry**: Audio transcription models
- **RerankingModelRegistry**: Document reranking models

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

**Response:**

```typescript
{
  text?: string,
  messages?: ChatInputMessage[],
  usage: {
    inputTokens: number,
    outputTokens: number,
    cachedInputTokens?: number,
    reasoningTokens?: number,
    totalTokens: number
  },
  cost: {
    input?: number,
    cachedInput?: number,
    output?: number,
    reasoning?: number,
    total?: number
  },
  timing: {
    elapsedMs: number,
    tokensPerSec?: number,
    totalTokens?: number
  },
  finishReason: string,
  warnings?: LanguageModelV2CallWarning[]
}
```

### AIEmbeddingClient

Generate embeddings for text.

**Methods:**

- `getEmbeddings({ input: string[] })` - Generate embeddings

### AIImageGenerationClient

Generate images from prompts.

**Methods:**

- `generateImage(request, agent)` - Generate image

**Request:**

```typescript
{
  prompt: string,
  quality?: 'low' | 'medium' | 'high',
  size: `${number}x${number}`,
  n: number
}
```

**Response:**

```typescript
{
  mediaType: string,
  uint8Array: Uint8Array
}
```

### AISpeechClient

Generate speech from text.

**Methods:**

- `generateSpeech(request, agent)` - Generate speech audio

**Request:**

```typescript
{
  text: string,
  voice?: string,
  speed?: number
}
```

**Response:**

```typescript
{
  audio: Uint8Array
}
```

### AITranscriptionClient

Transcribe audio to text.

**Methods:**

- `transcribe(request, agent)` - Transcribe audio

**Request:**

```typescript
{
  audio: DataContent | URL,
  language?: string,
  prompt?: string
}
```

**Response:**

```typescript
{
  text: string
}
```

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

const client = await modelRegistry.chat.getFirstOnlineClient('gpt-4.1');
const [text, response] = await client.streamChat(request, agent);
```

### Selecting Models by Capability

```typescript
// Get cheapest model with high reasoning
const client = await modelRegistry.chat.getFirstOnlineClientByRequirements({
  reasoningText: '>4',
  contextLength: '>100000'
});

// Get fastest model
const fastClient = await modelRegistry.chat.getFirstOnlineClientByRequirements({
  speed: '>5'
});
```

### Generating Embeddings

```typescript
const embeddingClient = await modelRegistry.embedding.getFirstOnlineClient('text-embedding-3-small');
const results = await embeddingClient.getEmbeddings({
  input: ['Hello', 'World']
});
console.log(results[0].embedding); // Vector array
```

### Generating Images

```typescript
const imageClient = await modelRegistry.imageGeneration.getFirstOnlineClient('gpt-image-1-high');
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
const speechClient = await modelRegistry.speech.getFirstOnlineClient('tts-1-hd');
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
const transcriptionClient = await modelRegistry.transcription.getFirstOnlineClient('whisper-1');
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
const client = await modelRegistry.chat.getFirstOnlineClient('gpt-4.1');
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

## Commands

The package provides chat commands for interactive use:

### `/chat [message]`

Send a message to the AI using the current model and configuration.

```
/chat Explain how async/await works in JavaScript
```

### `/model [model_name]`

Set or show the current model. Without arguments, shows an interactive tree selection.

```
/model gpt-4.1
/model                    # Interactive selection
```

### `/ai settings key=value [...]`

Update AI configuration settings.

```
/ai settings temperature=0.7 maxTokens=4000
/ai settings autoCompact=true
/ai                       # Show current settings
```

### `/ai context`

Show all context items that would be included in the next chat request.

```
/ai context
```

### `/compact`

Manually compact the conversation context by summarizing prior messages.

```
/compact
```

### `/rerank query="..." documents="..."`

Rank documents by relevance to a query.

```
/rerank query="best programming languages" documents="JavaScript,Python,Rust"
```

## Supported Providers

| Provider          | Chat | Embeddings | Images | Speech | Transcription | Reranking | Notes                                     |
|-------------------|------|------------|--------|--------|---------------|-----------|-------------------------------------------|
| OpenAI            | ✅    | ✅          | ✅      | ✅      | ✅             | ✅        | GPT-4.1, GPT-5, O3, O4-mini, TTS, Whisper   |
| Anthropic         | ✅    | ❌          | ❌      | ❌      | ❌             | ❌        | Claude 3.5, 4, 4.1                        |
| Google            | ✅    | ❌          | ✅      | ❌      | ❌             | ❌        | Gemini 2.5 Pro/Flash, web search          |
| xAI               | ✅    | ❌          | ✅      | ❌      | ❌             | ❌        | Grok 3, 4, code models                    |
| DeepSeek          | ✅    | ❌          | ❌      | ❌      | ❌             | ❌        | DeepSeek Chat, Reasoner                   |
| Groq              | ✅    | ❌          | ❌      | ❌      | ❌             | ❌        | Fast inference, Llama models              |
| Cerebras          | ✅    | ❌          | ❌      | ❌      | ❌             | ❌        | Ultra-fast inference                      |
| Perplexity        | ✅    | ❌          | ❌      | ❌      | ❌             | ❌        | Sonar models with web search              |
| Azure             | ✅    | ❌          | ❌      | ❌      | ❌             | ❌        | Azure OpenAI Service                      |
| Ollama            | ✅    | ✅          | ❌      | ❌      | ❌             | ❌        | Local models                              |
| OpenRouter        | ✅    | ❌          | ❌      | ❌      | ❌             | ❌        | Access to many providers                  |
| Fal               | ❌    | ❌          | ✅      | ❌      | ❌             | ❌        | Image generation                          |
| OpenAI-Compatible | ✅    | ✅          | ❌      | ❌      | ❌             | ❌        | Custom endpoints                          |
| ElevenLabs        | ❌    | ❌          | ❌      | ✅      | ✅             | ❌        | Text-to-speech and audio transcription services |

## Model Features

Models can have various features that can be enabled/disabled:

- **websearch**: Enables web search capability
- **reasoningEffort**: Reasoning effort level (none, minimal, low, medium, high)
- **reasoningSummary**: Reasoning summary mode (auto, detailed)
- **serviceTier**: Service tier (auto, flex, priority, default)
- **textVerbosity**: Text verbosity (low, medium, high)
- **strictJsonSchema**: Use strict JSON schema validation

**Example:**

```typescript
// Select model with web search enabled
const client = await modelRegistry.chat.getFirstOnlineClient('openai/gpt-5?websearch=1');

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
vitest run                  # Run tests
bun run test:watch        # Watch mode
bun run test:coverage     # Coverage report
```

## License

MIT License - see LICENSE file for details.