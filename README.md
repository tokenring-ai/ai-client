# @tokenring-ai/ai-client

Multi-provider AI integration client for the Token Ring ecosystem. Provides unified access to various AI models through a consistent interface, supporting chat, embeddings, image generation, video generation, reranking, speech synthesis, and transcription capabilities.

## Overview

The AI Client package acts as a unified interface to multiple AI providers, abstracting away provider-specific differences while maintaining full access to provider capabilities. It integrates with the Token Ring agent system through seven model registry classes that manage model specifications and provide client instances. Models are automatically discovered and registered from each provider, with background processes checking availability and updating status.

### Key Features

- **12 Native AI Providers**: Anthropic, OpenAI, Google, Groq, Cerebras, DeepSeek, ElevenLabs, Fal, xAI, OpenRouter, Perplexity, plus generic providers for OpenAI/Anthropic/Responses-compatible APIs
- **Generic Provider Support**: Configure custom providers via OpenAI-compatible, Anthropic-compatible, or Responses-compatible endpoints with dynamic model discovery
- **Seven AI Capabilities**: Chat, Embeddings, Image Generation, Video Generation, Reranking, Speech, and Transcription
- **Seven Model Registry Classes**: Dedicated registries for managing model specifications and capabilities (ChatModelRegistry, ImageGenerationModelRegistry, VideoGenerationModelRegistry, EmbeddingModelRegistry, SpeechModelRegistry, TranscriptionModelRegistry, and RerankingModelRegistry)
- **Dynamic Model Registration**: Register custom models with availability checks and background discovery
- **Model Status Tracking**: Monitor model online, cold, and offline status with automatic availability checking
- **Auto-Configuration**: Automatic provider setup from environment variables with fallback to manual configuration (defaults to `autoConfigure: true`)
- **JSON-RPC API**: Remote procedure call endpoints for programmatic access via plugin registration at `/rpc/ai-client`
- **Streaming Support**: Real-time streaming responses with delta handling for text and reasoning output
- **Agent Integration**: Seamless integration with Token Ring agent system through services with automatic cost tracking
- **Feature System**: Rich feature specification system supporting boolean, number, string, enum, and array types with validation
- **Cost Tracking**: Automatic cost calculation and metrics integration with detailed cost breakdowns
- **Model Querying**: Query models by name pattern with optional feature settings and wildcard support (e.g., `openai:*` for all OpenAI models)
- **Vercel AI SDK Integration**: Built on the Vercel AI SDK for consistent provider interfaces and streaming support

## Installation

```bash
bun add @tokenring-ai/ai-client
```

## Chat Commands

This package defines the following chat commands:

| Command | Description | Parameters |
|---------|-------------|------------|
| `/ai models update` | Updates the models file with the latest models from the TokenRing AI server | `-y`: Skip confirmation prompt; `url`: URL of the models.yaml to download (default: `https://dist.tokenring.ai/models.yaml`) |

**Example:**

```bash
/ai models update
```

Or with the `-y` flag to skip confirmation:

```bash
/ai models update -y
```

Or with a custom URL:

```bash
/ai models update https://custom.url/models.yaml
```

## Tools

The AI Client package does not define any tools directly. Tools are typically defined in other packages that use the AI Client to interact with models.

## Providers

The package supports the following AI providers through dedicated integrations:

| Provider   | SDK/Model Support                          | Key Features                                                                                            |
|------------|--------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Anthropic  | Claude models                              | Reasoning, analysis, web search, context caching, image input, file input                               |
| OpenAI     | GPT models, Whisper, TTS, Image Generation | Reasoning, multimodal, real-time audio, image generation, web search, audio input/output                |
| Google     | Gemini, Imagen                             | Thinking, multimodal, image generation, web search, video/audio/file input                              |
| Groq       | LLaMA-based models                         | High-speed inference, Llama, Qwen, Kimi models                                                          |
| Cerebras   | Cerebras models                            | High performance inference                                                                              |
| DeepSeek   | DeepSeek models                            | Reasoning capabilities, chat and reasoner                                                               |
| ElevenLabs | Speech synthesis and transcription         | Multilingual voice generation, speaker diarization                                                      |
| Fal        | Image generation                           | Fast image generation, Flux models                                                                      |
| xAI        | Grok models                                | Reasoning and analysis, image generation, video generation, web search, X search                        |
| OpenRouter | Aggregated access                          | Multiple provider access, dynamic model discovery                                                       |
| Perplexity | Perplexity models                          | Web search integration, deep research                                                                   |
| Generic    | OpenAI/Anthropic/Responses-compatible      | Custom providers, llama.cpp, Azure, Ollama, NVIDIA NIM, Qwen, Chutes, MiMo, zAI, any compatible API     |

Additional providers like Azure OpenAI, Ollama, NVIDIA NIM, Qwen (DashScope), Chutes, MiMo, and zAI can be configured using the `generic` provider with OpenAI-compatible, Anthropic-compatible, or Responses-compatible endpoints.

Note: Meta (Llama), Minimax are supported via the generic provider configuration.

## Core Components

### Model Registries

The package provides seven model registry services, each implementing the `TokenRingService` interface:

- **ChatModelRegistry**: Manages chat model specifications and provides chat completion capabilities
- **ImageGenerationModelRegistry**: Manages image generation model specifications
- **VideoGenerationModelRegistry**: Manages video generation model specifications
- **EmbeddingModelRegistry**: Manages embedding model specifications for text vectorization
- **SpeechModelRegistry**: Manages speech synthesis model specifications
- **TranscriptionModelRegistry**: Manages speech-to-text transcription model specifications
- **RerankingModelRegistry**: Manages document reranking model specifications

### Client Classes

The client classes are internal implementation details accessed through the model registries via `getClient()`:

