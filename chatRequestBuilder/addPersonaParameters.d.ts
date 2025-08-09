/**
 * Adds temperature and top_p parameters from the current persona to the request object
 * @param {Object} request - The request object to modify
 * @param {TokenRingRegistry} registry
 */
export function addPersonaParameters(request: any, registry: TokenRingRegistry): void;
