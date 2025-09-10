# @tokenring-ai/ai-client

The `@tokenring-ai/ai-client` module provides essential services for managing AI model interactions, storing chat
messages, constructing chat requests, and offering command-line utilities for chat operations within the Token Ring
ecosystem.

## Installation

As part of the Token Ring monorepo, this package is typically used as a local dependency. If it were published
independently:

```bash
npm install @tokenring-ai/ai-client
```

Ensure that its peer dependencies (like `@tokenring-ai/registry`, `@tokenring-ai/chat`) are also available in your project.

## Core Components

The primary components exported by this module are:

1. `ModelRegistry`
2. `ChatMessageStorage` (abstract base class)
3. `EphemeralChatMessageStorage` (in-memory implementation of `ChatMessageStorage`)
4. `createChatRequest` (function)
5. `runChat` (function)
6. `chatCommands` (object containing command modules)

---

### 1. ModelRegistry

The `ModelRegistry` service is responsible for managing and providing access to various AI models. It categorizes models
into types (e.g., `chat`, `embedding`, `imageGeneration`) and uses `ModelTypeRegistry` instances internally to handle
the specifics of each type, including model registration, feature-based filtering, and client instantiation.

**Supported Model Types:**

- `chat`: Text generation models (via `AIChatClient`)
- `embedding`: Text embedding models (via `AIEmbeddingClient`)
- `imageGeneration`: Image generation models (via `AIImageGenerationClient`)

**Supported Providers:**

- OpenAI (GPT-4.1, o3, o4-mini, etc.)
- Anthropic (Claude 4, Claude 3.7, etc.)
- Google (Gemini 1.5, 2.5 Pro, etc.)
- DeepSeek (deepseek-chat, deepseek-reasoner)
- Groq (Llama 3.3, Gemma 2, etc.)
- xAI (Grok-2, Grok-3, etc.)
- Perplexity (sonar, sonar-pro, etc.)
- Cerebras (Llama 70B, etc.)
- Qwen (qwen-max, qwen-plus, etc.)
- OpenRouter (dynamic model registry)
- Ollama (local models)
- VLLM (self-hosted models)
- Llama (via Llama API)

**Initialization:**

```javascript
import {ModelRegistry} from '@tokenring-ai/ai-client';
import * as providers from '@tokenring-ai/ai-client/models';

const modelRegistry = new ModelRegistry();

const config = {
 openai: {
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
 },
 anthropic: {
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
 },
 // Add more providers as needed
};

await modelRegistry.initializeModels(providers, config);
```

**Getting an AI Client:**

```javascript
// Get a specific chat model
const client = await modelRegistry.chat.getFirstOnlineClient('gpt-4.1');

// Get a model by capabilities
const advancedClient = await modelRegistry.chat.getFirstOnlineClient({
 reasoning: '>5',
 contextLength: '>64000',
 speed: '>3'
});

// Get embedding client
const embeddingClient = await modelRegistry.embedding.getFirstOnlineClient('text-embedding-ada-002');

// Get image generation client
const imageClient = await modelRegistry.imageGeneration.getFirstOnlineClient('gpt-image-1');
```

---

### 2. ChatMessageStorage

`ChatMessageStorage` is an abstract base class designed for services that store and retrieve chat messages. It defines a
standard interface for message persistence and basic session context management.

**Key Features:**

- Message storage and retrieval
- Conversation chain management
- Session context tracking
- Undo/redo functionality via message stack

**ChatMessage Structure:**

```javascript
{
 id: string,                    // Unique message identifier
  sessionId
:
 string,            // Conversation session ID
  request
:
 {                     // User's request
  messages: Array < {role, content} >,
   model ? : string,
   tools ? : object
 }
,
 response ? : {                   // AI's response
  messages: Array < {role, content} >,
  usage? : {promptTokens, completionTokens, cost},
  timing? : {elapsedMs, tokensPerSec}
 },
  cumulativeInputLength
:
 number, // Total input context length
  updatedAt
:
 number,             // Timestamp
  previousMessageId ? : string    // Link to previous message
}
```

---

### 3. EphemeralChatMessageStorage

`EphemeralChatMessageStorage` is a concrete implementation that stores messages in memory. All data is lost when the
process terminates.

**Usage:**

