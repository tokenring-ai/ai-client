import {LanguageModelV2CallWarning, LanguageModelV2Source, LanguageModelV2Usage} from "@ai-sdk/provider";
import Agent from "@tokenring-ai/agent/Agent";

import {
  AssistantModelMessage,
  generateObject,
  generateText,
  GenerateTextResult,
  LanguageModel,
  StopCondition,
  streamText,
  StreamTextResult,
  SystemModelMessage,
  type Tool,
  ToolModelMessage,
  UserModelMessage
} from "ai";

export type ChatInputMessage = SystemModelMessage | UserModelMessage | AssistantModelMessage | ToolModelMessage;

export type ChatRequest = {
  tools: Record<string, Tool>;
  stopWhen?: StopCondition<any> | undefined;
  messages: ChatInputMessage[];
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
  parallelTools?: boolean;
  _toolQueue?: any;
};

export type GenerateRequest = {
  schema: import('zod').ZodTypeAny;
} & ChatRequest;

export type ChatModelSpec = {
  providerDisplayName: string;
  contextLength: number;
  costPerMillionInputTokens: number;
  costPerMillionOutputTokens: number;
  costPerMillionCachedInputTokens?: number;
  costPerMillionReasoningTokens?: number;
  impl: Exclude<LanguageModel, string>;
  isAvailable: () => Promise<boolean>;
  isHot?: () => Promise<boolean>;
  mangleRequest?: (req: ChatRequest) => void;
  research?: number;
  reasoningText?: number;
  tools?: number;
  intelligence?: number;
  speed?: number;
  webSearch?: number;
  maxCompletionTokens?: number;
};

export type AIResponse = {
  providerMetadata: any;
  finishReason: "stop" | "length" | "content-filter" | "tool-calls" | "error" | "other" | "unknown";
  timestamp: number;
  modelId: string;
  messages?: ChatInputMessage[];
  text?: string;
  usage: LanguageModelV2Usage;
  cost: AIResponseCost;
  timing: AIResponseTiming;
  sources?: LanguageModelV2Source[];
  warnings?: LanguageModelV2CallWarning[];
  //[key: string]: any;
};

export type AIResponseCost = {
  input?: number;
  cachedInput?: number;
  output?: number;
  reasoning?: number;
  total?: number;
};

export type AIResponseTiming = {
  elapsedMs: number;
  tokensPerSec?: number;
  totalTokens?: number;
};

/**
 * Chat client that relies on the Vercel AI SDK instead of the OpenAI SDK.
 * It keeps the identical public interface so it can be used as a drop-in
 * replacement for `OpenAIChatCompletionClient`.
 */
export default class AIChatClient {
  private readonly modelSpec: ChatModelSpec;

  constructor(modelSpec: ChatModelSpec) {
    this.modelSpec = modelSpec;
  }

  /**
   * Get the model ID.
   */
  getModelId() {
    return this.modelSpec.impl.modelId;
  }

  /**
   * Calculate the cost for a given usage object (promptTokens, completionTokens)
   * using the pricing info from modelSpec (prefers .pricing, falls back to legacy fields).
   * Returns a number (cost in USD or provider's currency).
   */
  calculateCost({inputTokens, outputTokens, cachedInputTokens, reasoningTokens}: LanguageModelV2Usage): AIResponseCost {
    const inputRate = this.modelSpec.costPerMillionInputTokens / 1000000;
    const cachedInputRate = (this.modelSpec.costPerMillionCachedInputTokens ?? this.modelSpec.costPerMillionInputTokens) / 1000000;
    const outputRate = this.modelSpec.costPerMillionOutputTokens / 1000000;
    const reasoningRate = (this.modelSpec.costPerMillionReasoningTokens ?? this.modelSpec.costPerMillionOutputTokens) / 1000000;

    const input = inputTokens ? inputTokens * inputRate : undefined;
    const cachedInput = cachedInputTokens ? cachedInputTokens * cachedInputRate : undefined;
    const output = outputTokens ? outputTokens * outputRate : undefined;
    const reasoning = reasoningTokens ? reasoningTokens * reasoningRate : undefined;

    return {
      input,
      cachedInput,
      output,
      reasoning,
      total:
        (input ?? 0) +
        (cachedInput ?? 0) +
        (output ?? 0) +
        (reasoning ?? 0),
    };
  }

