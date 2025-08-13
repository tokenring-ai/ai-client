import {ChatService} from "@token-ring/chat";
import {tool as aiTool} from "ai";
import async from "async";
import {Registry} from "@token-ring/registry";

/**
 * Builds the AI SDK `tools` object by iterating over the active tool
 * tools registered in the current registry.
 * @param request - The chat request object to modify.
 * @param registry - The registry instance.
 */
export async function addTools(request: any, registry: Registry): Promise<void> {
    for (const {
        name,
        description,
        execute,
        parameters,
    } of registry.tools.iterateActiveTools()) {
        if (typeof execute !== "function") {
            throw new Error(`Tool '${name}' is missing an execute function`);
        }
        const options: any = {
            description,
            execute: async (args: any, _meta: any) => {
                const chatService = registry.requireFirstServiceByType(ChatService);

                // Create the tool execution function
                const executeToolFunction = async (): Promise<string | any> => {
                    try {
                        chatService.systemLine(`Calling tool ${name}`);
                        return await execute(args, registry);
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
                        async (task: () => Promise<any>) => task(),
                        1,
                    )); // Concurrency of 1 for sequential execution
                    // Add to queue for sequential execution
                    return new Promise<string | any>((resolve, reject) => {
                        toolQueue.push(executeToolFunction, (err: Error | null | undefined, result: any) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(result);
                            }
                        });
                    });
                }
            },
        };
        if (parameters) options.parameters = parameters;
        request.tools[name] = aiTool(options);
    }
}