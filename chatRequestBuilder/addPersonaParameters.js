import {ChatService} from "@token-ring/chat";

/**
 * Adds temperature and top_p parameters from the current persona to the request object
 * @param {Object} request - The request object to modify
 * @param {TokenRingRegistry} registry
 */
export function addPersonaParameters(request,registry) {
 const chatService = registry.requireFirstServiceByType(ChatService);

 const persona = chatService.getPersona();
 if (!persona) return;

 const personas = chatService.getPersonas();
 if (!personas || !personas[persona]) return;

 const personaConfig = personas[persona];

 // Add temperature if available
 if (personaConfig.temperature !== undefined) {
  request.temperature = personaConfig.temperature;
 }

 // Add top_p if available
 if (personaConfig.top_p !== undefined) {
  request.top_p = personaConfig.top_p;
 }
}