  calculateTiming(elapsedMs: number, usage: LanguageModelV2Usage): AIResponseTiming {
    const totalTokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) +
      (usage.cachedInputTokens ?? 0) + (usage.reasoningTokens ?? 0);

    return {
      elapsedMs,
      tokensPerSec: totalTokens > 0 ? (totalTokens / (elapsedMs / 1000)) : undefined,
      totalTokens: totalTokens > 0 ? totalTokens : undefined
    };
  }


  /**
   * Streams a chat completion via `streamText`, relaying every delta
   * back to the `ChatService`.
   */
  async streamChat(request: ChatRequest, agent: Agent): Promise<[string | undefined, AIResponse]> {
    const signal = agent.getAbortSignal();

    if (this.modelSpec.mangleRequest) {
      request = {...request};
      this.modelSpec.mangleRequest(request);
    }

    const isHot = this.modelSpec.isHot ? await this.modelSpec.isHot() : true;

    if (!isHot) {
      agent.infoLine(
        "Model is not hot and will need to be cold started. Setting retries to 15...",
      );
    }


    const start = Date.now();
    const result = streamText({
      ...request,
      maxRetries: 15,
      model: this.modelSpec.impl,
      abortSignal: signal,
    });

    let mode = "text";

    const stream = result.fullStream;
    for await (const part of stream) {
      switch (part.type) {
        case 'text-delta': {
          agent.chatOutput(part.text);
          break;
        }
        case "reasoning-delta": {
          agent.reasoningOutput(part.text);
          break;
        }
        case "finish": {
          agent.chatOutput("\n");
          break;
        }
        case "error": {
          throw new Error(part.error as any ?? "Unknown error");
        }
      }
    }

    const elapsedMs = Date.now() - start;

    const response = await this.generateResponseObject(result, elapsedMs);

    return [response.text, response];
  }

  /**
   * Sends a chat completion request and returns the full text response.
   */
  async textChat(request: ChatRequest, agent: Agent): Promise<[string, AIResponse]> {
    if (this.modelSpec.mangleRequest) {
      request = {...request};
      this.modelSpec.mangleRequest(request);
    }

    const signal = agent.getAbortSignal();

    const start = Date.now();
    const result = await generateText({
      ...request,
      model: this.modelSpec.impl,
      abortSignal: signal,
    });
    const elapsedMs = Date.now() - start;

    const response = await this.generateResponseObject(result, elapsedMs);
    return [response.text ?? "", response];
  }

  /**
   * Sends a chat completion request and returns the generated object response.
   */
  async generateObject(request: GenerateRequest, agent: Agent): Promise<[any, AIResponse]> {
    if (this.modelSpec.mangleRequest) {
      request = {...request};
      this.modelSpec.mangleRequest(request);
    }

    const signal = agent.getAbortSignal();

    const start = Date.now();
    const result = await generateObject({
      model: this.modelSpec.impl,
      abortSignal: signal,
      ...request,
    });
    const end = Date.now();

    const {timestamp, modelId} = result.response;

    const usage = result.usage;

    return [result.object, {
      timestamp: timestamp.getTime(),
      modelId,
      finishReason: result.finishReason,
      usage,
      cost: this.calculateCost(usage),
      timing: this.calculateTiming(end - start, usage),
      warnings: result.warnings,
      providerMetadata: result.providerMetadata,
    }];
  }

  /**
   * Generates a response object from the result.
   */
  async generateResponseObject(result: StreamTextResult<Record<string, Tool>, never> | GenerateTextResult<Record<string, Tool>, never>, elapsedMs: number): Promise<AIResponse> {

    const {timestamp, messages, modelId} = await result.response;

    const usage = await result.usage;


    return {
      timestamp: timestamp.getTime(),
      modelId,
      messages,
      finishReason: await result.finishReason,
      usage,
      cost: this.calculateCost(usage),
      timing: this.calculateTiming(elapsedMs, usage),
      sources: await result.sources,
      text: await result.text,
      warnings: await result.warnings,
      providerMetadata: await result.providerMetadata,
    };
  }

  getModelSpec() : ChatModelSpec {
    return this.modelSpec;
  }
}