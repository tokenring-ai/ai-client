```markdown
# @token-ring/ai-client

The `@token-ring/ai-client` module provides essential services for managing AI model interactions, storing chat messages, constructing chat requests, and offering command-line utilities for chat operations within the Token Ring ecosystem.

## Installation

As part of the Token Ring monorepo, this package is typically used as a local dependency. If it were published independently:

```bash
npm install @token-ring/ai-client
```

Ensure that its peer dependencies (like `@token-ring/registry`, `@token-ring/chat`) are also available in your project.

## Core Components

The primary components exported by this module are:

1.  `ModelRegistry`
2.  `ChatMessageStorage` (abstract base class)
3.  `EphemeralChatMessageStorage` (in-memory implementation of `ChatMessageStorage`)
4.  `createChatRequest` (function)
5.  `chatCommands` (object containing command modules)

---

### 1. ModelRegistry

The `ModelRegistry` service is responsible for managing and providing access to various AI models. It categorizes models into types (e.g., `chat`, `embedding`, `imageGeneration`) and uses `ModelTypeRegistry` instances internally to handle the specifics of each type, including model registration, feature-based filtering, and client instantiation.

**Key Properties:**

-   `chat`: A `ModelTypeRegistry` instance for managing chat models (interacts with `AIChatClient`).
-   `embedding`: A `ModelTypeRegistry` instance for managing embedding models (interacts with `AIEmbeddingClient`).
-   `imageGeneration`: A `ModelTypeRegistry` instance for managing image generation models (interacts with `AIImageGenerationClient`).

Each of these properties (`chat`, `embedding`, `imageGeneration`) provides methods to register model specifications and retrieve client instances.

**Initialization:**

The `ModelRegistry` is initialized by providing model provider implementations and configurations. Providers are responsible for populating the registry with specific model details.

```javascript
import { ModelRegistry } from '@token-ring/ai-client';
// Assume MyChatProviderImpl and MyEmbeddingProviderImpl are custom classes/objects
// that conform to the expected provider interface (having an async init(modelRegistry, config) method).

const modelRegistry = new ModelRegistry(/* constructor arguments if any */);

// Define provider implementations
const MyChatProviderImpl = {
  async init(modelRegistry, providerConfig) {
    // Example: Registering a specific chat model spec
    modelRegistry.chat.registerModelSpec('gpt-4-turbo', {
      provider: providerConfig.provider, // e.g., 'openai' passed in config
      model: 'gpt-4-turbo-2024-04-09',  // Actual model identifier for the API
      contextLength: 128000,
      costPerMillionInputTokens: 10.00,
      costPerMillionOutputTokens: 30.00,
      reasoning: 9, // Subjective capability scores
      speed: 7,
      // Function to check if the model is available (e.g., API endpoint reachable)
      isAvailable: async () => true,
      // Function to check if the model is "hot" (ready for immediate use vs. cold start)
      isHot: async () => true,
      // ... other metadata fields like 'apiKey', 'baseURL' if needed by the client
      apiKey: providerConfig.apiKey,
    });
    // Register other chat models this provider supports...
  }
};

const MyEmbeddingProviderImpl = {
  async init(modelRegistry, providerConfig) {
    modelRegistry.embedding.registerModelSpec('text-embedding-ada', {
      provider: providerConfig.provider,
      model: 'text-embedding-ada-002',
      apiKey: providerConfig.apiKey,
      // ... other relevant specs for embedding models
      isAvailable: async () => true,
      isHot: async () => true,
    });
  }
};

// Map provider codes to their implementations
const providers = {
  'my-chat-provider-code': MyChatProviderImpl,
  'my-embedding-provider-code': MyEmbeddingProviderImpl
};

// Configuration for different services/models
const config = {
  'openAIModels': { // An arbitrary key for this configuration block
    provider: 'my-chat-provider-code', // Matches a key in the 'providers' map
    apiKey: process.env.OPENAI_API_KEY,
    // other settings for this provider...
  },
  'embeddingModels': {
    provider: 'my-embedding-provider-code',
    apiKey: process.env.OPENAI_API_KEY, // Example, could be a different key
  }
};

