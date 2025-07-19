/**
 * Adds memories to the input messages for the initial chat request.
 * @param {Array} messages - The input messages array to modify.
 * @param {Object} registry - The registry instance.
 */
export async function addMemories(messages ,registry) {
 /*
  * Memories are only included in first chat
  * // TODO: allow new memories to bubble to future chats
  */
 for await (const memory of registry.services.getMemories()) {
  if (memory.role === "system") {
   messages.splice(1, 0, memory);
  } else {
   messages.push(memory);
  }
 }
}