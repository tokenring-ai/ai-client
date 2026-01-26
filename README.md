# @tokenring-ai/ai-client

Multi-provider AI integration client for the Token Ring ecosystem. Provides unified access to various AI models through a consistent interface, supporting chat, embeddings, image generation, speech synthesis, transcription, and document reranking capabilities.

## Overview

The AI Client package acts as a unified interface to multiple AI providers, abstracting away provider-specific differences while maintaining full access to provider capabilities. It integrates with the Token Ring agent system through six model registry services that manage model specifications and provide client instances. Models are automatically discovered and registered from each provider, with background processes checking availability and updating status.

### Key Features

- **Multi-Provider Support**: 15 AI providers including Anthropic, OpenAI, Google, Groq, Cerebras, DeepSeek, ElevenLabs, Fal, xAI, OpenRouter, Perplexity, Azure, Ollama, llama.cpp, and Qwen
- **Six AI Capabilities**: Chat, Embeddings, Image Generation, Reranking, Speech, and Transcription
- **Model Registries**: Six dedicated service registries for managing model specifications and capabilities
- **Dynamic Model Registration**: Register custom models with availability checks
- **Model Status Tracking**: Monitor model online, cold, and offline status
- **Auto-Configuration**: Automatic provider setup from environment variables
- **JSON-RPC API**: Remote procedure call endpoints for programmatic access via plugin registration
- **Streaming Support**: Real-time streaming responses with delta handling
- **Agent Integration**: Seamless integration with Token Ring agent system through services
- **Feature Queries**: Support for query parameters in model names (e.g., `provider:model?websearch=1`)

## Installation

```bash
bun add @tokenring-ai/ai-client
```

## Providers

The package supports the following AI providers:

| Provider | SDK/Model Support | Key Features |
|----------|-------------------|--------------|
| Anthropic | Claude models | Reasoning, analysis, web search |
| OpenAI | GPT models, Whisper, TTS | Reasoning, multimodal, real-time audio |
| Google | Gemini, Imagen | Thinking, multimodal, image generation |
| Groq | LLaMA-based models | High-speed inference |
| Cerebras | LLaMA-based models | High performance |
| DeepSeek | DeepSeek models | Reasoning capabilities |
| ElevenLabs | Speech synthesis | Multilingual voice generation |
| xAI | xAI models | Reasoning and analysis |
| OpenRouter | Aggregated access | Multiple provider access |
| Perplexity | Perplexity models | Web search integration |
| Fal | Image generation | Fast image generation |
| Ollama | Self-hosted models | Local inference |
| Azure | Azure OpenAI | Enterprise deployment |
| llama.cpp | Self-hosted models | Local inference |
| Qwen | Qwen models | Chinese language support |

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

# qwen (DashScope)
DASHSCOPE_API_KEY=sk-...

# llama.cpp
META_LLAMA_API_KEY=sk-...
LLAMA_BASE_URL=http://127.0.0.1:11434/v1
LLAMA_API_KEY=...

# Azure
AZURE_API_KEY=https://...
AZURE_API_KEY=<key>  # If different from URL

# Ollama
LLAMA_BASE_URL=http://127.0.0.1:11434/v1
LLAMA_API_KEY=...

# z.ai
ZAI_API_KEY=...
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

***Note**: The `provider` field in `AIProviderConfig` is a discriminator that matches provider names like "anthropic", "openai", "google", and so on (lowercase).*

## Services

The package registers six service registries for different AI capabilities. Each registry implements the `TokenRingService` interface and provides methods for managing model specifications and retrieving clients.

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

**Model Specification:**

Each model specification includes:

- `modelId`: Unique identifier for the model
- `providerDisplayName`: Display name of the provider
- `impl`: Model implementation interface
- `costPerMillionInputTokens`: Cost per million input tokens (default: 600)
- `costPerMillionOutputTokens`: Cost per million output tokens (default: 600)
- `contextLength`: Maximum context length in tokens
- `isAvailable()`: Async function to check model availability
- `isHot()`: Async function to check if model is warmed up

**Example:**

