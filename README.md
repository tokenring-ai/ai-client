# @tokenring-ai/ai-client

Multi-provider AI integration client for the Token Ring ecosystem. Provides unified access to various AI models through a consistent interface, supporting chat, embeddings, image generation, reranking, speech synthesis, and transcription capabilities.

## Overview

The AI Client package acts as a unified interface to multiple AI providers, abstracting away provider-specific differences while maintaining full access to provider capabilities. It integrates with the Token Ring agent system through seven model registry services that manage model specifications and provide client instances. Models are automatically discovered and registered from each provider, with background processes checking availability and updating status.

### Key Features

- **16+ Native AI Providers**: Anthropic, OpenAI, Google, Groq, Cerebras, DeepSeek, ElevenLabs, Fal, xAI, OpenRouter, Perplexity, Azure, Ollama, Llama (via Meta API), NVIDIA NIM, Chutes, Minimax, MiMo, and zAI
- **Generic Provider Support**: Configure custom providers via OpenAI-compatible, Anthropic-compatible, or Responses-compatible endpoints (supports Qwen/DashScope, llama.cpp, and any other compatible API)
- **Six AI Capabilities**: Chat, Embeddings, Image Generation, Reranking, Speech, and Transcription
- **Seven Model Registries**: Dedicated service registries for managing model specifications and capabilities (Chat, Image Generation, Video Generation, Embedding, Speech, Transcription, and Reranking)
- **Dynamic Model Registration**: Register custom models with availability checks
- **Model Status Tracking**: Monitor model online, cold, and offline status
- **Auto-Configuration**: Automatic provider setup from environment variables
- **JSON-RPC API**: Remote procedure call endpoints for programmatic access via plugin registration
- **Streaming Support**: Real-time streaming responses with delta handling for text and reasoning output
- **Agent Integration**: Seamless integration with Token Ring agent system through services
- **Feature System**: Rich feature specification system supporting boolean, number, string, enum, and array types with validation
- **Cost Tracking**: Automatic cost calculation and metrics integration
- **Model Requirements**: Query models by capabilities (context length, reasoning, intelligence, speed, etc.)

## Installation

```bash
bun add @tokenring-ai/ai-client
```

## Providers

The package supports the following AI providers through dedicated integrations:

| Provider | SDK/Model Support | Key Features |
|----------|-------------------|--------------|
| Anthropic | Claude models | Reasoning, analysis, web search, context caching, image input, file input |
| OpenAI | GPT models, Whisper, TTS, Image Generation | Reasoning, multimodal, real-time audio, image generation, web search, deep research, audio input/output |
| Google | Gemini, Imagen | Thinking, multimodal, image generation, web search, video input, audio input |
| Groq | LLaMA-based models | High-speed inference, Llama, Qwen, Kimi models |
| Cerebras | Cerebras models | High performance inference |
| DeepSeek | DeepSeek models | Reasoning capabilities, chat and reasoner |
| ElevenLabs | Speech synthesis and transcription | Multilingual voice generation, speaker diarization |
| Fal | Image generation | Fast image generation, Flux models |
| xAI | Grok models | Reasoning and analysis |
| OpenRouter | Aggregated access | Multiple provider access, dynamic model discovery |
| Perplexity | Perplexity models | Web search integration, deep research |
| Azure | Azure OpenAI | Enterprise deployment |
| Ollama | Self-hosted models | Local inference, chat and embedding models |
| Llama | Meta Llama models (via Meta API) | Remote inference via Meta API |
| NVIDIA NIM | NVIDIA models | Enterprise AI models via NIM |
| Qwen (DashScope) | Alibaba Cloud models | High context length models |
| Chutes | Various models | Custom model hosting |
| Minimax | Minimax models | Chinese language models |
| MiMo | MiMo models | Custom models |
| zAI | Z.ai models | Chinese AI models |
| Generic | OpenAI/Anthropic/Responses-compatible | Custom providers, Qwen/DashScope, llama.cpp, any compatible API |

Additional providers can be configured using the `generic` provider with OpenAI-compatible, Anthropic-compatible, or Responses-compatible endpoints. This supports providers like Qwen (DashScope), llama.cpp instances, and any other compatible API.

## Core Components

### Model Registries

The package provides seven model registry services, each implementing the `TokenRingService` interface:

- **ChatModelRegistry**: Manages chat model specifications
- **ImageGenerationModelRegistry**: Manages image generation model specifications
- **VideoGenerationModelRegistry**: Manages video generation model specifications
- **EmbeddingModelRegistry**: Manages embedding model specifications
- **SpeechModelRegistry**: Manages speech synthesis model specifications
- **TranscriptionModelRegistry**: Manages speech-to-text transcription model specifications
- **RerankingModelRegistry**: Manages document reranking model specifications

