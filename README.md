# AI Client Package Documentation

## Overview

The `@tokenring-ai/ai-client` package is a TypeScript library designed for the Token Ring ecosystem. It provides a unified interface for interacting with various AI providers (e.g., OpenAI, Anthropic, Google, Groq) using the Vercel AI SDK. The package supports chat completions (including streaming), embeddings, and image generation. It integrates with the `@tokenring-ai/agent` framework, managing AI configurations, model selection, chat history, and request building with features like tools, memories, and attention items.

Key features:
- **Model Registry**: Automatically selects and routes requests to appropriate models based on requirements (e.g., context length, cost, capabilities like reasoning or tools).
- **Multi-Provider Support**: Pre-configured specs for providers like OpenAI (GPT series), Anthropic (Claude), Google (Gemini), and more.
- **Request Building**: Constructs chat requests with system prompts, prior messages, tools, and memories.
- **Chat Management**: Handles conversation history, streaming responses, and cost/timing calculations.
- **Error Handling**: Includes retries, availability checks, and abort signals via the Agent.

The package acts as a service in the Token Ring Agent, enabling AI-driven interactions in applications like chatbots or agents.

## Installation/Setup

This package is part of the Token Ring monorepo. To build and use it:

1. Ensure Node.js (v18+) and TypeScript are installed.
2. Install dependencies: `npm install`.
3. Build: `npm run build` (compiles TypeScript to the `dist/` directory).
4. For testing: `npm test` (uses Vitest).

To use in a Token Ring Agent:
```typescript
import Agent from '@tokenring-ai/agent/Agent';
import { ModelRegistry } from '@tokenring-ai/ai-client';
// Initialize agent with AI services (see Usage Examples).
```

Provide API keys via configuration objects for each provider (e.g., `apiKey: process.env.OPENAI_API_KEY`).

## Package Structure

```
pkg/ai-client/
├── index.ts              # Main exports (ModelRegistry, createChatRequest)
├── package.json          # Package metadata and scripts
├── tsconfig.json         # TypeScript configuration
├── AIService.ts          # Manages AI config and chat history
├── ModelRegistry.ts      # Core registry for model types (chat, embedding, image)
├── runChat.ts            # Utility to run chat completions via Agent
├── chatCommands.ts       # Exports CLI-like commands (chat, model, ai)
├── client/
│   ├── AIChatClient.ts   # Chat completion client (streaming/text/object generation)
│   ├── AIEmbeddingClient.ts # Embedding generation
│   └── AIImageGenerationClient.ts # Image generation
├── models/               # Provider-specific model specs (e.g., openai.ts, anthropic.ts)
├── chatRequestBuilder/   # Helpers for building requests (createChatRequest.ts, addTools.ts, etc.)
├── commands/             # Command implementations (chat.ts, model.ts, ai.ts)
├── util/                 # Utilities (cachedDataRetriever.ts, outputChatAnalytics.ts)
└── test/                 # Vitest tests (runChat.test.js, etc.)
```