// The initializeModels method iterates through the config. For each entry,
// it finds the corresponding provider in the 'providers' map using 'entry.provider',
// and then calls that provider's 'init(modelRegistry, entryConfig)' method.
await modelRegistry.initializeModels(providers, config);
```

**Getting an AI Client:**

To obtain an AI client instance (e.g., `AIChatClient`, `AIEmbeddingClient`), use the `getFirstOnlineClient(requirements)` method on the appropriate `ModelTypeRegistry` instance (`modelRegistry.chat`, `modelRegistry.embedding`, etc.).

-   `requirements`: Can be a string (model name) or an object specifying desired capabilities.

```javascript
// Get a chat client
try {
  // Get a specific chat model by its registered name
  const specificChatClient = await modelRegistry.chat.getFirstOnlineClient('gpt-4-turbo');
  if (specificChatClient) {
    // const response = await specificChatClient.chat({ messages: [{role: 'user', content: 'Hello!'}] });
    // console.log(response);
  }

  // Get a chat model based on desired features (refer to ChatModelRequirements typedef)
  const advancedChatClient = await modelRegistry.chat.getFirstOnlineClient({
    provider: 'my-chat-provider-code', // Optional: prefer a provider
    contextLength: '>64000',          // Model must support at least 64k context
    reasoning: '>7',                  // Reasoning score greater than 7
    // Cost is automatically considered by the internal filter for sorting eligible models.
  });

  if (advancedChatClient) {
    // Use the advancedChatClient (an instance of AIChatClient)
  }
} catch (error) {
  console.error("Could not get a chat client:", error.message);
}

// Similarly for embedding or image generation models:
// const embeddingClient = await modelRegistry.embedding.getFirstOnlineClient('text-embedding-ada');
// const imageClient = await modelRegistry.imageGeneration.getFirstOnlineClient('dall-e-3'); // If registered
```

The `ModelTypeRegistry` (e.g., `modelRegistry.chat`) also offers other methods like:
-   `registerModelSpec(modelName, metadata)`: Used by providers to register individual models.
-   `getAllModelsWithOnlineStatus()`: Returns a list of all models of that type with their availability.
-   `getModelsByProvider()`: Returns models grouped by their provider.

---

### 2. ChatMessageStorage

`ChatMessageStorage` is an abstract base class designed for services that store and retrieve chat messages. It defines a standard interface for message persistence and basic session context management within the storage instance. Implementations of this class handle the actual storage mechanism (e.g., in-memory, database).

**Key Features (Interface):**

-   `getCurrentMessage()`: Returns the currently active `ChatMessage` object, or `null`.
-   `setCurrentMessage(message)`: Sets the given `ChatMessage` as the active one. The previously current message is pushed onto an internal `previousMessages` stack (local to the storage instance, for simple undo/redo like behavior within the instance's state).
-   `popMessage()`: Restores the most recent message from the internal `previousMessages` stack to be the current message.
-   `async storeChat(currentMessage, request, response)`: **Abstract method.** Implementations should store the new chat interaction (request and response) and return the created `ChatMessage`.
-   `async retrieveMessageById(id)`: **Abstract method.** Implementations should retrieve a specific `ChatMessage` by its unique ID.

**ChatMessage Object Structure (Typical):**

```javascript
/**
 * @typedef {Object} ChatMessage
 * @property {number|string} id - Unique ID of the message record.
 * @property {number|string} sessionId - ID of the chat session this message belongs to.
 * @property {object} request - The AI request object (e.g., containing messages array, model info).
 *                              Structure often matches `import('@token-ring/chat/ChatService').Body`.
 * @property {number} cumulativeInputLength - Total byte length of the input for this turn,
 *                                            including the output length from prior messages in the chain.
 * @property {object} [response] - The AI response object (e.g., containing AI-generated messages).
 *                                 Structure often matches `import('@token-ring/chat/ChatService').Response`.
 * @property {number} updatedAt - Timestamp (milliseconds since epoch) of when this message was last updated.
 * @property {number|string} [previousMessageId] - ID of the message that immediately preceded this one in the conversation.
 */