- **AIChatClient**: Chat completion and structured output generation with streaming support
- **AIEmbeddingClient**: Text vectorization and embeddings
- **AIImageGenerationClient**: Image generation from text prompts
- **AIVideoGenerationClient**: Video generation from text or images
- **AISpeechClient**: Text-to-speech synthesis
- **AITranscriptionClient**: Audio-to-text transcription
- **AIRerankingClient**: Document relevance ranking

### Utilities

The package exports utility functions from the `util/` directory:

- **modelSettings**: Parses and serializes model names with feature settings
  - `parseModelAndSettings(model)`: Parse model name and extract settings from query string
  - `serializeModel(base, settings)`: Serialize model name and settings back to string format
  - `coerceFeatureValue(value)`: Convert string values to appropriate types (boolean, number, string)
- **resequenceMessages**: Resequences chat messages to maintain proper alternating user/assistant pattern

## Services

The package registers seven service instances (registries) during plugin installation and initializes providers during the start phase. Each registry implements the `TokenRingService` interface and provides methods for managing model specifications and retrieving clients.

### ChatModelRegistry

Manages chat model specifications and provides access to chat completion capabilities.

**Methods:**

- `registerAllModelSpecs(specs)`: Register multiple chat model specifications
- `getModelSpecsByRequirements(nameLike)`: Get models matching a name pattern (e.g., `"openai:gpt-5"` or `"openai:*"`)
- `getModelsByProvider()`: Get all registered models grouped by provider (async)
- `getAllModelsWithOnlineStatus()`: Get all models with their online status (async)
- `getClient(name)`: Get a client instance matching the model name (supports query parameters for features)
- `getCheapestModelByRequirements(nameLike, estimatedContextLength)`: Find the cheapest model matching a name pattern

**Note**: The `getModelSpecsByRequirements` method accepts a name pattern string (e.g., `"openai:gpt-5"` or `"openai:*"`) to filter models by name. The method returns all models matching the pattern that also support the features specified in the query string (e.g., `"openai:gpt-5?websearch=1"`).

**Model Specification:**

Each model specification includes:

- `modelId`: Unique identifier for the model
- `providerDisplayName`: Display name of the provider
- `impl`: Model implementation interface
- `costPerMillionInputTokens`: Cost per million input tokens
- `costPerMillionOutputTokens`: Cost per million output tokens
- `costPerMillionCachedInputTokens`: Cost per million cached input tokens (optional)
- `costPerMillionReasoningTokens`: Cost per million reasoning tokens (optional)
- `maxContextLength`: Maximum context length in tokens
- `isAvailable()`: Async function to check model availability
- `isHot()`: Async function to check if model is warmed up
- `mangleRequest()`: Optional function to modify the request before sending
- `settings`: Optional feature specifications for query parameters
- `inputCapabilities`: Input capability specifications

**Example:**

```typescript
chatRegistry.registerAllModelSpecs([
  {
    modelId: "custom-model",
    providerDisplayName: "CustomProvider",
    impl: customProvider("custom-model"),
    costPerMillionInputTokens: 5,
    costPerMillionOutputTokens: 15,
    maxContextLength: 100000,
    async isAvailable() {
      return true;
    }
  }
]);
```

### ImageGenerationModelRegistry

Manages image generation model specifications.

**Methods:**

- `registerAllModelSpecs(specs)`: Register image generation model specifications
- `getModelSpecsByRequirements(nameLike)`: Get models matching a name pattern
- `getModelsByProvider()`: Get all registered models grouped by provider
- `getAllModelsWithOnlineStatus()`: Get all models with their online status
- `getClient(name)`: Get a client instance matching the model name

**Model Specification:**

- `modelId`: Unique identifier for the model
- `providerDisplayName`: Display name of the provider
- `impl`: Image model implementation
- `calculateImageCost(request, result)`: Function to calculate image generation cost
- `providerOptions`: Provider-specific options
- `isAvailable()`: Async function to check model availability

### VideoGenerationModelRegistry

Manages video generation model specifications.

**Methods:**

- `registerAllModelSpecs(specs)`: Register video generation model specifications
- `getModelSpecsByRequirements(nameLike)`: Get models matching a name pattern
- `getModelsByProvider()`: Get all registered models grouped by provider
- `getAllModelsWithOnlineStatus()`: Get all models with their online status
- `getClient(name)`: Get a client instance matching the model name

**Model Specification:**

- `modelId`: Unique identifier for the model
- `providerDisplayName`: Display name of the provider
- `impl`: Video model implementation
- `calculateVideoCost(request, result)`: Function to calculate video generation cost
- `providerOptions`: Provider-specific options
- `inputCapabilities`: Input capability specifications

### EmbeddingModelRegistry

Manages embedding model specifications for text vectorization.

**Methods:**

- `registerAllModelSpecs(specs)`: Register embedding model specifications
- `getModelSpecsByRequirements(nameLike)`: Get models matching a name pattern
- `getModelsByProvider()`: Get all registered models grouped by provider
- `getAllModelsWithOnlineStatus()`: Get all models with their online status
- `getClient(name)`: Get a client instance matching the model name

**Model Specification:**

- `modelId`: Unique identifier for the model
- `providerDisplayName`: Display name of the provider
- `impl`: Embedding model implementation
- `contextLength`: Maximum context length
- `costPerMillionInputTokens`: Cost per million input tokens
- `isAvailable()`: Async function to check model availability

### SpeechModelRegistry

Manages speech synthesis model specifications.

**Methods:**

- `registerAllModelSpecs(specs)`: Register speech model specifications
- `getModelSpecsByRequirements(nameLike)`: Get models matching a name pattern
- `getModelsByProvider()`: Get all registered models grouped by provider
- `getAllModelsWithOnlineStatus()`: Get all models with their online status
- `getClient(name)`: Get a client instance matching the model name

