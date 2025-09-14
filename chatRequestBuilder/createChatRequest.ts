import Agent from "@tokenring-ai/agent/Agent";
import {stepCountIs} from "ai";
import AIService from "../AIService.js";
import {ChatInputMessage, ChatRequest} from "../client/AIChatClient.js";
import {addAttentionItems} from "./addAttentionItems.js";
import {addMemories} from "./addMemories.js";
import {addTools} from "./addTools.js";

export interface ChatRequestConfig {
  input: string | ChatInputMessage | ChatInputMessage[];
  systemPrompt: string | ChatInputMessage;
  includeMemories?: boolean;
  includeTools?: boolean;
  includePriorMessages?: boolean;
  maxSteps?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
}

/**
 * Creates a chat request object.
 */
export async function createChatRequest(
  {
    input,
    systemPrompt,
    includeMemories = true,
    includeTools = true,
    includePriorMessages = true,
    maxSteps = 15,
    temperature,
    topP,
    topK,
    stopSequences,
    presencePenalty,
    frequencyPenalty,
  }: ChatRequestConfig,
  agent: Agent
): Promise<ChatRequest> {
  let processedInput: ChatInputMessage[];

  if (typeof input === "string") {
    processedInput = [
      {
        role: "user",
        content: input,
      },
    ];
  } else if (!Array.isArray(input)) {
    processedInput = [input];
  } else {
    processedInput = input;
  }

  if (!(processedInput?.length > 0)) {
    throw new Error(
      "The input: parameter must be an array with a length greater than 0"
    );
  }

  let processedSystemPrompt: ChatInputMessage | undefined;
  if (typeof systemPrompt === "string") {
    processedSystemPrompt = {
      role: "system",
      content: systemPrompt,
    };
  } else {
    processedSystemPrompt = systemPrompt;
  }

  const aiService = agent.requireFirstServiceByType(AIService)

  const previousMessage = aiService.getCurrentMessage(agent);

  const messages: ChatInputMessage[] = [];
  if (processedSystemPrompt) {
    messages.push(processedSystemPrompt);
  }

  if (includePriorMessages && previousMessage) {
    let previousRequestMessages = previousMessage?.request?.messages ?? [];
    if (previousRequestMessages?.[0]?.role === "system") {
      previousRequestMessages = previousRequestMessages.slice(1);
    }

    const previousResponseMessages = previousMessage?.response?.messages ?? [];

    messages.push(...previousRequestMessages, ...previousResponseMessages);
  } else {
    if (includeMemories) {
      await addMemories(messages, agent);
    }
  }

  messages.push(...processedInput);

  if (includeMemories && !includePriorMessages) {
    const lastMessage = messages.pop();
    await addAttentionItems(messages, agent);
    if (lastMessage) {
      messages.push(lastMessage);
    }
  }

  //messages = compactMessageContext(messages);

  const request: ChatRequest = {
    messages,
    tools: {},
    stopWhen: stepCountIs(maxSteps),
    temperature,
    topP,
    topK,
    stopSequences,
    presencePenalty,
    frequencyPenalty,
  };

  if (includeTools) {
    await addTools(request, agent);
  }

  return request;
}