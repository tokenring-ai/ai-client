import { v4 as uuid } from "uuid";
import ChatMessageStorage, { ChatMessage } from "./ChatMessageStorage.js";
import type { Body, Response } from "@token-ring/chat/ChatService";

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
    messages: Map<string, import('./ChatMessageStorage.js').ChatMessage> = new Map();

    /**
     * Creates a new chat session with a unique identifier.
     * @private
     */
    private createSession(): void {
        this.session = {
            id: uuid(),
        };
    }

    /**
     * Stores a chat message in memory.
     *
     * @param currentMessage - The current chat message.
     * @param request - The request object to store.
     * @param response - The response object to store.
     * @returns The stored message.
     */
    async storeChat(
        currentMessage: ChatMessage | null,
        request: Body,
        response: Response
    ): Promise<ChatMessage> {
        let sessionId = currentMessage?.sessionId;

        // Create a new session if we don't have one
        if (!sessionId) {
            this.createSession();
            if (!this.session) {
                throw new Error("Failed to create session");
            }
            sessionId = this.session.id;
        }

        // Calculate cumulative input length
        let cumulativeInputLength = JSON.stringify(request.messages).length;
        if (currentMessage) {
            cumulativeInputLength +=
                currentMessage.cumulativeInputLength +
                JSON.stringify(currentMessage.response || {}).length;
        }

        // Create the new message
        const message = {
            id: uuid(),
            sessionId,
            request,
            response,
            cumulativeInputLength,
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
     * @param id - The message ID.
     * @returns The retrieved message.
     * @throws Error When message is not found.
     */
    async retrieveMessageById(
        id: number | string
    ): Promise<ChatMessage> {
        const message = this.messages.get(id.toString());
        if (!message) {
            throw new Error(`Message with id ${id} not found`);
        }
        return message;
    }
}