```

---

### 3. EphemeralChatMessageStorage

`EphemeralChatMessageStorage` is a concrete implementation of `ChatMessageStorage` that stores chat messages in memory. All data is lost when the application process terminates. It's primarily useful for:

-   Development and testing scenarios.
-   Applications requiring temporary or non-persistent chat sessions.

**Usage Example:**

```javascript
import { EphemeralChatMessageStorage } from '@token-ring/ai-client';

const storage = new EphemeralChatMessageStorage();

async function demoStorage() {
  const fakeRequest = { messages: [{role: 'user', content: 'Hello, AI!'}] };
  const fakeResponse = { messages: [{role: 'assistant', content: 'Hello, User!'}] };

  // Get current message (null if new session or cleared)
  const currentMsg = storage.getCurrentMessage();

  // Store the chat interaction
  const newMessage = await storage.storeChat(currentMsg, fakeRequest, fakeResponse);
  console.log('Stored Message ID:', newMessage.id);
  console.log('Current active message after store:', storage.getCurrentMessage().id);

  // Retrieve the stored message
  const retrievedMessage = await storage.retrieveMessageById(newMessage.id);
  console.log('Retrieved Message Content:', retrievedMessage.request.messages[0].content);

  // Example of using setCurrentMessage / popMessage (internal history)
  // storage.setCurrentMessage(someOtherMessage);
  // storage.popMessage(); // Restores 'newMessage' to be the current one if 'someOtherMessage' was set.
}

demoStorage();
```

---

### 4. createChatRequest

The `createChatRequest` function is an asynchronous utility designed to construct a well-formed request object suitable for sending to an AI chat model. It intelligently assembles the request by incorporating system prompts, previous conversation context (from `ChatMessageStorage`), "memories" (for new conversations), "attention items", persona parameters, and tool configurations.

**Signature:**

`async function createChatRequest({input, systemPrompt}, registry)`

-   `params.input`: `string | ChatInput | ChatInput[]` - The user's current input message(s).
-   `params.systemPrompt`: `string | ChatInput` (Optional) - A system prompt to guide the AI's behavior.
-   `registry`: `TokenRingRegistry` - An instance of the service registry, which `createChatRequest` uses to fetch a `ChatMessageStorage` service (for conversation history) and potentially other services needed for context building (e.g., for memories, tools).

**Key Actions During Request Building:**

1.  Retrieves the previous message from the registered `ChatMessageStorage` service to maintain conversation continuity.
2.  Includes the system prompt if provided.
3.  If it's the beginning of a conversation (no previous message), it calls an internal `addMemories` function.
4.  Appends the current user `input`.
5.  Calls an internal `addAttentionItems` function to potentially add focus items to the message list.
6.  Constructs the final request object, including `maxSteps`, the assembled `messages` array, and an empty `tools` object.
7.  Calls internal `addPersonaParameters` and `addTools` functions to further modify and enrich the request.

**Example Usage:**

```javascript
import { createChatRequest, EphemeralChatMessageStorage, ModelRegistry } from '@token-ring/ai-client';
import { TokenRingRegistry } from '@token-ring/registry';
// Assume ChatService and other necessary services are also registered if your
// addMemories, addTools, etc., depend on them.

const registry = new TokenRingRegistry();
registry.register(EphemeralChatMessageStorage); // Register a ChatMessageStorage implementation
registry.register(ModelRegistry); // ModelRegistry might be needed by other parts or for client fetching

// Initialize ModelRegistry if you plan to get a client right after
// const modelRegistry = registry.requireFirstServiceByType(ModelRegistry);
// await modelRegistry.initializeModels(providers, config); // As shown in ModelRegistry section

const userInput = "What's the weather like in London?";
const systemInstruction = "You are a helpful assistant. If asked about weather, use available tools.";