```typescript
chatRegistry.registerAllModelSpecs([
  {
    modelId: "custom-model",
    providerDisplayName: "CustomProvider",
    impl: customProvider("custom-model"),
    costPerMillionInputTokens: 5,
    costPerMillionOutputTokens: 15,
    contextLength: 100000
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

**Model Requirements:**

- `nameLike`: Filter models by name pattern

### EmbeddingModelRegistry

Manages embedding model specifications for text vectorization.

**Methods:**

- `registerAllModelSpecs(specs)`: Register embedding model specifications
- `getModelSpecsByRequirements(requirements)`: Get models matching specific requirements
- `getModelsByProvider()`: Get all registered models grouped by provider
- `getAllModelsWithOnlineStatus()`: Get all models with their online status
- `getClient(name)`: Get a client instance matching the model name

**Model Requirements:**

- `nameLike`: Filter models by name pattern

### SpeechModelRegistry

Manages speech synthesis model specifications.

**Methods:**

- `registerAllModelSpecs(specs)`: Register speech model specifications
- `getModelSpecsByRequirements(requirements)`: Get models matching specific requirements
- `getModelsByProvider()`: Get all registered models grouped by provider
- `getAllModelsWithOnlineStatus()`: Get all models with their online status
- `getClient(name)`: Get a client instance matching the model name

**Model Requirements:**

- `nameLike`: Filter models by name pattern

### TranscriptionModelRegistry

Manages speech-to-text transcription model specifications.

**Methods:**

- `registerAllModelSpecs(specs)`: Register transcription model specifications
- `getModelSpecsByRequirements(requirements)`: Get models matching specific requirements
- `getModelsByProvider()`: Get all registered models grouped by provider
- `getAllModelsWithOnlineStatus()`: Get all models with their online status
- `getClient(name)`: Get a client instance matching the model name

**Model Requirements:**

- `nameLike`: Filter models by name pattern

### RerankingModelRegistry

Manages document reranking model specifications.

**Methods:**

- `registerAllModelSpecs(specs)`: Register reranking model specifications
- `getModelSpecsByRequirements(requirements)`: Get models matching specific requirements
- `getModelsByProvider()`: Get all registered models grouped by provider
- `getAllModelsWithOnlineStatus()`: Get all models with their online status
- `getClient(name)`: Get a client instance matching the model name

**Model Requirements:**

- `nameLike`: Filter models by name pattern

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
    nameLike: "gpt-4.1"
  });

  // Get all models with online status
  const allModels = await chatRegistry.getAllModelsWithOnlineStatus();

  // Get models by provider
  const byProvider = await chatRegistry.getModelsByProvider();

  // Get a client
  const client = await chatRegistry.getClient("OpenAI:gpt-5");

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
  const client = embeddingRegistry.getClient("OpenAI:text-embedding-3-small");
  const embedding = await client.getEmbedding("your text here");
});

// Image generation
await app.waitForService('ImageGenerationModelRegistry', imageRegistry => {
  const client = imageRegistry.getClient("OpenAI:dall-e-3");
  const image = await client.generateImage({
    prompt: "A beautiful sunset over the ocean"
  });
});

// Speech synthesis
await app.waitForService('SpeechModelRegistry', speechRegistry => {
  const client = speechRegistry.getClient("ElevenLabs:text");
  const audio = await client.speech({
    text: "Hello, world!"
  });
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
    contextLength: 100000,
    async isAvailable() {
      return true;
    }
  }
]);
```

### Using Feature Queries

```typescript
// Get model with specific configuration
const client = await chatRegistry.getClient("OpenAI:gpt-5?websearch=1");

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

## Model Discovery

The package automatically discovers and registers available models from each provider:

1. **Plugin Installation**: `install()` method runs during plugin installation and registers the six service registries
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
// Allan models are checked for availability shortly after startup
// This automatically fills the online status cache
getAllModelsWithOnlineStatus(): Promise<Record<string, ModelStatus<ChatModelSpec>>>

isAvailable(): Promise<boolean>  // Implement in ModelSpec
isHot(): Promise<boolean>  // Implement in ModelSpec
```

**Note**: The actual client classes (`AIChatClient`, `AIEmbeddingClient`, etc.) are not included in this package. They are part of the provider implementations and imported at runtime from the provider-specific SDKs.

## Best Practices

1. **Auto-Configure**: Use `autoConfigure: true` for convenience and automatic environment variable detection
2. **Check Availability**: Always verify models are available using `getAllModelsWithOnlineStatus()` or `getClient()`
3. **Use Feature Queries**: Leverage query parameters for flexible model selection without creating multiple clients
4. **Monitor Status**: Check model status before expensive operations to avoid failed requests
5. **Reuse Clients**: Create client instances once and reuse for multiple requests for better performance
6. **Select Appropriate Models**: Choose models based on context length and cost requirements
7. **Custom Registrations**: Add custom models when needed using `registerAllModelSpecs()`
8. **Use RPC for Remote Access**: For programmatic access across processes, use the JSON-RPC endpoint

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
- `@tokenring-ai/utility`: Shared utilities and registry functionality
- `zod`: Runtime schema validation

### AI SDK Dependencies

- `@ai-sdk/anthropic`: Anthropic AI SDK for Claude models
- `@ai-sdk/azure`: Azure OpenAI SDK for Azure hosting
- `@ai-sdk/cerebras`: Cerebras AI SDK for LLaMA models
- `@ai-sdk/deepseek`: DeepSeek AI SDK for DeepSeek models
- `@ai-sdk/elevenlabs`: ElevenLabs SDK for speech synthesis
- `@ai-sdk/fal`: Fal AI SDK for image generation
- `@ai-sdk/google`: Google Generative AI SDK for Gemini models
- `@ai-sdk/groq`: Groq AI SDK for LLaMA inference
- `@ai-sdk/openai`: OpenAI AI SDK for GPT, Whisper, TTS models
- `@ai-sdk/openai-compatible`: OpenAI-compatible API SDK
- `@ai-sdk/perplexity`: Perplexity AI SDK for Perplexity models
- `@ai-sdk/xai`: xAI SDK for Grok models
- `@ai-sdk/provider`: Core AI SDK provider interface
- `@openrouter/ai-sdk-provider`: OpenRouter SDK for provider aggregation
- `ai`: Vercel AI SDK for streaming and client functionality
- `ollama-ai-provider-v2`: Ollama SDK for local model hosting
- `axios`: HTTP client for API requests

### Development Dependencies

- `@vitest/coverage-v8`: Code coverage
- `typescript`: TypeScript compiler
- `vitest`: Unit testing framework

## Development

The package follows the Token Ring plugin pattern:

1. **Install Phase**: Registers six service instances (registries) and optionally registers RPC endpoint
2. **Start Phase**: Initializes providers and registers models through the provider initialization chain

The package does not include streaming client implementations directly. Streaming clients are provided by the individual provider SDKs and accessed through the registries.

## License

MIT License - see LICENSE file for details.