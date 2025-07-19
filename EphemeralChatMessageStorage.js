import ChatMessageStorage from "./ChatMessageStorage.js";
import { v4 as uuid} from "uuid";

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
 session = null;

 /** @type {Map<string, import('./ChatMessageStorage.js').ChatMessage>} */
 messages = new Map();

 /**
  * Creates a new chat session with a unique identifier.
  * @private
  * @returns {void}
  */
 createSession() {
  this.session = {
   id: uuid(),
  };
 }

 /**
  * Stores a chat message in memory.
  *
  * @param {import('./ChatMessageStorage.js').ChatMessage|null} currentMessage - The current chat message.
  * @param {import('@token-ring/chat/ChatService').Body} request - The request object to store.
  * @param {import('@token-ring/chat/ChatService').Response} response - The response object to store.
  * @returns {Promise<import('./ChatMessageStorage.js').ChatMessage>} The stored message.
  */
 async storeChat(currentMessage, request, response) {
  let sessionId = currentMessage?.sessionId;

  // Create a new session if we don't have one
  if (!sessionId) {
   this.createSession();
   sessionId = this.session.id;
  }

  // Calculate cumulative input length
  let cumulativeInputLength = JSON.stringify(request.messages).length;
  if (currentMessage) {
   cumulativeInputLength += currentMessage.cumulativeInputLength +
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
   previousMessageId: currentMessage?.id || null
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
  * @param {number|string} id - The message ID.
  * @returns {Promise<import('./ChatMessageStorage.js').ChatMessage>} The retrieved message.
  * @throws {Error} When message is not found.
  */
 async retrieveMessageById(id) {
  const message = this.messages.get(id.toString());
  if (!message) {
   throw new Error(`Message with id ${id} not found`);
  }
  return message;
 }
}