import {ChatService} from "@token-ring/chat";
import {Registry} from "@token-ring/registry";
import {Tool, tool as aiTool} from "ai";
import async from "async";
import {ChatRequest} from "../client/AIChatClient.js";

/**
 * Builds the AI SDK `tools` object by iterating over the active tool
 * tools registered in the current registry.
 */
export async function addTools(request: ChatRequest, registry: Registry): Promise<void> {
  for (const {
    name,
    description,
    execute,
    inputSchema
  } of registry.tools.iterateActiveTools()) {
    if (typeof execute !== "function") {
      throw new Error(`Tool '${name}' is missing an execute function`);
    }
    const options: Tool = {
      description,
      inputSchema,
      execute: async (args: Record<string, any>, _meta: any) => {
        const chatService = registry.requireFirstServiceByType(ChatService);

        const executeToolFunction = async (): Promise<string> => {
          try {
            chatService.systemLine(`Calling tool ${name}`);
            const value = await execute(args, registry);
            return typeof value === 'string'
              ? value
              : JSON.stringify(value, null, 1)
              ;
          } catch (err: any) {
            chatService.errorLine(
              `Error calling tool ${name}(${JSON.stringify(args)}): ${err}`,
            );
            return `Error calling tool: ${err.message || err}. Please check your tool call for correctness and retry the function call.`;
          }
        };

        // Execute based on parallelTools flag
        if (request.parallelTools === true) {
          // Execute immediately for parallel execution
          return await executeToolFunction();
        } else {
          const toolQueue = (request._toolQueue ??= async.queue(
            async (task: () => Promise<string | object>) => task(),
            1,
          ));

          return await toolQueue.push(executeToolFunction);
        }
      },
    };
    const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
    request.tools[sanitizedName] = aiTool(options);
  }
}