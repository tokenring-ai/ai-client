import type {
  LanguageModelV2CallWarning,
  LanguageModelV2Source,
  LanguageModelV2Usage,
  LanguageModelV3Source, SharedV3Warning,
} from "@ai-sdk/provider";
import Agent from "@tokenring-ai/agent/Agent";

import {
  type AssistantModelMessage,
  generateObject, GenerateObjectResult,
  generateText,
  type GenerateTextResult,
  type LanguageModel,
  type StopCondition,
  streamText,
  type StreamTextResult,
  type SystemModelMessage,
  type Tool,
  type ToolModelMessage,
  type UserModelMessage,
} from "ai";
import {z, ZodObject} from "zod";
import type {FeatureOptions, ModelSpec} from "../ModelTypeRegistry.js";

export type ChatInputMessage =
  | SystemModelMessage
  | UserModelMessage
  | AssistantModelMessage
  | ToolModelMessage;

export type ChatRequest = {
  prepareStep?: Parameters<typeof streamText>[0]["prepareStep"];
  stopWhen?: Parameters<typeof streamText>[0]["stopWhen"];
  tools: Record<string, Tool>;
  messages: ChatInputMessage[];
  parallelTools?: boolean;
  _toolQueue?: any;
  providerOptions?: any;
};

export type RerankRequest = {
  query: string;
  documents: string[];
  topN?: number;
}

export type GenerateRequest<T extends ZodObject> = {
  schema: T;
} & ChatRequest;

export type ChatModelSpec = ModelSpec & {
  impl: Exclude<LanguageModel, string>;
  mangleRequest?: (
    req: ChatRequest,
    features: FeatureOptions,
  ) => void;
  speed?: number;
  research?: number;
  reasoningText?: number;
  tools?: number;
  intelligence?: number;
  maxCompletionTokens?: number;
  contextLength: number;
  costPerMillionInputTokens: number;
  costPerMillionOutputTokens: number;
  costPerMillionCachedInputTokens?: number;
  costPerMillionReasoningTokens?: number;
};