### Client Classes

- **AIChatClient**: Chat completion and structured output generation
- **AIEmbeddingClient**: Text vectorization and embeddings
- **AIImageGenerationClient**: Image generation from text prompts
- **AIVideoGenerationClient**: Video generation from text or images
- **AISpeechClient**: Text-to-speech synthesis
- **AITranscriptionClient**: Audio-to-text transcription
- **AIRerankingClient**: Document relevance ranking

### Utilities

- **modelSettings**: Parses and serializes model names with feature settings
- **resequenceMessages**: Resequences chat messages to maintain proper alternation

## Services

The package registers seven service instances (registries) during plugin installation and initializes providers during the start phase. Each registry implements the `TokenRingService` interface and provides methods for managing model specifications and retrieving clients.

### ChatModelRegistry

Manages chat model specifications and provides access to chat completion capabilities.

**Methods:**

- `registerAllModelSpecs(specs)`: Register multiple chat model specifications
- `getModelSpecsByRequirements(requirements)`: Get models matching specific requirements
- `getModelsByProvider()`: Get all registered models grouped by provider
- `getAllModelsWithOnlineStatus()`: Get all models with their online status
- `getClient(name)`: Get a client instance matching the model name
- `getCheapestModelByRequirements(requirements, estimatedContextLength)`: Find the cheapest model matching requirements

**Model Requirements:**

- `nameLike`: Filter models by name pattern
- `contextLength`: Maximum context length in tokens
- `maxCompletionTokens`: Maximum output tokens
- `webSearch`: Web search capability
- `image`: Image input capability
- `video`: Video input capability
- `audio`: Audio input capability
- `file`: File input capability
- `tools`: Tool use capability
- `structuredOutput`: Structured output capability

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
- `getModelSpecsByRequirements(requirements)`: Get models matching specific requirements
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
- `getModelSpecsByRequirements(requirements)`: Get models matching specific requirements
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
- `getModelSpecsByRequirements(requirements)`: Get models matching specific requirements
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
- `getModelSpecsByRequirements(requirements)`: Get models matching specific requirements
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
- `getModelSpecsByRequirements(requirements)`: Get models matching specific requirements
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
- `getModelSpecsByRequirements(requirements)`: Get models matching specific requirements
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

# zAI
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

# Azure
AZURE_API_ENDPOINT=https://...
AZURE_API_KEY=<key>

# Ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
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
    autoConfigure?: boolean;
    providers?: Record<string, AIProviderConfig>;
  }
}
```

**Note**: The `provider` field in `AIProviderConfig` is a discriminator that matches provider names like "anthropic", "openai", "google", and so on (lowercase).

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
await app.waitForService('ChatModelRegistry', chatRegistry => {
  // Get models matching requirements
  const models = chatRegistry.getModelSpecsByRequirements({
    nameLike: "gpt-5"
  });

  // Get all models with online status
  const allModels = await chatRegistry.getAllModelsWithOnlineStatus();

  // Get models by provider
  const byProvider = await chatRegistry.getModelsByProvider();

  // Get a client
  const client = await chatRegistry.getClient("openai:gpt-5");

  // Use the client
  const [text, response] = await client.textChat(
    {
      messages: [
        { role: "user", content: "Hello" }
      ]
    },
    agent
  );

  console.log(text); // "Hi there!"
});
```

### Using Model Registries

```typescript
// Embedding models
await app.waitForService('EmbeddingModelRegistry', embeddingRegistry => {
  const client = embeddingRegistry.getClient("openai:text-embedding-3-small");
  const embeddings = await client.getEmbeddings(["your text here"]);
});

// Image generation
await app.waitForService('ImageGenerationModelRegistry', imageRegistry => {
  const client = imageRegistry.getClient("openai:gpt-image-1-high");
  const [image, result] = await client.generateImage({
    prompt: "A beautiful sunset over the ocean",
    size: "1024x1024",
    n: 1
  }, agent);
});

// Video generation
await app.waitForService('VideoGenerationModelRegistry', videoRegistry => {
  const client = videoRegistry.getClient("video-model");
  const [video, result] = await client.generateVideo({
    prompt: "A beautiful sunset over the ocean",
    aspectRatio: "16:9",
    duration: 5
  }, agent);
});

// Speech synthesis
await app.waitForService('SpeechModelRegistry', speechRegistry => {
  const client = speechRegistry.getClient("openai:tts-1");
  const [audio, result] = await client.generateSpeech({
    text: "Hello, world!",
    voice: "alloy",
    speed: 1.0
  }, agent);
});

// Transcription
await app.waitForService('TranscriptionModelRegistry', transcriptionRegistry => {
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
```