**Model Specification:**

- `modelId`: Unique identifier for the model
- `providerDisplayName`: Display name of the provider
- `impl`: Speech model implementation
- `costPerMillionCharacters`: Cost per million characters
- `providerOptions`: Provider-specific options
- `settings`: Feature specifications

### TranscriptionModelRegistry

Manages speech-to-text transcription model specifications.

**Methods:**

- `registerAllModelSpecs(specs)`: Register transcription model specifications
- `getModelSpecsByRequirements(nameLike)`: Get models matching a name pattern
- `getModelsByProvider()`: Get all registered models grouped by provider
- `getAllModelsWithOnlineStatus()`: Get all models with their online status
- `getClient(name)`: Get a client instance matching the model name

**Model Specification:**

- `modelId`: Unique identifier for the model
- `providerDisplayName`: Display name of the provider
- `impl`: Transcription model implementation
- `costPerMinute`: Cost per minute of audio
- `providerOptions`: Provider-specific options
- `settings`: Feature specifications

### RerankingModelRegistry

Manages document reranking model specifications.

**Methods:**

- `registerAllModelSpecs(specs)`: Register reranking model specifications
- `getModelSpecsByRequirements(nameLike)`: Get models matching a name pattern
- `getModelsByProvider()`: Get all registered models grouped by provider
- `getAllModelsWithOnlineStatus()`: Get all models with their online status
- `getClient(name)`: Get a client instance matching the model name

**Model Specification:**

- `modelId`: Unique identifier for the model
- `providerDisplayName`: Display name of the provider
- `impl`: Reranking model implementation
- `costPerMillionInputTokens`: Cost per million input tokens (optional)
- `isAvailable()`: Async function to check model availability

## Configuration

The AI Client can be configured through environment variables or explicit provider configuration.

### Auto-Configuration

Enable automatic provider configuration using environment variables:

```typescript
import TokenRingApp from "@tokenring-ai/app";
import aiClientPlugin from "@tokenring-ai/ai-client";

const app = new TokenRingApp();

app.addPlugin(aiClientPlugin, {
  ai: {
    autoConfigure: true  // Auto-detect and configure providers from env vars
  }
});
```

### Environment Variables

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
OPENAI_API_KEY=sk-...

# Google
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# Groq
GROQ_API_KEY=gsk_...

# ElevenLabs
ELEVENLABS_API_KEY=...

# xAI
XAI_API_KEY=...

# OpenRouter
OPENROUTER_API_KEY=...

# Perplexity
PERPLEXITY_API_KEY=...

# DeepSeek
DEEPSEEK_API_KEY=...

# Cerebras
CEREBRAS_API_KEY=...

# Qwen (DashScope)
DASHSCOPE_API_KEY=sk-...

# Meta API Service (llama.com)
META_LLAMA_API_KEY=sk-...

# zAI (Z.ai)
ZAI_API_KEY=...

# Chutes
CHUTES_API_KEY=...

# NVIDIA NIM
NVIDIA_NIM_API_KEY=...

# Minimax
MINIMAX_API_KEY=...

# MiMo
MIMO_API_KEY=...

# llama.cpp (multiple instances supported)
LLAMA_BASE_URL=http://127.0.0.1:11434/v1
LLAMA_API_KEY=...

# llama.cpp (other instances can be registered)
LLAMA_BASE_URL2=http://127.0.0.1:11434/v1
LLAMA_API_KEY2=...
```

### Manual Configuration

```typescript
app.addPlugin(aiClientPlugin, {
  ai: {
    autoConfigure: false,
    providers: {
      OpenAI: {
        provider: "openai",
        apiKey: "sk-..."
      },
      Anthropic: {
        provider: "anthropic",
        apiKey: "sk-ant-..."
      },
      Google: {
        provider: "google",
        apiKey: "AIza..."
      },
      Groq: {
        provider: "groq",
        apiKey: "gsk_..."
      },
      Cerebras: {
        provider: "cerebras",
        apiKey: "..."
      },
      DeepSeek: {
        provider: "deepseek",
        apiKey: "..."
      },
      ElevenLabs: {
        provider: "elevenlabs",
        apiKey: "..."
      },
      Fal: {
        provider: "fal",
        apiKey: "..."
      },
      xAi: {
        provider: "xai",
        apiKey: "..."
      },
      OpenRouter: {
        provider: "openrouter",
        apiKey: "..."
      },
      Perplexity: {
        provider: "perplexity",
        apiKey: "..."
      },
      LLama: {
        provider: "generic",
        endpointType: "openai",
        apiKey: "sk-...",
        baseURL: "https://api.llama.com/compat/v1"
      },
      Nvidia: {
        provider: "generic",
        endpointType: "openai",
        apiKey: "...",
        baseURL: "https://integrate.api.nvidia.com/v1"
      },
      Qwen: {
        provider: "generic",
        endpointType: "openai",
        apiKey: "sk-...",
        baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
      },
      Chutes: {
        provider: "generic",
        endpointType: "openai",
        apiKey: "...",
        baseURL: "https://llm.chutes.ai/v1"
      },
      zAi: {
        provider: "generic",
        endpointType: "openai",
        apiKey: "...",
        baseURL: "https://api.z.ai/api/coding/paas/v4"
      },
      MiMo: {
        provider: "generic",
        endpointType: "openai",
        apiKey: "...",
        baseURL: "https://api.xiaomimimo.com/v1"
      },
      Minimax: {
        provider: "generic",
        endpointType: "anthropic",
        apiKey: "...",
        baseURL: "https://api.minimax.io/anthropic/v1"
      },
      LlamaCPP: {
        provider: "generic",
        endpointType: "openai",
        baseURL: "http://127.0.0.1:11434/v1"
      }
    }
  }
});
```

### Configuration Schema

The plugin configuration schema is:

```typescript
{
  ai: {
    autoConfigure?: boolean;  // Default: true
    providers?: Record<string, AIProviderConfig>;
  }
}
```

**Note**: The `provider` field in `AIProviderConfig` is a discriminator that matches provider names like "anthropic", "openai", "google", etc. (lowercase). The top-level keys (like "OpenAI", "Anthropic", "xAi") are display names that can be customized.

## Client Usage

You can create clients directly from the registries or use the JSON-RPC API for programmatic access.

### Direct Client Creation

```typescript
import TokenRingApp from "@tokenring-ai/app";
import aiClientPlugin from "@tokenring-ai/ai-client";

