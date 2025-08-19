import ChatService from "@token-ring/chat/ChatService";
import {Registry} from "@token-ring/registry";
import {abandon} from "@token-ring/utility/abandon";
import {z} from "zod";
import ChatMessageStorage from "./ChatMessageStorage.js";
import {createChatRequest} from "./chatRequestBuilder/createChatRequest.js";
import {AIResponse, ChatInputMessage} from "./client/AIChatClient.js";
import {ModelRegistry} from "./index.js";

/**
 * Types for the chat parameters
 */
type ExecuteParams = {
  input: string | ChatInputMessage | ChatInputMessage[];
  systemPrompt?: string | ChatInputMessage;
  model: string;
}


/**
 * runChat tool: Runs a chat with the AI model, combining streamChat and runChat functionality.
 */
export async function execute(
  {input, systemPrompt, model}: ExecuteParams,
  registry: Registry
): Promise<[string, AIResponse]> {
  const chatService = registry.requireFirstServiceByType<ChatService>(ChatService);
  const chatMessageStorage = registry.requireFirstServiceByType<ChatMessageStorage>(ChatMessageStorage);
  const modelRegistry = registry.requireFirstServiceByType<ModelRegistry>(ModelRegistry);

  if (!model) {
    throw new Error("[runChat] No model parameter received");
  }

  const currentMessage = chatMessageStorage.getCurrentMessage();


  const request = await createChatRequest({input, systemPrompt}, registry);

  try {
    chatService.emit("waiting", "Waiting for an an online model to respond...");
    const client = await modelRegistry.chat.getFirstOnlineClient(model);
    chatService.emit("doneWaiting", null);

    if (!client) throw new Error(`No online client found for model ${model}`);

    chatService.systemLine(`[runChat] Using model ${client.getModelId()}`);

    chatService.emit("waiting", "Waiting for response from AI...");
    const [output, response] = await client.streamChat(request, registry);
    chatService.emit("doneWaiting", null);

    chatService.emit("doneWaiting", null);

    // Store the response object (now returned by streamChat)
    const chatMessage = await chatMessageStorage.storeChat(
      currentMessage,
      request,
      response
    );

    // Update the current message to follow up to the previous
    chatMessageStorage.setCurrentMessage(chatMessage);

    const finalOutput: string = output ?? "";

    await registry.hooks.executeHooks("afterChatCompletion", finalOutput, response);

    return [finalOutput, response]; // Return the full response object
  } catch (err: unknown) {
    chatMessageStorage.setCurrentMessage(currentMessage);
    chatService.warningLine(
      "OpenAI response cancelled, restoring prior chat state."
    );
    throw err;
  }
}

export const description =
  "Runs a chat with the AI model, combining streamChat and runChat functionality.";

export const inputSchema = z.object({
  input: z.array(z.any()).describe("The message content to send to the chat. Can be a string or a properly formatted message array."),
  systemPrompt: z.string().describe("System prompt to send to the AI."),
  model: z.string().describe("AI Model to use"),
}).required().strict();