import {v4 as uuid} from "uuid";
import ChatMessageStorage, {StoredChatMessage} from "./ChatMessageStorage.js";
import {AIResponse, ChatRequest} from "./client/AIChatClient.js";

/**
 * Session object representing a chat session
 */
interface Session extends Record<string, unknown> {
  /** Unique session identifier */
  id: string;
}

/**
 * An in-memory implementation of ChatMessageStorage that stores chat messages
 * temporarily in memory. All data is lost when the process terminates.
 *
 * This implementation is suitable for:
 * - Development and testing
 * - Temporary chat sessions
 * - Applications that don't require persistent chat history
 */
export default class EphemeralChatMessageStorage extends ChatMessageStorage {
  /** Current active session */
  session: Session | null = null;

  /** In-memory storage for chat messages */
  messages: Map<string, StoredChatMessage> = new Map();

  /**
   * Stores a chat message in memory.
   *
   */
  async storeChat(
    currentMessage: StoredChatMessage | null,
    request: ChatRequest,
    response: AIResponse
  ): Promise<StoredChatMessage> {
    let sessionId = currentMessage?.sessionId;

    // Create a new session if we don't have one
    if (!sessionId) {
      this.createSession();
      if (!this.session) {
        throw new Error("Failed to create session");
      }
      sessionId = this.session.id;
    }

    // Create the new message
    const message = {
      id: uuid(),
      sessionId,
      request,
      response,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      previousMessageId: currentMessage?.id || null,
    };

    // Store the message in our in-memory map
    this.messages.set(message.id, message);

    // Update the current message
    this.setCurrentMessage(message);

    return message;
  }

  /**
   * Retrieves a message by its ID from memory.
   *
   */
  async retrieveMessageById(
    id: string
  ): Promise<StoredChatMessage> {
    const message = this.messages.get(id);
    if (!message) {
      throw new Error(`Message with id ${id} not found`);
    }
    return message;
  }

  /**
   * Creates a new chat session with a unique identifier.
   */
  private createSession(): void {
    this.session = {
      id: uuid(),
    };
  }
}