const app = new TokenRingApp();

app.addPlugin(aiClientPlugin, {
  ai: {
    autoConfigure: true
  }
});

// Wait for services to be registered
await app.waitForService('ChatModelRegistry', async chatRegistry => {
  // Get models matching requirements
  const models = chatRegistry.getModelSpecsByRequirements("gpt-5");

  // Get all models with online status
  const allModels = await chatRegistry.getAllModelsWithOnlineStatus();

  // Get models by provider
  const byProvider = await chatRegistry.getModelsByProvider();

  // Get a client
  const client = chatRegistry.getClient("openai:gpt-5");

  // Use the client
  const [text, response] = await client.textChat(
    {
      messages: [
        { role: "user", content: "Hello" }
      ],
      tools: {}
    },
    agent
  );

  console.log(text); // "Hi there!"
});
```

### Using Model Registries

```typescript
// Embedding models
await app.waitForService('EmbeddingModelRegistry', async embeddingRegistry => {
  const client = embeddingRegistry.getClient("openai:text-embedding-3-small");
  const embeddings = await client.getEmbeddings({ input: ["your text here"] });
});

// Image generation
await app.waitForService('ImageGenerationModelRegistry', async imageRegistry => {
  const client = imageRegistry.getClient("openai:gpt-image-1-high");
  const [image, result] = await client.generateImage({
    prompt: "A beautiful sunset over the ocean",
    size: "1024x1024",
    n: 1
  }, agent);
});

// Video generation
await app.waitForService('VideoGenerationModelRegistry', async videoRegistry => {
  const client = videoRegistry.getClient("xai:grok-imagine-video");
  const [video, result] = await client.generateVideo({
    prompt: "A beautiful sunset over the ocean",
    aspectRatio: "16:9",
    duration: 5
  }, agent);
});

// Speech synthesis
await app.waitForService('SpeechModelRegistry', async speechRegistry => {
  const client = speechRegistry.getClient("openai:tts-1");
  const [audio, result] = await client.generateSpeech({
    text: "Hello, world!",
    voice: "alloy",
    speed: 1.0
  }, agent);
});

// Transcription
await app.waitForService('TranscriptionModelRegistry', async transcriptionRegistry => {
  const client = transcriptionRegistry.getClient("openai:whisper-1");
  const [text, result] = await client.transcribe({
    audio: audioFile
  }, agent);
});
```

### Custom Model Registration

```typescript
// Get registry instance
const chatRegistry = app.getService('ChatModelRegistry');

chatRegistry.registerAllModelSpecs([
  {
    modelId: "custom-model",
    providerDisplayName: "CustomProvider",
    impl: customProvider("custom-model"),
    costPerMillionInputTokens: 5,
    costPerMillionOutputTokens: 15,
    maxContextLength: 100000,
    async isAvailable() {
      return true;
    }
  }
]);

// Get a client for the custom model
const client = chatRegistry.getClient("CustomProvider:custom-model");
```

### Using Feature Queries

```typescript
// Get model with specific configuration
const client = chatRegistry.getClient("openai:gpt-5?websearch=1");

// Use the client
const [result, response] = await client.textChat(
  {
    messages: [
      { role: "user", content: "Search the web for the latest AI news" }
    ],
    tools: {}
  },
  agent
);
```

### Using Feature System

```typescript
// Get model with multiple features
const client = chatRegistry.getClient("openai:gpt-5?websearch=1&reasoningEffort=high");

// Set features on client instance
client.setSettings(new Map([
  ["websearch", true],
  ["reasoningEffort", "high"]
]));

// Get current features
const features = client.getSettings();
```

## Client Methods

### AIChatClient

The chat client provides methods for generating text and structured outputs.

**Methods:**

- `textChat(request, agent)`: Send a chat completion request and return the full text response
- `streamChat(request, agent)`: Stream a chat completion with real-time delta handling
- `generateObject(request, agent)`: Send a chat completion request and return a structured object response
- `rerank(request, agent)`: Rank documents by relevance to a query
- `calculateCost(usage)`: Calculate the cost for a given usage object
- `calculateTiming(elapsedMs, usage)`: Calculate timing information
- `setSettings(settings)`: Set enabled settings on this client instance
- `getSettings()`: Get a copy of the enabled settings
- `getModelId()`: Get the model ID
- `getModelSpec()`: Get the model specification

**Example:**

```typescript
const [text, response] = await client.textChat(
  {
    messages: [
      { role: "user", content: "Hello" }
    ],
    tools: {}
  },
  agent
);

// Calculate cost
const cost = client.calculateCost({
  inputTokens: 100,
  outputTokens: 50,
  cachedInputTokens: 0,
  reasoningTokens: 0
});

// Calculate timing
const timing = client.calculateTiming(1500, {
  inputTokens: 100,
  outputTokens: 50,
  cachedInputTokens: 0,
  reasoningTokens: 0
});