### Using Feature Queries

```typescript
// Get model with specific configuration
const client = await chatRegistry.getClient("openai:gpt-5?websearch=1");

// Use the client
const [result, response] = await client.textChat(
  {
    messages: [
      { role: "user", content: "Search the web for the latest AI news" }
    ]
  },
  agent
);
```

### Using Feature System

```typescript
// Get model with multiple features
const client = await chatRegistry.getClient("openai:gpt-5?websearch=1&reasoningEffort=high");

// Set features on client instance
client.setSettings({
  websearch: true,
  reasoningEffort: "high"
});

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
    ]
  },
  agent
);

// Calculate cost
const cost = client.calculateCost({
  inputTokens: 100,
  outputTokens: 50
});

// Calculate timing
const timing = client.calculateTiming(1500, {
  inputTokens: 100,
  outputTokens: 50
});

// Rerank documents
const rankings = await client.rerank({
  query: "What is machine learning?",
  documents: [
    "Machine learning is a subset of AI...",
    "AI is a broad field...",
    "Deep learning is a type of ML..."
  ],
  topN: 3
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

| Method | Request Params | Response Params | Purpose |
|--------|----------------|-----------------|---------|
| `listChatModels` | `{}` | `{ models: {...} }` | Get all available chat models with their status |
| `listChatModelsByProvider` | `{}` | `{ modelsByProvider: {...} }` | Get chat models grouped by provider |
| `listEmbeddingModels` | `{}` | `{ models: {...} }` | Get all available embedding models |
| `listEmbeddingModelsByProvider` | `{}` | `{ modelsByProvider: {...} }` | Get embedding models grouped by provider |
| `listImageGenerationModels` | `{}` | `{ models: {...} }` | Get all available image generation models |
| `listImageGenerationModelsByProvider` | `{}` | `{ modelsByProvider: {...} }` | Get image generation models grouped by provider |
| `listSpeechModels` | `{}` | `{ models: {...} }` | Get all available speech models |
| `listSpeechModelsByProvider` | `{}` | `{ modelsByProvider: {...} }` | Get speech models grouped by provider |
| `listTranscriptionModels` | `{}` | `{ models: {...} }` | Get all available transcription models |
| `listTranscriptionModelsByProvider` | `{}` | `{ modelsByProvider: {...} }` | Get transcription models grouped by provider |
| `listRerankingModels` | `{}` | `{ models: {...} }` | Get all available reranking models |
| `listRerankingModelsByProvider` | `{}` | `{ modelsByProvider: {...} }` | Get reranking models grouped by provider |

**Note**: Video generation models are available through the `VideoGenerationModelRegistry` service but are not currently exposed via JSON-RPC endpoints.

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
        hot: boolean
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
const chatModels = await rpcService.call("listChatModels", {
  agentId: "some-agent-id"
});

// Get models by provider
const modelsByProvider = await rpcService.call("listChatModelsByProvider", {
  agentId: "some-agent-id"
});
```

**Note**: Video generation models are currently not exposed via RPC endpoints. They are available through the `VideoGenerationModelRegistry` service but not through the JSON-RPC interface.

## Model Discovery

The package automatically discovers and registers available models from each provider:

1. **Plugin Installation**: `install()` method runs during plugin installation and registers the seven service registries
2. **Provider Configuration**: `start()` method runs after services are registered and registers providers based on configuration
3. **Auto-Configuration**: If `autoConfigure` is true or `providers` is not set, `autoConfig()` is called to detect environment variables
4. **Provider Registration**: Each provider's `init()` method is called with its configuration
5. **Model Registration**: Providers add their available models to the appropriate registries
6. **Availability Checking**: Background process checks `isAvailable()` to determine model status

### Model Status

Models track their online status:

- **online**: Model is available and ready for use
- **cold**: Model is available but needs to be warmed up
- **offline**: Model is not available

### Availability Checking

Models check their availability in the background:

```typescript
// All models are checked for availability shortly after startup
// This automatically fills the online status cache
getAllModelsWithOnlineStatus(): Promise<Record<string, ModelStatus<ChatModelSpec>>>

isAvailable(): Promise<boolean>  // Implement in ModelSpec
isHot(): Promise<boolean>  // Implement in ModelSpec
```

**Note**: The actual client classes (`AIChatClient`, `AIEmbeddingClient`, etc.) are not included in this package's exports. They are part of the internal implementation and imported at runtime from the provider-specific SDKs.

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

**xAI:**
- No specific features currently configured. xAI models are available through the provider integration.

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