- **models/**: Each file (e.g., `openai.ts`) initializes the provider, defines model specs (costs, capabilities), and registers them.
- **client/**: Abstract clients wrapping AI SDK functions.
- Tests cover model registration, chat requests, and providers.

## Core Components

### ModelRegistry

Central service for managing AI models. Implements `TokenRingService`. Supports chat, embedding, and image generation registries.

- **Key Methods**:
  - `initializeModels(providers: Record<string, ModelProvider>, config: Record<string, ModelProviderInfo | ModelProviderInfo[]>)`: Registers providers (e.g., OpenAI, Anthropic) with API keys and display names.
  - `chat.getFirstOnlineClient(requirements: ChatModelRequirements | string)`: Selects the cheapest online model matching criteria (e.g., `{ provider: 'openai', reasoningText: '>3' }` or `'gpt-4o'`). Sorts by estimated cost.
  - `getAllModelsWithOnlineStatus()`: Lists all models with availability/hot status.
  - Similar for `embedding` and `imageGeneration`.

- **Interactions**: Providers call `registerAllModelSpecs()` during init. Filters use requirements like context length, intelligence scores (0-∞ for reasoning, speed, etc.).

**Example Model Spec** (from `openai.ts`):
```typescript
{
  providerDisplayName: 'OpenAI',
  impl: openai('gpt-4o'),
  isAvailable: async () => /* API check */,
  costPerMillionInputTokens: 5.0,
  reasoningText: 4,
  contextLength: 128000,
  // Optional: mangleRequest to add tools like web search
}
```

### AIChatClient

Handles chat interactions using AI SDK's `streamText`, `generateText`, `generateObject`.

- **Key Methods**:
  - `streamChat(request: ChatRequest, agent: Agent): Promise<[string | undefined, AIResponse]>`: Streams response, relays deltas to Agent (chat/reasoning output). Supports tools, stop conditions.
  - `textChat(request: ChatRequest, agent: Agent): Promise<[string, AIResponse]>`: Non-streaming text generation.
  - `generateObject(request: GenerateRequest, agent: Agent): Promise<[any, AIResponse]>`: Structured output via Zod schema.
  - `calculateCost(usage: LanguageModelV2Usage): AIResponseCost`: Computes USD cost based on tokens (input/output/cached/reasoning).
  - `calculateTiming(elapsedMs: number, usage: LanguageModelV2Usage): AIResponseTiming`: Tokens/sec and totals.

- **ChatRequest**: `{ messages: ChatInputMessage[], tools: Record<string, Tool>, stopWhen?: StopCondition, temperature?: number, ... }`.
- **AIResponse**: Includes `finishReason`, `usage`, `cost`, `timing`, `text`, `warnings`.

Integrates with Agent for abort signals and output.

### AIEmbeddingClient

Simple embedding generation.

- **Key Methods**:
  - `getEmbeddings({ input: string[] }): Promise<EmbedResult<string>[]>`: Generates vectors for multiple inputs.

### AIImageGenerationClient

Experimental image generation.

- **Key Methods**:
  - `generateImage(request: ImageRequest, agent: Agent): Promise<[GeneratedFile, Experimental_GenerateImageResult]>`: Generates image from prompt (e.g., `{ prompt: 'A cat', size: '1024x1024' }`).

- **ImageRequest**: `{ prompt: string, quality?: 'low'|'medium'|'high', size: 'WxH', n: number }`.

### AIService

Manages AI state in Agent (implements `TokenRingService`).

- **Key Methods**:
  - `getAIConfig(agent: Agent): AIConfig`: `{ systemPrompt, temperature, maxTokens, ... }`.
  - `updateAIConfig(partial: Partial<AIConfig>, agent: Agent)`: Updates config.
  - `pushChatMessage(message: StoredChatMessage, agent: Agent)`: Adds to history.
  - `getCurrentMessage(agent: Agent): StoredChatMessage | null`: Latest message.
  - `clearChatMessages(agent: Agent)`: Reset history.

- **StoredChatMessage**: `{ request: ChatRequest, response: AIResponse, createdAt/updatedAt: number }`.

### createChatRequest

Builds requests from config.

- **Parameters**: `{ input: string | ChatInputMessage | array, systemPrompt, includeMemories?: boolean, includeTools?: boolean, includePriorMessages?: boolean, maxSteps?: number, ... }`.
- **Process**: Adds system prompt, prior messages/memories, tools, attention items. Stops at `stepCountIs(maxSteps)`.
- **Helpers**: `addTools` (adds Agent tools), `addMemories` (injects relevant memories), `addAttentionItems` (adds focused context).

## Usage Examples

### 1. Initializing ModelRegistry and Running a Chat

```typescript
import Agent from '@tokenring-ai/agent/Agent';
import ModelRegistry from '@tokenring-ai/ai-client/ModelRegistry';
import { createOpenAI } from '@ai-sdk/openai'; // Example provider
import { init as initOpenAI } from '@tokenring-ai/ai-client/models/openai';
import runChat from '@tokenring-ai/ai-client/runChat';
import { AIConfig } from '@tokenring-ai/ai-client/AIService';

const agent = new Agent({
  ai: { systemPrompt: 'You are a helpful assistant.', temperature: 0.7 } as AIConfig,
  // Register services
});

const modelRegistry = new ModelRegistry();
await modelRegistry.initializeModels(
  { openai: { init: initOpenAI } },
  {
    openai: { providerDisplayName: 'OpenAI', apiKey: process.env.OPENAI_API_KEY }
  }
);
agent.addService(modelRegistry);