// Rerank documents (via generateObject with schema)
const [rankings] = await client.generateObject({
  messages: [
    { role: "user", content: "Rank these documents..." }
  ],
  tools: {},
  schema: rerankSchema
}, agent);
```

### AIEmbeddingClient

The embedding client generates vector embeddings for text.

**Methods:**

- `getEmbeddings({ input })`: Generate embeddings for an array of input strings
- `setSettings(settings)`: Set enabled settings on this client instance
- `getSettings()`: Get a copy of the enabled settings
- `getModelId()`: Get the model ID

**Example:**

```typescript
const embeddings = await client.getEmbeddings([
  "Hello world",
  "Machine learning is great"
]);
```

### AIImageGenerationClient

The image generation client creates images from text prompts.

**Methods:**

- `generateImage(request, agent)`: Generate an image based on a prompt
- `setSettings(settings)`: Set enabled settings on this client instance
- `getSettings()`: Get a copy of the enabled settings
- `getModelId()`: Get the model ID

**Example:**

```typescript
const [image, result] = await client.generateImage({
  prompt: "A beautiful sunset over the ocean",
  size: "1024x1024",
  n: 1
}, agent);
```

### AIVideoGenerationClient

The video generation client creates videos from text prompts or images.

**Methods:**

- `generateVideo(request, agent)`: Generate a video based on a prompt
- `setSettings(settings)`: Set enabled settings on this client instance
- `getSettings()`: Get a copy of the enabled settings
- `getModelId()`: Get the model ID

**Example:**

```typescript
const [video, result] = await client.generateVideo({
  prompt: "A beautiful sunset over the ocean",
  aspectRatio: "16:9",
  duration: 5
}, agent);
```

### AISpeechClient

The speech client synthesizes speech from text.

**Methods:**

- `generateSpeech(request, agent)`: Generate speech from text
- `setSettings(settings)`: Set enabled settings on this client instance
- `getSettings()`: Get a copy of the enabled settings
- `getModelSpec()`: Get the model specification

**Example:**

```typescript
const [audio, result] = await client.generateSpeech({
  text: "Hello, world!",
  voice: "alloy",
  speed: 1.0
}, agent);
```

### AITranscriptionClient

The transcription client transcribes audio to text.

**Methods:**

- `transcribe(request, agent)`: Transcribe audio to text
- `setSettings(settings)`: Set enabled settings on this client instance
- `getSettings()`: Get a copy of the enabled settings
- `getModelSpec()`: Get the model specification

**Example:**

```typescript
const [text, result] = await client.transcribe({
  audio: audioFile,
  language: "en"
}, agent);
```

### AIRerankingClient

The reranking client ranks documents by relevance to a query.

**Methods:**

- `rerank({ query, documents, topN })`: Rank documents by relevance
- `setSettings(settings)`: Set enabled settings on this client instance
- `getSettings()`: Get a copy of the enabled settings
- `getModelId()`: Get the model ID

**Example:**

```typescript
const result = await client.rerank({
  query: "What is machine learning?",
  documents: [
    "Machine learning is a subset of AI...",
    "AI is a broad field...",
    "Deep learning is a type of ML..."
  ],
  topN: 3
});
```

## RPC Endpoints

The AI Client exposes JSON-RPC endpoints for programmatic access via the RPC service. The endpoint is registered under the path `/rpc/ai-client`.

### Available Endpoints

| Method                                | Request Params | Response Params               | Purpose                                         |
|---------------------------------------|----------------|-------------------------------|-------------------------------------------------|
| `listChatModels`                      | `{}`           | `{ models: {...} }`           | Get all available chat models with their status |
| `listChatModelsByProvider`            | `{}`           | `{ modelsByProvider: {...} }` | Get chat models grouped by provider             |
| `listEmbeddingModels`                 | `{}`           | `{ models: {...} }`           | Get all available embedding models              |
| `listEmbeddingModelsByProvider`       | `{}`           | `{ modelsByProvider: {...} }` | Get embedding models grouped by provider        |
| `listImageGenerationModels`           | `{}`           | `{ models: {...} }`           | Get all available image generation models       |
| `listImageGenerationModelsByProvider` | `{}`           | `{ modelsByProvider: {...} }` | Get image generation models grouped by provider |
| `listVideoGenerationModels`           | `{}`           | `{ models: {...} }`           | Get all available video generation models       |
| `listVideoGenerationModelsByProvider` | `{}`           | `{ modelsByProvider: {...} }` | Get video generation models grouped by provider |
| `listSpeechModels`                    | `{}`           | `{ models: {...} }`           | Get all available speech models                 |
| `listSpeechModelsByProvider`          | `{}`           | `{ modelsByProvider: {...} }` | Get speech models grouped by provider           |
| `listTranscriptionModels`             | `{}`           | `{ models: {...} }`           | Get all available transcription models          |
| `listTranscriptionModelsByProvider`   | `{}`           | `{ modelsByProvider: {...} }` | Get transcription models grouped by provider    |
| `listRerankingModels`                 | `{}`           | `{ models: {...} }`           | Get all available reranking models              |
| `listRerankingModelsByProvider`       | `{}`           | `{ modelsByProvider: {...} }` | Get reranking models grouped by provider        |

**Response Structure:**

```typescript
{
  models: {
    "provider:model": {
      status: "online" | "cold" | "offline",
      available: boolean,
      hot: boolean,
      modelSpec: ModelSpec
    }
  }
}
```

**ByProvider Response Structure:**

```typescript
{
  modelsByProvider: {
    "Provider Name": {
      "provider:model": {
        status: "online" | "cold" | "offline",
        available: boolean,
        hot: boolean,
        modelSpec: ModelSpec  // ModelSpec type varies by registry
      }
    }
  }
}
```

### RPC Usage Example

```typescript
import {RpcService} from "@tokenring-ai/rpc";

