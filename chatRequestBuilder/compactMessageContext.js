/**
 * @typedef {{ role: string, content: string}} ChatInput
 */

function _compactMessageContext(messages) {
	// Context Compaction Logic
	// TODO: Replace message count with token count for more accurate compaction in the future.
	const defaultMaxContextMessages = 20;
	const MAX_CONTEXT_MESSAGES =
		Number.parseInt(process.env.MAX_CONTEXT_MESSAGES, 10) ||
		defaultMaxContextMessages;

	if (messages.length > MAX_CONTEXT_MESSAGES) {
		const systemMessages = messages.filter((msg) => msg.role === "system");
		const nonSystemMessages = messages.filter((msg) => msg.role !== "system");

		const messagesToKeepCount = MAX_CONTEXT_MESSAGES - systemMessages.length;

		if (messagesToKeepCount <= 0) {
			// This case should ideally not happen if MAX_CONTEXT_MESSAGES is reasonably set.
			// If it does, it means we only have space for system messages or less.
			// For now, we'll just keep all system messages.
			messages = [...systemMessages];
		} else {
			// Keep the most recent non-system messages
			const recentNonSystemMessages = nonSystemMessages.slice(
				-messagesToKeepCount,
			);
			messages = [...systemMessages, ...recentNonSystemMessages];
		}
	}
	return messages;
}
