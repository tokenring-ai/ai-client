/**
 * @typedef {Object} ChatMessage
 * @property {number|string} id - The ID of the record
 * @property {number|string} sessionId - The ID of the session
 * @property {import('@token-ring/chat/ChatService').Body} request - The AI request
 * @property {number} cumulativeInputLength - The byte length of the input, including the output length from prior messages
 * @property {import('@token-ring/chat/ChatService').Response} [response] - The response from AI
 * @property {number} updatedAt - The update time in milliseconds since the epoch format
 * @property {number} [previousMessageId] - The ID of the previous message in the conversation chain
 */
/**
 * Abstract base class for chat message storage implementations.
 * Provides the interface for storing and retrieving chat messages and sessions.
 *
 * @abstract
 * @extends Service
 */
export default class ChatMessageStorage extends Service {
    session: any;
    /** @type {Array<import('core/ai-client/ChatMessageStorage.js').ChatMessage>} */
    previousMessages: Array<any>;
    /** @type {import('core/ai-client/ChatMessageStorage.js').ChatMessage|null} */
    currentMessage: any | null;
    /**
     * Gets the current active message.
     * @returns {import('core/ai-client/ChatMessageStorage.js').ChatMessage|null} The current message or null if no message is active
     */
    getCurrentMessage(): any | null;
    /**
     * Sets the current active message, moving the previous current message to history if it exists.
     * This allows for maintaining a stack of messages for undo/redo operations.
     *
     * @param {import('core/ai-client/ChatMessageStorage.js').ChatMessage} message - The message to set as current
     * @returns {void}
     */
    setCurrentMessage(message: any): void;
    /**
     * Restores the most recent message from history as the current message.
     * This provides undo functionality by popping the last message from the history stack.
     *
     * @returns {void}
     */
    popMessage(): void;
    /**
     * Stores a new chat request, typically starting a new conversation session.
     *
     * @abstract
     * @param {import('core/ai-client/ChatMessageStorage.js').ChatMessage|null} currentMessage - The current message
     * @param {import('@token-ring/chat/ChatService').Body} request - The request object
     * @param {import('@token-ring/chat/ChatService').Response} response - The response object
     * @returns {Promise<ChatMessage>}
     */
    storeChat(_currentMessage: any, _request: any, _response: any): Promise<ChatMessage>;
    /**
     * Retrieves a message by its ID.
     *
     * @abstract
     * @param {number|string} id - The message ID
     * @returns {Promise<ChatMessage>} The retrieved message
     */
    retrieveMessageById(_id: any): Promise<ChatMessage>;
}
export type ChatMessage = {
    /**
     * - The ID of the record
     */
    id: number | string;
    /**
     * - The ID of the session
     */
    sessionId: number | string;
    /**
     * - The AI request
     */
    request: import("@token-ring/chat/ChatService").Body;
    /**
     * - The byte length of the input, including the output length from prior messages
     */
    cumulativeInputLength: number;
    /**
     * - The response from AI
     */
    response?: import("@token-ring/chat/ChatService").Response;
    /**
     * - The update time in milliseconds since the epoch format
     */
    updatedAt: number;
    /**
     * - The ID of the previous message in the conversation chain
     */
    previousMessageId?: number;
};
import { Service } from "@token-ring/registry";
