# AI Client Features

This document outlines the features of the AI client, which is built on top of the Vercel AI SDK. The client is designed to be a flexible and powerful tool for interacting with various language models.

## Core `AIChatClient` Features

The `AIChatClient` is the central component of the AI client. It provides the following features:

*   **Model Specification:** The client is initialized with a `modelSpec` object that defines the properties of the language model to be used. This includes:
    *   `provider`: The model provider (e.g., OpenAI, Anthropic).
    *   `contextLength`: The maximum context length in tokens.
    *   `costPerMillionInputTokens`: The cost per million input tokens.
    *   `costPerMillionOutputTokens`: The cost per million output tokens.
    *   `impl`: The AI SDK model implementation.

*   **Web Search:** The client can be configured to enable or disable web search capabilities. This allows the model to access information from the internet to answer queries.

*   **Cost Calculation:** The client can calculate the cost of a chat based on the number of prompt and completion tokens. This is useful for tracking and managing API usage costs.

*   **Chat Modes:** The client supports multiple chat modes:
    *   `streamChat`: Streams the chat response as it is generated, providing a real-time experience.
    *   `textChat`: Returns the full text response after it has been generated.
    *   `generateObject`: Generates a structured JSON object from the model's response, which is useful for tasks that require structured data.

*   **Request Handling:** The client can modify the request before sending it to the model. This is useful for adapting to different provider APIs that may have different request formats.

*   **Error Handling and Retries:** The client has built-in retry logic to handle model cold starts and other transient errors.

## `runChat` Tool

The `runChat.js` tool provides a high-level interface for running chats with the AI model. It integrates with the `AIChatClient` and other services to provide a complete chat experience. Its features include:

*   **Model Selection:** It can select the first available online model that matches the specified criteria.
*   **Timing and Token Calculation:** It calculates the time taken for the chat and the number of tokens per second.
*   **Chat History:** It stores the chat history, including the request, response, and any errors.
*   **Post-Chat Hooks:** It allows for the execution of post-chat hooks, which can be used to perform actions after a chat is complete.

## Chat Commands

The `chatCommands.js` file exports the chat and model commands, which are likely used to interact with the AI client from a command-line interface or a similar environment. These commands provide a convenient way to access the AI client's functionality without writing code.
