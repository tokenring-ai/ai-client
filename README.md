# AI Client Package

## Overview

The `@tokenring-ai/ai-client` package provides a unified interface for interacting with multiple AI providers through the Vercel AI SDK. It integrates with the Token Ring Agent framework to manage AI configurations, model selection, chat history, and request building.

**Key Features:**
- **Multi-Provider Support**: OpenAI, Anthropic, Google, Groq, DeepSeek, Cerebras, xAI, Perplexity, Azure, Ollama, OpenRouter, Fal, and OpenAI-compatible endpoints
- **Model Registry**: Automatic model selection based on cost, capabilities (reasoning, intelligence, speed, tools), and availability
- **Chat Management**: Conversation history, streaming responses, cost/timing analytics
- **Context Compaction**: Automatic summarization when conversations grow long
- **Multiple Modalities**: Chat completions, embeddings, and image generation

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

## Core Components

### ModelRegistry

Manages AI models across providers. Automatically installed as a service in AgentTeam.

**Key Methods:**
- `chat.getFirstOnlineClient(modelName)` - Get chat client by name
- `chat.getFirstOnlineClientByRequirements(requirements)` - Select model by capabilities
- `chat.getAllModelsWithOnlineStatus()` - List all models with status
- `chat.getModelsByProvider()` - Group models by provider
- `embedding.getFirstOnlineClient(modelName)` - Get embedding client
- `imageGeneration.getFirstOnlineClient(modelName)` - Get image generation client

**Model Requirements:**
```typescript
{
  provider?: string,           // Provider name or 'auto'
  contextLength?: number,      // Minimum context length
  reasoningText?: number,      // Reasoning capability (0-6)
  intelligence?: number,       // Intelligence level (0-6)
  speed?: number,              // Speed rating (0-6)
  tools?: number,              // Tool use capability (0-6)
  webSearch?: number           // Web search capability (0-1)
}
```

### AIService

Manages AI configuration and chat history for an Agent.

**Key Methods:**
- `getModel()` / `setModel(model)` - Get/set current model
- `getAIConfig(agent)` - Get AI configuration
- `updateAIConfig(config, agent)` - Update configuration
- `getChatMessages(agent)` - Get message history
- `pushChatMessage(message, agent)` - Add message to history
- `clearChatMessages(agent)` - Clear history
- `getCurrentMessage(agent)` - Get latest message
- `popMessage(agent)` - Remove latest message

**AIConfig:**
```typescript
{
  systemPrompt: string | ((agent: Agent) => string),
  temperature?: number,        // 0-2, default varies by model
  maxTokens?: number,
  topP?: number,              // 0-1
  topK?: number,
  frequencyPenalty?: number,  // -2 to 2
  presencePenalty?: number,   // -2 to 2
  stopSequences?: string[],
  autoCompact?: boolean       // Auto-compact long contexts
}
```

### AIChatClient

Handles chat completions with streaming support.

**Key Methods:**
- `streamChat(request, agent)` - Stream chat response
- `textChat(request, agent)` - Non-streaming chat
- `generateObject(request, agent)` - Structured output with Zod schema
- `calculateCost(usage)` - Calculate USD cost
- `calculateTiming(elapsedMs, usage)` - Calculate throughput

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

## Supported Providers

| Provider | Chat | Embeddings | Images | Notes |
|----------|------|------------|--------|-------|
| OpenAI | ✅ | ✅ | ✅ | GPT-4.1, GPT-5, O3, O4-mini |
| Anthropic | ✅ | ❌ | ❌ | Claude 3.5, 4, 4.1 |
| Google | ✅ | ❌ | ✅ | Gemini 2.5 Pro/Flash, web search |
| xAI | ✅ | ❌ | ✅ | Grok 3, 4, code models |
| DeepSeek | ✅ | ❌ | ❌ | DeepSeek Chat, Reasoner |
| Groq | ✅ | ❌ | ❌ | Fast inference, Llama models |
| Cerebras | ✅ | ❌ | ❌ | Ultra-fast inference |
| Perplexity | ✅ | ❌ | ❌ | Sonar models with web search |
| Azure | ✅ | ❌ | ❌ | Azure OpenAI Service |
| Ollama | ✅ | ✅ | ❌ | Local models |
| OpenRouter | ✅ | ❌ | ❌ | Access to many providers |
| Fal | ❌ | ❌ | ✅ | Image generation |
| OpenAI-Compatible | ✅ | ✅ | ❌ | Custom endpoints |

## Model Capabilities

Models are rated 0-6 for various capabilities:

- **reasoningText**: Logical reasoning and problem-solving
- **intelligence**: General knowledge and understanding
- **tools**: Ability to use function calling/tools
- **speed**: Inference speed (higher = faster)
- **webSearch**: Built-in web search capability (0 or 1)

## Context Compaction

When conversations grow long, the package can automatically compact context:

```typescript
// Enable auto-compact
aiService.updateAIConfig({ autoCompact: true }, agent);

// Manual compact
import { compactContext } from '@tokenring-ai/ai-client/util/compactContext';
await compactContext(agent);
```

Compaction creates a summary of the conversation, reducing token usage while preserving important context.

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
bun test                  # Run tests
bun run test:watch        # Watch mode
bun run test:coverage     # Coverage report
```

## License

MIT License - see LICENSE file for details.
