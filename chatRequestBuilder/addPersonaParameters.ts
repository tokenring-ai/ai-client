import {ChatService} from "@token-ring/chat";
import {Registry} from "@token-ring/registry";
import type {ChatRequest} from "../client/AIChatClient.js";

type Request = ChatRequest & { [key: string]: unknown };


/**
 * Adds temperature and top_p parameters from the current persona to the request object
 * @param request - The request object to modify
 * @param registry - The TokenRing registry
 */
export function addPersonaParameters(request: Request, registry: Registry): void {
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