import { Service } from "@token-ring/registry";

/**
 * @typedef {Object} ChatMessage
 * @property {number|string} id - The ID of the record
 * @property {number|string} sessionId - The ID of the session
 * @property {import('@token-ring/chat/ChatService').Body} request - The AI request
 * @property {number} cumulativeInputLength - The byte length of the input, including the output length from prior messages
 * @property {import('@token-ring/chat/ChatService').Response} [response] - The response from AI
 * @property {number} updatedAt - The update time in milliseconds since the epoch format
 * @property {number|string|null} [previousMessageId] - The ID of the previous message in the conversation chain
 */

/**
 * Abstract base class for chat message storage implementations.
 * Provides the interface for storing and retrieving chat messages and sessions.
 *
 * @abstract
 * @extends Service
 */
export default class ChatMessageStorage extends Service {
	session;

	/** @type {Array<import('./ChatMessageStorage.js').ChatMessage>} */
	previousMessages = [];

	/** @type {import('./ChatMessageStorage.js').ChatMessage|null} */
	currentMessage = null;

	/**
	 * Gets the current active message.
	 * @returns {import('./ChatMessageStorage.js').ChatMessage|null} The current message or null if no message is active
	 */
	getCurrentMessage() {
		return this.currentMessage;
	}

	/**
	 * Sets the current active message, moving the previous current message to history if it exists.
	 * This allows for maintaining a stack of messages for undo/redo operations.
	 *
	 * @param {import('./ChatMessageStorage.js').ChatMessage} message - The message to set as current
	 * @returns {void}
	 */
	setCurrentMessage(message) {
		if (this.currentMessage) {
			this.previousMessages.push(this.currentMessage);
		}
		this.currentMessage = message;
	}

	/**
	 * Restores the most recent message from history as the current message.
	 * This provides undo functionality by popping the last message from the history stack.
	 *
	 * @returns {void}
	 */
	popMessage() {
		if (this.previousMessages.length > 0) {
			this.currentMessage = this.previousMessages.pop();
		} else {
			this.currentMessage = null;
		}
	}

	/**
	 * Stores a new chat request, typically starting a new conversation session.
	 *
	 * @abstract
	 * @param {import('./ChatMessageStorage.js').ChatMessage|null} currentMessage - The current message
	 * @param {import('@token-ring/chat/ChatService').Body} request - The request object
	 * @param {import('@token-ring/chat/ChatService').Response} response - The response object
	 * @returns {Promise<ChatMessage>}
	 */
	storeChat(currentMessage, request, response) {
		// eslint-disable-line no-unused-vars
		throw new Error("Not implemented");
	}

	/**
	 * Retrieves a message by its ID.
	 *
	 * @abstract
	 * @param {number|string} id - The message ID
	 * @returns {Promise<ChatMessage>} The retrieved message
	 */
	async retrieveMessageById(id) {
		// eslint-disable-line no-unused-vars
		throw new Error("Not implemented");
	}
}