const rpcService = app.requireService(RpcService);

// List all chat models
const chatModels = await rpcService.call("listChatModels", {});

// Get models by provider
const modelsByProvider = await rpcService.call("listChatModelsByProvider", {});

// List video generation models
const videoModels = await rpcService.call("listVideoGenerationModels", {});

// List embedding models
const embeddingModels = await rpcService.call("listEmbeddingModels", {});

// List image generation models
const imageModels = await rpcService.call("listImageGenerationModels", {});
```

## Model Discovery

The package automatically discovers and registers available models from each provider:

1. **Plugin Installation**: `install()` method runs during plugin installation and registers the seven service registries (ChatModelRegistry, ImageGenerationModelRegistry, VideoGenerationModelRegistry, EmbeddingModelRegistry, SpeechModelRegistry, TranscriptionModelRegistry, RerankingModelRegistry)
2. **RPC Endpoint Registration**: The JSON-RPC endpoint is registered under `/rpc/ai-client` for programmatic access
3. **Provider Configuration**: `start()` method runs after services are registered and registers providers based on configuration
4. **Auto-Configuration**: If `autoConfigure` is `true` (default), the plugin automatically detects and configures providers from environment variables
5. **Provider Registration**: Each provider's `init()` method is called with its configuration
6. **Model Registration**: Providers add their available models to the appropriate registries
7. **Background Availability Checking**: A background process runs every 30 seconds to check model availability and update status

**Note**: The `autoConfigure` option defaults to `true`, which means providers will be automatically configured if their environment variables are set.

### Model Status

Models track their online status based on availability and hot status:

- **online**: Model is available (`isAvailable() === true`) and hot (`isHot() === true`)
- **cold**: Model is available (`isAvailable() === true`) but not hot (`isHot() === false`)
- **offline**: Model is not available (`isAvailable() === false`)

### Availability Checking

Models check their availability in the background:

```typescript
// All models are checked for availability every 30 seconds
// This automatically fills the online status cache
getAllModelsWithOnlineStatus(): Promise<Record<string, ModelStatus<T>>>

isAvailable(): Promise<boolean>  // Implement in ModelSpec
isHot(): Promise<boolean>  // Implement in ModelSpec (optional)
```

**Note**: The actual client classes (AIChatClient, AIEmbeddingClient, etc.) are not included in this package's exports. They are internal implementation details accessed through the model registries via `getClient()`.

## Feature System

The package supports a rich feature specification system that allows you to configure models dynamically without creating multiple client instances.

### Feature Types

Features can be of the following types:

- **boolean**: Boolean values with optional default
- **number**: Numeric values with optional min/max constraints
- **string**: String values with optional default
- **enum**: Enumerated values with optional default
- **array**: Array values with optional default

### Feature Specification

Each feature has the following properties:

- `description`: Human-readable description of the feature
- `type`: The type of the feature
- `defaultValue`: Default value (optional)
- `min`: Minimum value (for number types)
- `max`: Maximum value (for number types)
- `values`: Allowed values (for enum types)

### Example Features

```typescript
// Boolean feature
{
  description: "Enables web search",
  defaultValue: false,
  type: "boolean"
}

// Number feature with constraints
{
  description: "Maximum number of web searches",
  defaultValue: 5,
  type: "number",
  min: 0,
  max: 20
}

// Enum feature
{
  description: "Reasoning effort level",
  defaultValue: "medium",
  type: "enum",
  values: ["minimal", "low", "medium", "high"]
}

