import Agent from "@tokenring-ai/agent/Agent";
import AIService from "./AIService.js";
import {ChatRequestConfig, createChatRequest} from "./chatRequestBuilder/createChatRequest.ts";
import {AIResponse} from "./client/AIChatClient.ts";
import ModelRegistry from "./ModelRegistry.js";


/**
 * runChat tool: Runs a chat with the AI model, combining streamChat and runChat functionality.
 */
export default async function runChat(
  requestOptions: Omit<ChatRequestConfig, "systemPrompt"> & { systemPrompt?: ChatRequestConfig["systemPrompt"] },
  agent: Agent
): Promise<[string, AIResponse]> {
  const modelRegistry = agent.requireFirstServiceByType<ModelRegistry>(ModelRegistry);
  const aiService = agent.requireFirstServiceByType(AIService);


  const currentMessage = aiService.getCurrentMessage(agent);

  const defaultRequestOptions = aiService.getAIConfig(agent);
  const model = aiService.getModel();


  const request = await createChatRequest({...defaultRequestOptions, ...requestOptions}, agent);

  try {
    const client = await agent.busyWhile(
      "Waiting for an an online model to respond...",
      modelRegistry.chat.getFirstOnlineClient(model)
    );

    if (!client) throw new Error(`No online client found for model ${model}`);

    agent.infoLine(`[runChat] Using model ${client.getModelId()}`);

    const [output, response] = await agent.busyWhile(
      "Waiting for response from AI...",
      client.streamChat(request, agent)
    );


    // Update the current message to follow up to the previous
    aiService.pushChatMessage({
      request,
      response,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }, agent);

    const finalOutput: string = output ?? "";

    await agent.executeHooks("afterChatCompletion", finalOutput, response);

    return [finalOutput, response]; // Return the full response object
  } catch (err: unknown) {
    agent.warningLine(
      "AI request cancelled, restoring prior chat state."
    );
    throw err;
  }
}