// Run chat
const [output, response] = await runChat(
  { input: 'Hello, world!', model: 'gpt-4o-mini' },
  agent
);
console.log(output); // Streamed response text
console.log(response.cost); // { input: 0.001, output: 0.002, total: 0.003 }
```

### 2. Streaming Chat with Tools

```typescript
import { createChatRequest } from '@tokenring-ai/ai-client/chatRequestBuilder/createChatRequest';
import { AIChatClient } from '@tokenring-ai/ai-client/client/AIChatClient';

const request = await createChatRequest(
  { input: 'What is the weather?', includeTools: true },
  agent
);

const client = await modelRegistry.chat.getFirstOnlineClient('gpt-4o');
const [text, aiResponse] = await client.streamChat(request, agent);
// Agent handles streaming output automatically
```

### 3. Generating Embeddings

```typescript
const embeddingClient = new AIEmbeddingClient(modelSpec); // From registry
const results = await embeddingClient.getEmbeddings({ input: ['Hello', 'World'] });
console.log(results[0].embedding); // Vector array
```

## Configuration Options

- **Provider Config**: `{ apiKey: string, providerDisplayName: string }` per provider (e.g., in `initializeModels`).
- **AIConfig**: 
  - `systemPrompt: string` – Initial instructions.
  - `forceModel?: string` – Override model selection.
  - `temperature?: number` (0-2) – Creativity.
  - `maxTokens?: number` – Output limit.
  - `topP?: number` (0-1) – Nucleus sampling.
  - `stopSequences?: string[]` – End tokens.
- **Environment Variables**: Use for API keys (e.g., `OPENAI_API_KEY`).
- **Model Requirements**: Filter with `{ provider?: string, contextLength?: number, reasoningText?: '>3' }`. Supports operators like `>`, `=`.
- **Custom Models**: Extend by adding specs in `models/` or registering via `registerModelSpec`.

## API Reference

- **Exports**:
  - `ModelRegistry`: Class for model management.
  - `createChatRequest(config: ChatRequestConfig, agent: Agent): Promise<ChatRequest>`.
  - `runChat(options: ChatRequestConfig & { systemPrompt? }, agent: Agent): Promise<[string, AIResponse]>`.
  - `AIChatClient`, `AIEmbeddingClient`, `AIImageGenerationClient`: Client classes.
  - `AIService`: State management service.

- **Types**:
  - `ChatModelRequirements`: Model filters (e.g., `{ intelligence: 5 }`).
  - `AIResponse`: Full response with cost/timing.
  - `ChatRequest`: AI SDK-compatible request.

See TypeScript definitions for full signatures.

## Dependencies

- **Core**: `ai@^5.0.15` (Vercel AI SDK), `@tokenring-ai/agent@0.1.0`.
- **Providers**: `@ai-sdk/openai@^2.0.15`, `@ai-sdk/anthropic@^2.0.4`, `@ai-sdk/google@^2.0.6`, `@ai-sdk/groq@^2.0.10`, and others (Azure, Cerebras, DeepSeek, Fal, Perplexity, XAI, OpenRouter, Ollama, Qwen).
- **Utils**: `zod@^4.0.17` (schemas), `axios@^1.11.0` (API calls), `lodash-es@^4.17.21`.
- **Dev**: `typescript@^5.9.2`, `vitest@^3.2.4`.

Full list in `package.json`.

## Contributing/Notes

- **Building/Testing**: Run `npm run build` for compilation. Tests: `npm test` or `npm run test:watch`. Coverage: `npm run test:coverage`.
- **Adding Providers**: Create a new file in `models/` exporting `init(registry, config)`, define specs, and update `ModelRegistry.initializeModels`.
- **Limitations**: 
  - Relies on AI SDK; some providers are experimental (e.g., image gen).
  - Costs are estimates; actuals vary by provider.
  - Binary files/.gitignore skipped in searches; text-only.
  - No sandboxing for shell commands (use `terminal_runShellCommand` cautiously).
- **License**: MIT (see LICENSE).
- Contributions: Fork, PR with tests. Focus on new providers or features enhancing Agent integration.

For issues, reference code in `pkg/ai-client/`.