export type AIResponse = {
  providerMetadata: any;
  finishReason:
    | "stop"
    | "length"
    | "content-filter"
    | "tool-calls"
    | "error"
    | "other"
    | "unknown";
  timestamp: number;
  modelId: string;
  messages?: ChatInputMessage[];
  text?: string;
  usage: LanguageModelV2Usage;
  cost: AIResponseCost;
  timing: AIResponseTiming;
  sources?: LanguageModelV3Source[];
  warnings?: SharedV3Warning[];
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


const rerankSchema = z.object({
  rankings: z.array(
    z.object({
      index: z.number().int().describe("Original index of the document"),
      score: z.number().min(0).max(1).describe("Relevance score between 0 and 1"),
      reasoning: z.string().optional().describe("Brief explanation of the relevance score"),
    })
  ).describe("Ranked list of documents ordered by relevance (most relevant first)"),
})

/**
 * Chat client that relies on the Vercel AI SDK instead of the OpenAI SDK.
 * It keeps the identical public interface so it can be used as a drop-in
 * replacement for `OpenAIChatCompletionClient`.
 */
export default class AIChatClient {
  private readonly modelSpec: ChatModelSpec;
  private features: FeatureOptions = {};

  constructor(modelSpec: ChatModelSpec, features: typeof this.features = {}) {
    this.modelSpec = modelSpec;
    this.features = features;
  }

  /**
   * Sets enabled features on this client instance. Does not mutate the modelSpec.
   */
  setFeatures(features: FeatureOptions | undefined): void {
    this.features = {...(features ?? {})};
  }

  /**
   * Returns a copy of the enabled features for this client instance.
   */
  getFeatures(): Record<string, any> {
    return {...this.features};
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
  calculateCost({
                  inputTokens,
                  outputTokens,
                  cachedInputTokens,
                  reasoningTokens,
                }: LanguageModelV2Usage): AIResponseCost {
    const inputRate = this.modelSpec.costPerMillionInputTokens / 1000000;
    const cachedInputRate =
      (this.modelSpec.costPerMillionCachedInputTokens ??
        this.modelSpec.costPerMillionInputTokens) / 1000000;
    const outputRate = this.modelSpec.costPerMillionOutputTokens / 1000000;
    const reasoningRate =
      (this.modelSpec.costPerMillionReasoningTokens ??
        this.modelSpec.costPerMillionOutputTokens) / 1000000;

    const input = inputTokens ? inputTokens * inputRate : undefined;
    const cachedInput = cachedInputTokens
      ? cachedInputTokens * cachedInputRate
      : undefined;
    const output = outputTokens ? outputTokens * outputRate : undefined;
    const reasoning = reasoningTokens
      ? reasoningTokens * reasoningRate
      : undefined;

    return {
      input,
      cachedInput,
      output,
      reasoning,
      total:
        (input ?? 0) + (cachedInput ?? 0) + (output ?? 0) + (reasoning ?? 0),
    };
  }

  calculateTiming(
    elapsedMs: number,
    usage: LanguageModelV2Usage,
  ): AIResponseTiming {
    const totalTokens =
      (usage.inputTokens ?? 0) +
      (usage.outputTokens ?? 0) +
      (usage.cachedInputTokens ?? 0) +
      (usage.reasoningTokens ?? 0);

    return {
      elapsedMs,
      tokensPerSec:
        totalTokens > 0 ? totalTokens / (elapsedMs / 1000) : undefined,
      totalTokens: totalTokens > 0 ? totalTokens : undefined,
    };
  }

  /**
   * Streams a chat completion via `streamText`, relaying every delta
   * back to the `ChatService`.
   */
  async streamChat(
    request: ChatRequest,
    agent: Agent,
  ): Promise<[string, AIResponse]> {
    const signal = agent.getAbortSignal();

    if (this.modelSpec.mangleRequest) {
      request = {...request};
      this.modelSpec.mangleRequest(request, this.features);
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
      experimental_context: {agent},
    });

    const stream = result.fullStream;
    for await (const part of stream) {
      switch (part.type) {
        case "text-delta": {
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
          throw new Error((part.error as any) ?? "Unknown error");
        }
      }
    }

    const elapsedMs = Date.now() - start;

    const response = await this.generateResponseObject(result, elapsedMs);
    agent.addCost(`Chat (${this.modelSpec.providerDisplayName}:${this.modelSpec.modelId})`, response.cost.total ?? 0);

    return [response.text ?? '', response];
  }

  /**
   * Sends a chat completion request and returns the full text response.
   */
  async textChat(
    request: ChatRequest,
    agent: Agent,
  ): Promise<[string, AIResponse]> {
    if (this.modelSpec.mangleRequest) {
      request = {...request};
      this.modelSpec.mangleRequest(request, this.features);
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
    agent.addCost(`Chat (${this.modelSpec.providerDisplayName}:${this.modelSpec.modelId})`, response.cost.total ?? 0);

    return [response.text ?? "", response];
  }

  /**
   * Sends a chat completion request and returns the generated object response.
   */
  async generateObject<T extends ZodObject>(
    request: GenerateRequest<T>,
    agent: Agent,
  ): Promise<[z.infer<typeof request.schema>, AIResponse]> {
    if (this.modelSpec.mangleRequest) {
      request = {...request};
      this.modelSpec.mangleRequest(request, this.features);
    }

    const signal = agent.getAbortSignal();

    const start = Date.now();
    const result = await generateObject({
      model: this.modelSpec.impl,
      abortSignal: signal,
      ...request,
    });

    const elapsedMs = Date.now() - start;

    const response = await this.generateResponseObject(result, elapsedMs);
    agent.addCost(`GenerateObject (${this.modelSpec.providerDisplayName}:${this.modelSpec.modelId})`, response.cost.total ?? 0);

    return [result.object as z.infer<typeof request.schema>, response];
  }

  /**
   * Generates a response object from the result.
   */
  async generateResponseObject(
    result:
      | StreamTextResult<Record<string, Tool>, never>
      | GenerateTextResult<Record<string, Tool>, never>
      | GenerateObjectResult<any>,
    elapsedMs: number,
  ): Promise<AIResponse> {
    const responseData = await result.response;

    const usage = await result.usage;

    return {
      timestamp: responseData.timestamp.getTime(),
      modelId: responseData.modelId,
      messages: "messages" in responseData ? responseData.messages : [],
      finishReason: await result.finishReason,
      usage,
      cost: this.calculateCost(usage),
      timing: this.calculateTiming(elapsedMs, usage),
      sources: "sources" in result ? await result.sources : undefined,
      text: "text" in result ? await result.text : undefined,
      warnings: await result.warnings,
      providerMetadata: await result.providerMetadata,
    };
  }

  getModelSpec(): ChatModelSpec {
    return this.modelSpec;
  }


  async rerank({
                 query,
                 documents,
                 topN,
               }: RerankRequest,
    agent: Agent
  ): Promise<z.infer<typeof rerankSchema>> {
    // Format documents with indices
    const documentsText = documents
      .map((doc, idx) => `[${idx}] ${doc}`)
      .join("\n\n");

    const userPrompt = `Query: ${query}

Documents to rank:
${documentsText}

Please rank these documents by their relevance to the query.`;

    const req: GenerateRequest<typeof rerankSchema> = {
      tools: {},
      messages: [{
        role: 'system',
        content: `
You are a relevance scoring system. Your task is to evaluate how relevant each document is to the given query and rank them accordingly.

For each document:
1. Assign a relevance score between 0 (completely irrelevant) and 1 (perfectly relevant)
2. Consider semantic similarity, topic alignment, and how well the document answers or relates to the query
3. Return the documents sorted by relevance (highest score first)

Be objective and precise in your scoring.`.trim()
      },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      // Create a schema for the reranking output
      schema: rerankSchema
    };
    // Use generateObject to get structured reranking results
    const [result] = await this.generateObject(req, agent);

    // Sort rankings by score (descending)
    const sortedRankings = result.rankings.sort((a: any, b: any) => b.score - a.score);

    // Apply topK if specified
    const finalRankings = topN ? sortedRankings.slice(0, topN) : sortedRankings;

    // Convert to RerankResult format
    return {
      rankings: finalRankings.map((ranking: any) => ({
        index: ranking.index,
        score: ranking.score,
      })),
    };
  }

}
