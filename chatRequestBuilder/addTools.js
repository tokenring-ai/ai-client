import { ChatService } from "@token-ring/chat";
import { tool as aiTool } from "ai";

/**
 * Builds the AI SDK `tools` object by iterating over the active tool
 * tools registered in the current registry.
 * @param {Object} request - The chat request object to modify.
 * @param {TokenRingRegistry} registry - The registry instance.
 */
export async function addTools(request, registry) {
	for (const {
		name,
		description,
		execute,
		parameters,
	} of registry.tools.iterateActiveTools()) {
		request.tools[name] = aiTool({
			description,
			parameters,

			execute: async (args, _meta) => {
				const chatService = registry.requireFirstServiceByType(ChatService);

				try {
					chatService.systemLine(`Calling tool ${name}`);
					return await execute(args, registry);
				} catch (err) {
					chatService.errorLine(
						`Error calling tool ${name}(${JSON.stringify(args)}): ${err}`,
					);
					return `Error calling tool: ${err.message || err}. Please check your tool call for correctness and retry the function call.`;
				}
			},
		});
	}
}