async function buildAndSendRequest() {
  try {
    const aiRequest = await createChatRequest(
      { input: userInput, systemPrompt: systemInstruction },
      registry
    );

    console.log('Constructed AI Request:', JSON.stringify(aiRequest, null, 2));

    // This aiRequest object can now be sent to a compatible AI chat client
    // const chatClient = await modelRegistry.chat.getFirstOnlineClient(/* requirements */);
    // if (chatClient) {
    //   const response = await chatClient.chat(aiRequest);
    //   console.log('AI Response:', response);
    //
    //   // Store the interaction
    //   const chatMessageStorage = registry.requireFirstServiceByType(EphemeralChatMessageStorage);
    //   await chatMessageStorage.storeChat(
    //      chatMessageStorage.getCurrentMessage(), // previous message context for linking
    //      aiRequest,
    //      response
    //   );
    // }
  } catch (error) {
    console.error("Error in chat process:", error);
  }
}

buildAndSendRequest();
```

---

### 5. chatCommands

The module exports a `chatCommands` object. This object serves as a namespace for command-line style utilities designed for interacting with chat services. These commands are typically intended for use in environments like a CLI tool, a bot framework, or a chat interface that processes slash-commands.

To function correctly, these commands usually require certain services to be available in the `TokenRingRegistry` they are executed with. These often include:
-   `ChatService` (from `@token-ring/chat`): For managing chat state like current model, system prompts.
-   `HumanInterfaceService` (from `@token-ring/chat`): For interactive prompts (like model selection).
-   `ModelRegistry` (from this module): To access available models.

**Available Commands:**

#### `chatCommands.model`

-   **Description:** `/model [model_name]` - Sets or shows the target model for the chat session.
-   **Function Signature:** `async function execute(remainder, registry)`
-   **Behavior:**
    -   If `[model_name]` (the `remainder`) is provided (e.g., `/model gpt-4-turbo`), it attempts to set this as the active model in the `ChatService`.
    -   If no `model_name` is provided (e.g., `/model`), it uses the `HumanInterfaceService` to display an interactive tree selection of available models. Models are grouped by provider and show their online/offline/cold status, fetched from `ModelRegistry`.
-   **Help:** The module also exports a `help()` function that returns detailed usage instructions.

#### `chatCommands.chat`

-   **Description:** `/chat [message]` - Sends the provided message to the configured chat service.
-   **Function Signature:** `async function execute(remainder, registry)`
-   **Behavior:**
    -   Takes the `[message]` (the `remainder`) as input.
    -   If no message is provided, it usually prompts the user.
    -   It then uses an internal `runChat` function (which itself uses `createChatRequest` and an AI client from `ModelRegistry`) to send the message to the currently selected model, using the system instructions configured in `ChatService`.
    -   After the chat interaction, it typically displays token usage and timing information.
-   **Help:** This module also exports a `help()` function for usage details.

**Conceptual Invocation Example:**

This is a simplified illustration of how these commands might be integrated and executed:

```javascript
// --- Setup (Conceptual: in your CLI tool or bot) ---
// import { chatCommands, ModelRegistry, EphemeralChatMessageStorage } from '@token-ring/ai-client';
// import { TokenRingRegistry } from '@token-ring/registry';
// import ChatService from '@token-ring/chat/ChatService';
// import { HumanInterfaceService, ConsoleHumanInterface } from '@token-ring/chat'; // Assuming ConsoleHumanInterface

// const registry = new TokenRingRegistry();

// // Register necessary services
// registry.register(ChatService);
// registry.register(ModelRegistry);
// registry.register(EphemeralChatMessageStorage);
// registry.register(ConsoleHumanInterface); // Or your specific HumanInterfaceService impl

// // Initialize ModelRegistry (load model definitions, etc.)
// const modelRegistry = registry.requireFirstServiceByType(ModelRegistry);
// // await modelRegistry.initializeModels( ... ); // Critical step

// // --- Command Execution (Conceptual) ---
// async function handleCommand(commandString) {
//   const [cmd, ...args] = commandString.trim().split(' ');
//   const remainder = args.join(' ');

//   if (cmd === '/model') {
//     await chatCommands.model.execute(remainder, registry);
//   } else if (cmd === '/chat') {
//     await chatCommands.chat.execute(remainder, registry);
//   } else {
//     console.log(`Unknown command: ${cmd}`);
//   }
// }

// // Simulate user input
// // await handleCommand('/model'); // Shows interactive selection
// // await handleCommand('/model gpt-4-turbo');
// // await handleCommand('/chat Hello, how are you?');
```