// Array feature
{
  description: "Response modalities",
  defaultValue: ["TEXT"],
  type: "array"
}
```

### Provider-Specific Features

Different providers support different features:

**OpenAI:**

- `websearch`: Enable web search tool (default: false)
- `reasoningEffort`: Reasoning effort level (minimal, low, medium, high) - for reasoning models
- `reasoningSummary`: Reasoning summary mode (auto, detailed) - for reasoning models
- `serviceTier`: Service tier (auto, flex, priority, default)
- `textVerbosity`: Text verbosity (low, medium, high)
- `strictJsonSchema`: Use strict JSON schema validation (default: false)
- `promptCacheRetention`: Prompt cache retention policy (in_memory, 24h) - for gpt-5.1 models

**Anthropic:**

- `caching`: Enable context caching (default: true)
- `websearch`: Enable web search tool (default: false)
- `maxSearchUses`: Maximum number of web searches (default: 5, max: 20)

**Google:**

- `responseModalities`: Response modalities (TEXT, IMAGE) - default: ["TEXT"]
- `thinkingBudget`: Thinking token budget (for Gemini 2.5, 0 to disable)
- `thinkingLevel`: Thinking depth (low, high - for Gemini 3)
- `includeThoughts`: Include thought summaries (default: false)
- `websearch`: Enable web search tool (default: false)

**xAI:**

- `websearch`: Enables web search (default: false)
- `webImageUnderstanding`: Enables image understanding in web search (default: false)
- `XSearch`: Enables X search (default: false)
- `XFromDate`: From date for X search
- `XToDate`: To date for X search
- `XAllowedHandles`: Allowed handles for X search
- `XImageUnderstanding`: Enables image understanding in X search (default: false)
- `XVideoUnderstanding`: Enables video understanding in X search (default: false)

**ElevenLabs (Speech):**

- `voice`: Voice ID to use for speech synthesis
- `language_code`: Language code (ISO 639-1) for the voice
- `stability`: Voice stability (0-1, lower = more variation)
- `similarity_boost`: Similarity boost (0-1, controls adherence to voice)
- `style`: Style amplification (0-1)
- `use_speaker_boost`: Boost similarity to original speaker

**ElevenLabs (Transcription):**

- `languageCode`: Language code (ISO 639-1 or ISO 639-3)
- `tagAudioEvents`: Tag audio events like laughter and footsteps
- `numSpeakers`: Maximum number of speakers (1-32)
- `timestampsGranularity`: Timestamp granularity (none, word, character)
- `diarize`: Annotate which speaker is talking
- `fileFormat`: Input audio format

**Perplexity:**

- `websearch`: Enables web search (default: true)
- `searchContextSize`: Search context size for web search (low, medium, high)

**OpenRouter:**

- `websearch`: Enables web search plugin (default: false)
- `searchEngine`: Search engine (native, exa, or undefined for auto)
- `maxResults`: Maximum number of search results (default 5, max 100)
- `searchContextSize`: Search context size for native search (low, medium, high)
- `frequencyPenalty`: Frequency penalty (-2.0 to 2.0)
- `maxTokens`: Max tokens
- `minP`: Min P sampling (0 to 1.0)
- `presencePenalty`: Presence penalty (-2.0 to 2.0)
- `repetitionPenalty`: Repetition penalty (1.0 to 2.0)
- `temperature`: Temperature (0 to 2.0)
- `topK`: Top K sampling
- `topP`: Top P sampling (0 to 1.0)
- `includeReasoning`: Include reasoning (boolean)
- `reasoning`: Reasoning mode (string)

**Generic Provider (OpenAI-Compatible):**

- `temperature`: Sampling temperature (0 to 2)
- `top_p`: Nucleus sampling (0 to 1)
- `frequency_penalty`: Frequency penalty (-2 to 2)
- `presence_penalty`: Presence penalty (-2 to 2)
- `seed`: Seed for consistent generation
- `top_k`: Top K sampling (0 to 100)
- `min_p`: Minimum probability threshold (0 to 1)
- `repetition_penalty`: Repetition penalty (1 to 2)
- `length_penalty`: Length penalty (0 to 5)
- `min_tokens`: Minimum tokens to generate
- `enable_thinking`: Enable thinking mode (for vllm)

**Generic Provider (Anthropic-Compatible):**

- `caching`: Enable context caching (default: true)
- `websearch`: Enable web search tool (default: false)
- `maxSearchUses`: Maximum number of web searches (default: 5, max: 20)

## Generic Provider Configuration

The generic provider supports OpenAI-compatible, Anthropic-compatible, and Responses-compatible endpoints. It automatically discovers models from the provider's model list endpoint.

**Configuration Options:**

- `endpointType`: "openai", "anthropic", or "responses" (default: "openai")
- `baseURL`: Base URL for the API (required)
- `apiKey`: API key (optional for some providers)
- `apiKeyFromEnv`: Environment variable name for API key (optional)
- `modelListUrl`: Custom URL for model list (optional)
- `modelPropsUrl`: Custom URL for model properties (optional)
- `headers`: Custom headers (optional)
- `queryParams`: Custom query parameters (optional)
- `defaultContextLength`: Default context length (default: 32000)
- `staticModelList`: Static model list (optional)
- `generateModelSpec`: Custom model specification generator (optional)

**Common Use Cases:**

- **Azure OpenAI**: Use `endpointType: "openai"` with Azure's OpenAI endpoint
- **Ollama**: Use `endpointType: "openai"` with your local Ollama server (default: `http://127.0.0.1:11434/v1`)
- **NVIDIA NIM**: Use `endpointType: "openai"` with NVIDIA's NIM endpoint
- **Qwen (DashScope)**: Use `endpointType: "openai"` with DashScope's compatible endpoint
- **Chutes**: Use `endpointType: "openai"` with Chutes' endpoint
- **zAI**: Use `endpointType: "openai"` with zAI's endpoint
- **MiMo**: Use `endpointType: "openai"` with MiMo's endpoint
- **llama.cpp**: Use `endpointType: "openai"` with any llama.cpp server
- **Anthropic-compatible**: Use `endpointType: "anthropic"` for Anthropic-compatible APIs
- **Responses-compatible**: Use `endpointType: "responses"` for Responses-compatible APIs

### Ollama Models (via Generic Provider)

Ollama can be configured using the generic provider with `endpointType: "openai"`. It automatically discovers and registers all models available on your local Ollama instance. Models are detected based on their names:

- **Chat models**: Any model not matching the embedding pattern
- **Embedding models**: Models with "embed" in their name

**Configuration:**

```typescript
{
  provider: "generic",
  endpointType: "openai",
  baseURL: "http://127.0.0.1:11434/v1"
}
```

Models can be configured to be always hot or checked for availability.

## Best Practices

1. **Auto-Configure**: Use `autoConfigure: true` for convenience and automatic environment variable detection
2. **Check Availability**: Always verify models are available using `getAllModelsWithOnlineStatus()` or `getClient()`
3. **Use Feature Queries**: Leverage query parameters for flexible model selection without creating multiple clients
4. **Monitor Status**: Check model status before expensive operations to avoid failed requests
5. **Reuse Clients**: Create client instances once and reuse for multiple requests for better performance
6. **Select Appropriate Models**: Choose models based on context length and cost requirements
7. **Custom Registrations**: Add custom models when needed using `registerAllModelSpecs()`
8. **Use RPC for Remote Access**: For programmatic access across processes, use the JSON-RPC endpoint
9. **Set Settings**: Use `setSettings()` on client instances to enable specific features without creating multiple clients
10. **Calculate Costs**: Use `calculateCost()` to estimate expenses before making requests
11. **Use Cheapest Model**: Use `getCheapestModelByRequirements()` to find the most cost-effective model for your needs
12. **Check Model Hot Status**: Use `isHot()` to determine if a model needs to be warmed up

