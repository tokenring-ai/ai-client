import Agent from "@tokenring-ai/agent/Agent";
import AIService from "../AIService.js";
import {createChatRequest} from "../chatRequestBuilder/createChatRequest.js";
import ModelRegistry from "../ModelRegistry.js";

export async function compactContext(agent: Agent): Promise<void> {
  const aiService = agent.requireFirstServiceByType(AIService);
  const modelRegistry = agent.requireFirstServiceByType(ModelRegistry);
  
  const messages = aiService.getChatMessages(agent);
  if (messages.length === 0) return;

  const request = await createChatRequest({
    input: `Please provide a detailed summary of the prior conversation, including all important details, context, and what was being worked on`,
    systemPrompt: "You are a helpful assistant that creates comprehensive summaries of conversations.",
    includeMemories: true,
    includeTools: false,
    includePriorMessages: true
  }, agent);

  const client = await modelRegistry.chat.getFirstOnlineClient(aiService.getModel());

  const [output, response] = await agent.busyWhile(
    "Waiting for response from AI...",
    client.streamChat(request, agent)
  );

  //Include just the system messages and the response
  request.messages = request.messages.filter(message => message.role === 'system');

  aiService.clearChatMessages(agent);

  // Update the current message to follow up to the previous
  aiService.pushChatMessage({
    request,
    response,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }, agent);

  agent.infoLine("Context compacted successfully");
}