```javascript
import {EphemeralChatMessageStorage} from '@tokenring-ai/ai-client';

const storage = new EphemeralChatMessageStorage();

// Store a message
const message = await storage.storeChat(
 currentMessage,
 {messages: [{role: 'user', content: 'Hello'}]},
 {messages: [{role: 'assistant', content: 'Hi there!'}]}
);

// Retrieve by ID
const retrieved = await storage.retrieveMessageById(message.id);

// Get current conversation
const current = storage.getCurrentMessage();
```

---

### 4. createChatRequest

`createChatRequest` is an async utility that constructs well-formed requests for AI chat models, incorporating
conversation history, system prompts, memories, tools, and persona parameters.

**Features:**

- Automatic conversation history inclusion
- System prompt integration
- Memory and attention item management
- Tool registration
- Persona parameter injection
- Context compaction

**Usage:**

```javascript
import {createChatRequest, EphemeralChatMessageStorage} from '@tokenring-ai/ai-client';

const registry = new TokenRingRegistry();
registry.register(EphemeralChatMessageStorage);

const request = await createChatRequest({
 input: "What's the weather like?",
 systemPrompt: "You are a helpful weather assistant.",
 includePriorMessages: true,
 includeTools: true,
 includeMemories: true
}, registry);
```

---

### 5. runChat

`runChat` is a high-level utility that combines model selection, request building, streaming, and response storage into
a single operation.

**Usage:**

```javascript
import {runChat} from '@tokenring-ai/ai-client';

const [responseText, response] = await runChat({
 input: "Explain quantum computing",
 systemPrompt: "Be concise and use analogies.",
 model: "gpt-4.1"
}, registry);

console.log(responseText);
console.log(`Cost: ${response.usage?.cost}`);
console.log(`Time: ${response.timing?.elapsedMs}ms`);
```

---

### 6. chatCommands

Command-line utilities for interactive chat operations. These are designed for CLI tools or chat interfaces.

**Available Commands:**

#### `/model [model_name]`

- Set or show the current AI model
- Interactive tree selection when no model provided
- Shows online/offline status for all models

#### `/chat [message]`

- Send a message to the current AI model
- Displays token usage and timing information

**Usage Example:**

```javascript
import {chatCommands} from '@tokenring-ai/ai-client';

// In a CLI context
await chatCommands.model.execute('', registry); // Show model selection
await chatCommands.model.execute('gpt-4.1', registry); // Set specific model
await chatCommands.chat.execute('Hello, how are you?', registry);
```

---

## Configuration

### Environment Variables

Most providers support configuration via environment variables:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google
GOOGLE_API_KEY=...

# Groq
GROQ_API_KEY=gsk_...

# DeepSeek
DEEPSEEK_API_KEY=sk-...
```

### Custom Provider Configuration

```javascript
const config = {
 openai: {
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1' // Optional
 },
 ollama: {
  provider: 'ollama',
  baseURL: 'http://localhost:11434',
  generateModelSpec: (modelInfo) => ({ /* custom spec */})
 }
};
```

---

## Advanced Features

### Cost Tracking

All clients include built-in cost calculation:

```javascript
const client = await modelRegistry.chat.getFirstOnlineClient('gpt-4.1');
const cost = client.calculateCost({
 promptTokens: 1000,
 completionTokens: 500
});
console.log(`Cost: $${cost.toFixed(4)}`);
```

### Model Filtering

Sophisticated filtering for model selection:

```javascript
const client = await modelRegistry.chat.getFirstOnlineClient({
 provider: 'openai',
 reasoning: '>5',
 contextLength: '>100000',
 costPerMillionInputTokens: '<5',
 webSearch: 1
});
```

### Tool Integration

Extensible tool system with lifecycle hooks:

```javascript
// Tools are automatically integrated via the registry
const request = await createChatRequest({
 input: "What's the weather in Tokyo?",
 includeTools: true
}, registry);
```

---

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Adding New Providers

1. Create a new file in `models/[provider-name].js`
2. Implement the `init(modelRegistry, config)` function
3. Register models using `modelRegistry.chat.registerModelSpec()`
4. Export from `models.js`

Example provider structure:

```javascript
export async function init(modelRegistry, config) {
 if (!config.apiKey) throw new Error('API key required');

 const chatModels = {
  'my-model': {
   provider: 'my-provider',
   impl: myProvider('model-name'),
   isAvailable: async () => true,
   costPerMillionInputTokens: 1.0,
   costPerMillionOutputTokens: 2.0,
   contextLength: 128000
  }
 };

 await modelRegistry.chat.registerAllModelSpecs(chatModels);
}
```