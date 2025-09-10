import Agent from "@tokenring-ai/agent/Agent";
import {Tool, tool as aiTool} from "ai";
import async from "async";
import {ChatRequest} from "../client/AIChatClient.js";

/**
 * Builds the AI SDK `tools` object by iterating over the active tool
 * tools registered in the current agent.
 */
export async function addTools(request: ChatRequest, agent: Agent): Promise<void> {
  const activeTools = Object.values(agent.tools.getActiveItemEntries());

  for (const {
    name,
    description,
    execute,
    inputSchema
  } of activeTools) {
    const options: Tool = {
      description,
      inputSchema,
      execute: async (args: Record<string, any>, _meta: any) => {

        const executeToolFunction = async (): Promise<string> => {
          try {
            agent.infoLine(`Calling tool ${name}`);
            const value = await execute(args, agent);
            return typeof value === 'string'
              ? value
              : JSON.stringify(value, null, 1)
              ;
          } catch (err: any) {
            agent.errorLine(
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