## Testing

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage
```

## Dependencies

### Runtime Dependencies

```json
{
  "@tokenring-ai/app": "workspace:*",
  "@tokenring-ai/agent": "workspace:*",
  "@tokenring-ai/rpc": "workspace:*",
  "@tokenring-ai/utility": "workspace:*",
  "@tokenring-ai/metrics": "workspace:*",
  "ai": "^6.0.149",
  "zod": "^4.3.6",
  "@ai-sdk/anthropic": "^3.0.67",
  "@ai-sdk/cerebras": "^2.0.44",
  "@ai-sdk/deepseek": "^2.0.28",
  "@ai-sdk/elevenlabs": "^2.0.28",
  "@ai-sdk/fal": "^2.0.29",
  "@ai-sdk/google": "^3.0.59",
  "@ai-sdk/groq": "^3.0.34",
  "@ai-sdk/openai": "^3.0.51",
  "@ai-sdk/openai-compatible": "^2.0.40",
  "@ai-sdk/open-responses": "^1.0.10",
  "@ai-sdk/provider": "^3.0.8",
  "@ai-sdk/perplexity": "^3.0.28",
  "@ai-sdk/xai": "^3.0.79",
  "@openrouter/ai-sdk-provider": "^2.4.3",
  "ollama-ai-provider-v2": "^3.5.0"
}
```

**Note**: `@ai-sdk/azure` and `ollama-ai-provider-v2` are included as dependencies for potential future use or generic provider configurations, but are not registered as native providers in the current implementation.

### Development Dependencies

```json
{
  "typescript": "^6.0.2"
}
```

## Development

The package follows the Token Ring plugin pattern:

1. **Install Phase**: Registers seven service instances (registries) and optionally registers RPC endpoint
2. **Start Phase**: Initializes providers and registers models through the provider initialization chain

The package exports the following from `index.ts`:

```typescript
export type { Tool, UserModelMessage } from "ai";
export { stepCountIs, tool as chatTool } from "ai";
```

- `Tool`: Type from Vercel AI SDK
- `UserModelMessage`: Type from Vercel AI SDK
- `chatTool`: Tool creation function (`tool`) from Vercel AI SDK
- `stepCountIs`: Step counting function from Vercel AI SDK

**Note**: The actual client classes (AIChatClient, AIEmbeddingClient, AIImageGenerationClient, AIVideoGenerationClient, AISpeechClient, AITranscriptionClient, AIRerankingClient) are internal implementation details and are accessed through the model registries via `getClient()`.

### Utility Functions

The package includes several utility functions in the `util/` directory:

#### modelSettings

Provides functions for parsing and serializing model names with feature settings.

**Functions:**

- `parseModelAndSettings(model)`: Parse model name and extract settings from query string
- `serializeModel(base, settings)`: Serialize model name and settings back to string format
- `coerceFeatureValue(value)`: Convert string values to appropriate types (boolean, number, string)

**Usage:**

```typescript
import {parseModelAndSettings, serializeModel} from "@tokenring-ai/ai-client/util/modelSettings";

// Parse model with settings
const {base, settings} = parseModelAndSettings("openai:gpt-5?websearch=1&reasoningEffort=high");
// base: "openai:gpt-5"
// settings: Map { "websearch" => true, "reasoningEffort" => "high" }

// Serialize model with settings
const modelString = serializeModel("openai:gpt-5", settings);
// "openai:gpt-5?websearch=1&reasoningEffort=high"
```

#### resequenceMessages

Resequences chat messages to maintain proper alternating user/assistant pattern. This is useful when preparing messages for chat models that require strict alternation.

**Usage:**

```typescript
import {resequenceMessages} from "@tokenring-ai/ai-client/util/resequenceMessages";

const request = {
  messages: [
    { role: "user", content: "Hello" },
    { role: "user", content: "How are you?" },  // Consecutive user messages
    { role: "assistant", content: "I'm good" },
    { role: "user", content: "Thanks" }
  ],
  tools: {}
};

resequenceMessages(request);
// Messages are combined and resequenced to maintain alternation
```

## Schemas

The package exports several Zod schemas for model specifications and capabilities:

### Model Input Capabilities

```typescript
export const ModelInputCapabilitySchema = z.union([z.boolean(), z.array(z.string())]);
export const ModelInputCapabilitiesSchema = z.object({
  text: z.boolean().default(true),
  image: ModelInputCapabilitySchema.default(false),
  video: ModelInputCapabilitySchema.default(false),
  audio: ModelInputCapabilitySchema.default(false),
  file: ModelInputCapabilitySchema.default(false),
});
```

### Model Settings Definition

```typescript
export const ModelSettingsDefinitionSchema = z.discriminatedUnion("type", [
  z.object({
    description: z.string(),
    type: z.literal("boolean"),
    defaultValue: z.boolean().optional(),
  }),
  z.object({
    description: z.string(),
    type: z.literal("number"),
    defaultValue: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    description: z.string(),
    type: z.literal("string"),
    defaultValue: z.string().optional(),
  }),
  z.object({
    description: z.string(),
    type: z.literal("enum"),
    defaultValue: primitiveTypeSchema.optional(),
    values: z.array(primitiveTypeSchema),
  }),
  z.object({
    description: z.string(),
    type: z.literal("array"),
    defaultValue: z.array(primitiveTypeSchema).optional(),
  }),
]);
```

## Related Components

- **@tokenring-ai/agent**: Agent system that integrates with AI Client services
- **@tokenring-ai/rpc**: RPC service for remote procedure calls
- **@tokenring-ai/app**: Core Token Ring application framework

## License

MIT License - see LICENSE file for details.