**Generic Provider (OpenAI-Compatible):**
- Provider-specific features depend on the underlying model implementation
- The generic provider supports OpenAI-compatible, Anthropic-compatible, and Responses-compatible endpoints
- Common parameters like `temperature`, `top_p`, `frequency_penalty`, `presence_penalty` are passed through to the provider
- For llama.cpp instances, configure via `LLAMA_BASE_URL`, `LLAMA_API_KEY` environment variables

## Best Practices

1. **Auto-Configure**: Use `autoConfigure: true` for convenience and automatic environment variable detection
2. **Check Availability**: Always verify models are available using `getAllModelsWithOnlineStatus()` or `getClient()`
3. **Use Feature Queries**: Leverage query parameters for flexible model selection without creating multiple clients
4. **Monitor Status**: Check model status before expensive operations to avoid failed requests
5. **Reuse Clients**: Create client instances once and reuse for multiple requests for better performance
6. **Select Appropriate Models**: Choose models based on context length and cost requirements
7. **Custom Registrations**: Add custom models when needed using `registerAllModelSpecs()`
8. **Use RPC for Remote Access**: For programmatic access across processes, use the JSON-RPC endpoint (note: video generation models are not yet exposed via RPC)
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

- `@tokenring-ai/app`: Base application framework with service and plugin system
- `@tokenring-ai/agent`: Agent framework for tool execution
- `@tokenring-ai/rpc`: RPC service for programmatic access
- `@tokenring-ai/utility`: Shared utilities and registry functionality
- `@tokenring-ai/metrics`: Metrics service for cost tracking
- `ai`: Vercel AI SDK for streaming and client functionality
- `zod`: Runtime schema validation
- `axios`: HTTP client for API requests

### AI SDK Dependencies

- `@ai-sdk/anthropic`: Anthropic AI SDK for Claude models
- `@ai-sdk/azure`: Azure OpenAI SDK for Azure hosting
- `@ai-sdk/cerebras`: Cerebras AI SDK for LLaMA models
- `@ai-sdk/deepseek`: DeepSeek AI SDK for DeepSeek models
- `@ai-sdk/elevenlabs`: ElevenLabs SDK for speech synthesis and transcription
- `@ai-sdk/fal`: Fal AI SDK for image generation
- `@ai-sdk/google`: Google Generative AI SDK for Gemini and Imagen models
- `@ai-sdk/groq`: Groq AI SDK for fast LLaMA inference
- `@ai-sdk/openai`: OpenAI AI SDK for GPT, Whisper, TTS, and image models
- `@ai-sdk/openai-compatible`: OpenAI-compatible API SDK for generic providers
- `@ai-sdk/open-responses`: OpenAI Responses API SDK
- `@ai-sdk/provider`: AI SDK provider types
- `@ai-sdk/perplexity`: Perplexity AI SDK for Perplexity models
- `@ai-sdk/xai`: xAI SDK for Grok models
- `@openrouter/ai-sdk-provider`: OpenRouter SDK for provider aggregation
- `ollama-ai-provider-v2`: Ollama SDK for local model hosting

### Development Dependencies

- `@vitest/coverage-v8`: Code coverage
- `typescript`: TypeScript compiler
- `vitest`: Unit testing framework

## Development

The package follows the Token Ring plugin pattern:

1. **Install Phase**: Registers seven service instances (registries) and optionally registers RPC endpoint
2. **Start Phase**: Initializes providers and registers models through the provider initialization chain

The package exports the following from `index.ts`:

- `Tool`: Type from Vercel AI SDK
- `UserModelMessage`: Type from Vercel AI SDK
- `chatTool`: Tool creation function (`tool`) from Vercel AI SDK
- `stepCountIs`: Step counting function from Vercel AI SDK

The actual client classes (`AIChatClient`, `AIEmbeddingClient`, `AIImageGenerationClient`, `AIVideoGenerationClient`, `AISpeechClient`, `AITranscriptionClient`, `AIRerankingClient`) are internal implementation details and are accessed through the model registries.

### Utility Functions

The package includes several utility functions in the `util/` directory:

#### modelSettings

Provides functions for parsing and serializing model names with feature settings.

**Functions:**

- `parseModelAndSettings(model)`: Parse model name and extract settings from query string
- `serializeModel(base, settings)`: Serialize model name and settings back to string format
- `coerceFeatureValue(value)`: Convert string values to appropriate types (boolean, number, string)
- `getModelAndSettings(chatService, agent)`: Get current model from chat service and parse it

**Usage:**

```typescript
import {parseModelAndSettings, serializeModel} from "./util/modelSettings";

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
import {resequenceMessages} from "./util/resequenceMessages";

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

## License

MIT License - see LICENSE file for details.
