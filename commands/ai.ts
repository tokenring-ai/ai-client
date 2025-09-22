import Agent from "@tokenring-ai/agent/Agent";
import AIService from "../AIService.js";
import {createChatRequest} from "../chatRequestBuilder/createChatRequest.js";

export const description: string =
  "/ai settings key=value [key=value...] - Update AI configuration settings | /ai context - Show context items";

export async function execute(remainder: string, agent: Agent): Promise<void> {
  const aiService = agent.requireServiceByType(AIService);
  
  if (!remainder?.trim()) {
    // Show current settings
    const config = aiService.getAIConfig(agent);
    agent.infoLine("Current AI settings:");
    Object.entries(config).forEach(([key, value]) => {
      agent.infoLine(`  ${key}: ${value}`);
    });
    return;
  }

  const parts = remainder.trim().split(/\s+/);
  
  if (parts[0] === "context") {
    await showContext(agent);
    return;
  }
  
  if (parts[0] !== "settings") {
    agent.errorLine("Usage: /ai settings key=value [key=value...] | /ai context");
    return;
  }

  const updates: Record<string, any> = {};
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const [key, value] = part.split("=");
    
    if (!key || value === undefined) {
      agent.errorLine(`Invalid format: ${part}. Use key=value`);
      continue;
    }

    // Parse value based on key type
    let parsedValue: any = value;
    if (key === "temperature" || key === "topP" || key === "frequencyPenalty" || key === "presencePenalty") {
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) {
        agent.errorLine(`Invalid number for ${key}: ${value}`);
        continue;
      }
    } else if (key === "maxTokens") {
      parsedValue = parseInt(value);
      if (isNaN(parsedValue)) {
        agent.errorLine(`Invalid integer for ${key}: ${value}`);
        continue;
      }
    } else if (key === "stopSequences") {
      parsedValue = value.split(",");
    }

    updates[key] = parsedValue;
  }

  if (Object.keys(updates).length > 0) {
    aiService.updateAIConfig(updates, agent);
    agent.infoLine(`Updated AI settings: ${Object.keys(updates).join(", ")}`);
  }
}

async function showContext(agent: Agent): Promise<void> {
  try {
    const aiService = agent.requireServiceByType(AIService);
    const config = aiService.getAIConfig(agent);

    debugger;
    const request = await createChatRequest({
      input: "dummy input",
      systemPrompt: config.systemPrompt,
      includeContextItems: true,
      includeTools: false,
      includePriorMessages: true
    }, agent);
    
    agent.infoLine("Context items that would be added to chat request:");
    agent.infoLine(`Total messages: ${request.messages.length}`);
    
    request.messages.slice(0,-1).forEach((msg, index) => {
      const content = typeof msg.content === 'string' ?
        msg.content
          ? (Array.isArray(msg.content) ? msg.content[0].text : msg.content)
          : msg.content
        : JSON.stringify(msg.content);
      const preview = content.length > 100 ? content.substring(0, 130) + '...' : content;
      agent.infoLine(`${index + 1}. [${msg.role}] ${preview}`);
    });
  } catch (error) {
    agent.errorLine(`Error building context: ${error}`);
  }
}

export function help(): string[] {
  return [
    "/ai settings key=value [key=value...]",
    "  - Update AI configuration settings",
    "  - Available keys: model, systemPrompt, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, stopSequences",
    "  - Examples: /ai settings temperature=0.7 topP=0.9",
    "  - With no arguments: Shows current settings",
    "/ai context",
    "  - Show all context items that would be added to a chat request",
  ];
}