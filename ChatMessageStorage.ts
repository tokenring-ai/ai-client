import {TokenRingService} from "@tokenring-ai/agent/types";
import {AIResponse, ChatRequest} from "./client/AIChatClient.js";

export interface StoredChatSession {
  id: string;
  title: string;
  createdAt: number;
}

/**
 * Represents a chat message in the storage system
 */
export interface StoredChatMessage {
  /** The ID of the record */
  id: string;
  /** The ID of the session */
  sessionId: string;
  /** The AI request */
  request: ChatRequest;
  /** The response from AI */
  response?: AIResponse;
  /** The creation time in milliseconds since the epoch format */
  createdAt: number;
  /** The update time in milliseconds since the epoch format */
  updatedAt: number;
  /** The ID of the previous message in the conversation chain */
  previousMessageId?: string | null;
}

/**
 * Abstract base class for chat message storage implementations.
 * Provides the interface for storing and retrieving chat messages and sessions.
 *
 */
export default abstract class ChatMessageStorage implements TokenRingService {
  name = "ChatMessageStorage";
  description = "Abstract base class for chat message storage implementations";

  /** The current session data */
  session: Record<string, unknown> | null = null;

  /** History of previous messages */
  previousMessages: StoredChatMessage[] = [];

  /** The current active message */
  currentMessage: StoredChatMessage | null = null;

  /**
   * Gets the current active message.
   */
  getCurrentMessage(): StoredChatMessage | null {
    return this.currentMessage;
  }

  /**
   * Sets the current active message, moving the previous current message to history if it exists.
   * This allows for maintaining a stack of messages for undo/redo operations.
   *
   */
  setCurrentMessage(message: StoredChatMessage | null): void {
    // Only push to history when replacing an existing message with a new non-null message
    if (this.currentMessage && message) {
      this.previousMessages.push(this.currentMessage);
    }
    this.currentMessage = message;
  }

  /**
   * Restores the most recent message from history as the current message.
   * This provides undo functionality by popping the last message from the history stack.
   *
   */
  popMessage(): void {
    if (this.previousMessages.length > 0) {
      this.currentMessage = this.previousMessages.pop() ?? null;
    } else {
      this.currentMessage = null;
    }
  }

  /**
   * Stores a new chat request, typically starting a new conversation session.
   *
   */
  abstract storeChat(
    currentMessage: StoredChatMessage | null,
    request: ChatRequest,
    response: AIResponse
  ): Promise<StoredChatMessage>;

  /**
   * Retrieves a message by its ID.
   *
   * @abstract
   * @param id - The message ID
   * @returns Promise resolving to the retrieved message
   */
  abstract retrieveMessageById(id: number | string): Promise<StoredChatMessage>;
}