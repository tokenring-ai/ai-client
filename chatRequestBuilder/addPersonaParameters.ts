import {ChatService} from "@token-ring/chat";
import {Registry} from "@token-ring/registry";
import type {ChatRequest} from "../client/AIChatClient.js";


/**
 * Adds temperature and topP parameters from the current persona to the request object
 */
export function addPersonaParameters(request: ChatRequest, registry: Registry): void {
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

  // Add topP if available
  if (personaConfig.topP !== undefined) {
    request.topP = personaConfig.topP;
  }
}