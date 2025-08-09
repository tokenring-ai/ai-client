/**
 * @typedef {Object} Session
 * @property {string} id - Unique session identifier
 */
/**
 * An in-memory implementation of ChatMessageStorage that stores chat messages
 * temporarily in memory. All data is lost when the process terminates.
 *
 * This implementation is suitable for:
 * - Development and testing
 * - Temporary chat sessions
 * - Applications that don't require persistent chat history
 *
 * @extends ChatMessageStorage
 */
export default class EphemeralChatMessageStorage extends ChatMessageStorage {
    /** @type {Session|null} */
    session: Session | null;
    /** @type {Map<string, import('./ChatMessageStorage.js').ChatMessage>} */
    messages: Map<string, import("./ChatMessageStorage.js").ChatMessage>;
    /**
     * Creates a new chat session with a unique identifier.
     * @private
     * @returns {void}
     */
    private createSession;
    /**
     * Stores a chat message in memory.
     *
     * @param {import('./ChatMessageStorage.js').ChatMessage|null} currentMessage - The current chat message.
     * @param {import('@token-ring/chat/ChatService').Body} request - The request object to store.
     * @param {import('@token-ring/chat/ChatService').Response} response - The response object to store.
     * @returns {Promise<import('./ChatMessageStorage.js').ChatMessage>} The stored message.
     */
    storeChat(currentMessage: import("./ChatMessageStorage.js").ChatMessage | null, request: import("@token-ring/chat/ChatService").Body, response: import("@token-ring/chat/ChatService").Response): Promise<import("./ChatMessageStorage.js").ChatMessage>;
    /**
     * Retrieves a message by its ID from memory.
     *
     * @param {number|string} id - The message ID.
     * @returns {Promise<import('./ChatMessageStorage.js').ChatMessage>} The retrieved message.
     * @throws {Error} When message is not found.
     */
    retrieveMessageById(id: number | string): Promise<import("./ChatMessageStorage.js").ChatMessage>;
}
export type Session = {
    /**
     * - Unique session identifier
     */
    id: string;
};
import ChatMessageStorage from "./ChatMessageStorage.js";
