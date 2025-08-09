/**
 * Builds the AI SDK `tools` object by iterating over the active tool
 * tools registered in the current registry.
 * @param {Object} request - The chat request object to modify.
 * @param {TokenRingRegistry} registry - The registry instance.
 */
export function addTools(request: any, registry: TokenRingRegistry): Promise<void>;
