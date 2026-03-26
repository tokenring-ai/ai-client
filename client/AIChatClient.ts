import type {LanguageModelV2Usage, LanguageModelV3Source, SharedV3Warning,} from "@ai-sdk/provider";
import Agent from "@tokenring-ai/agent/Agent";
import {MetricsService} from "@tokenring-ai/metrics";

import {
  type AssistantModelMessage,
  GenerateObjectResult,
  generateText,
  type GenerateTextResult,
  type LanguageModel,
  Output,
  streamText,
  type StreamTextResult,
  type SystemModelMessage,
  type Tool,
  type ToolModelMessage,
  type UserModelMessage,
} from "ai";
import {z, ZodObject} from "zod";
import type {ChatModelSettings, ModelSpec} from "../ModelTypeRegistry.js";
import {createModelSpecSchema, type ModelInputCapabilities, ModelInputCapabilitiesSchema,} from "./modelCapabilities.ts";

export type ChatInputMessage =
  | SystemModelMessage
  | UserModelMessage
  | AssistantModelMessage
  | ToolModelMessage;

export type ChatRequest = Pick<Parameters<typeof streamText>[0],"temperature" | "seed" | "topP" | "topK" | "frequencyPenalty" | "presencePenalty" | "providerOptions"> & {
  tools: Record<string, Tool>;
  messages: ChatInputMessage[];
  parallelTools?: boolean;
  _toolQueue?: any;
};

export type RerankRequest = {
  query: string;
  documents: string[];
  topN?: number;
}

export type ChatModelSpec = ModelSpec & {
  impl: Exclude<LanguageModel, string>;
  mangleRequest?: (
    req: ChatRequest,
    settings: ChatModelSettings,
  ) => void;
  inputCapabilities?: Partial<ChatModelInputCapabilities>;
  tools?: boolean;
  structuredOutput?: boolean;
  webSearch?: boolean;
  maxCompletionTokens?: number;
  maxContextLength: number;
  costPerMillionInputTokens: number;
  costPerMillionOutputTokens: number;
  costPerMillionCachedInputTokens?: number;
  costPerMillionReasoningTokens?: number;
};

export type ChatModelInputCapabilities = ModelInputCapabilities;

export const ChatModelSpecSchema = createModelSpecSchema(ModelInputCapabilitiesSchema).extend({
  tools: z.boolean().default(true),
  structuredOutput: z.boolean().default(true),
  webSearch: z.boolean().optional(),
  maxCompletionTokens: z.number().optional(),
  maxContextLength: z.number(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  costPerMillionCachedInputTokens: z.number().optional(),
  costPerMillionReasoningTokens: z.number().optional(),
});

export function normalizeChatModelSpec(modelSpec: ChatModelSpec): ChatModelSpec {
  return ChatModelSpecSchema.parse({
    ...modelSpec,
    inputCapabilities: modelSpec.inputCapabilities ?? {},
  }) as ChatModelSpec;
}

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
  lastStepUsage: LanguageModelV2Usage;
  totalUsage: LanguageModelV2Usage;
  cost: AIResponseCost;
  timing: AIResponseTiming;
  sources?: LanguageModelV3Source[];
  warnings?: SharedV3Warning[];
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
  constructor(private readonly modelSpec: ChatModelSpec, private settings: ChatModelSettings) {
  }

  /**
   * Set settings for this client instance.
   */
  setSettings(settings: ChatModelSettings): void {
    this.settings = new Map(settings.entries());
  }

  /**
   * Get a copy of the settings.
   */
  getSettings(): ChatModelSettings {
    return new Map(this.settings.entries());
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
    request: ChatRequest & Pick<Parameters<typeof streamText>[0],"prepareStep" | "stopWhen" | "onStepFinish">,
    agent: Agent,
  ): Promise<AIResponse> {
    const signal = agent.getAbortSignal();

    if (this.modelSpec.mangleRequest) {
      request = {...request};
      this.modelSpec.mangleRequest(request, this.settings);
    }

    const isHot = this.modelSpec.isHot ? await this.modelSpec.isHot() : true;

    if (!isHot) {
      agent.infoMessage(
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
      onError: () => {
        //TODO: If we don't have this here, errors get stupidly barfed out as unhandled rejections in the main event loop
      }
    });

    const stream = result.fullStream;

    let chunkType: 'chat' | 'reasoning' | null = null;
    let chunkText = "";

    // Function to flush buffers
    const flushBuffer = (finalMessage: true | undefined) => {
      if (chunkType && chunkText) {
        if (chunkType === "chat") {
          agent.chatOutput(chunkText);
        } else {
          agent.reasoningOutput(chunkText);
        }
        chunkText = "";
      }

      if (finalMessage) {
        chunkType = null;
        chunkText = "";
      }
    };

    // Start the flush timer (flush every 50ms)
    const flushTimer = setInterval(flushBuffer, 100);

    try {
      for await (const part of stream) {
        switch (part.type) {
          case "file":
            flushBuffer(true);
            agent.artifactOutput({
              name: "Generated File",
              encoding: "base64",
              mimeType: part.file.mediaType,
              body: part.file.base64
            });
            break;
          case "text-end":
          case "reasoning-end": {
            flushBuffer(true);
          } break;
          case "text-delta": {
            if (chunkType === "chat") {
              chunkText += part.text;
            } else {
              flushBuffer(true);
              chunkType = "chat";
              chunkText = part.text;
            }
            break;
          }
          case "reasoning-delta": {
            if (chunkType === "reasoning") {
              chunkText += part.text;
            } else {
              flushBuffer(true);
              chunkType = "reasoning";
              chunkText = part.text;
            }
            break;
          }
          case "finish": {
            flushBuffer(true);
            break;
          }
          case "error": {
            flushBuffer(true);
            if (part.error) {
              throw part.error;
            } else {
              throw new Error("Unknown error while handling request");
            }
          }
        }
      }
    } finally {
      // Flush any remaining buffered content
      if (flushTimer) {
        clearInterval(flushTimer);
      }
      flushBuffer(true);

      // TODO: I don't know if we need to consume the stream after we've iterated it, but it might possibly move some promise rejections
      // to this call site, which might be better for error handling
      await result.consumeStream();
    }

    const elapsedMs = Date.now() - start;

    const response = await this.generateResponseObject(result, elapsedMs);
    agent.getServiceByType(MetricsService)?.addCost(`Chat (${this.modelSpec.providerDisplayName}:${this.modelSpec.modelId})`, response.cost.total ?? 0, agent);

    return response;
  }

  /**
   * Sends a chat completion request and returns the full text response.
   */
  async textChat(
    request: ChatRequest & Pick<Parameters<typeof generateText>[0],"prepareStep" | "stopWhen" | "onStepFinish">,
    agent: Agent,
  ): Promise<[string, AIResponse]> {
    if (this.modelSpec.mangleRequest) {
      request = {...request};
      this.modelSpec.mangleRequest(request, this.settings);
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
    agent.getServiceByType(MetricsService)?.addCost(`Chat (${this.modelSpec.providerDisplayName}:${this.modelSpec.modelId})`, response.cost.total ?? 0, agent);

    return [response.text ?? "", response];
  }

  /**
   * Sends a chat completion request and returns the generated object response.
   */
  async generateObject<T extends ZodObject>(
    request: ChatRequest & { schema: T},
    agent: Agent,
  ): Promise<[z.infer<typeof request.schema>, AIResponse]> {
    if (this.modelSpec.mangleRequest) {
      request = {...request};
      this.modelSpec.mangleRequest(request, this.settings);
    }

    const { schema, ...generateRequest } = request;

    const signal = agent.getAbortSignal();

    const start = Date.now();
    const result = await generateText({
      model: this.modelSpec.impl,
      abortSignal: signal,
      ...generateRequest,
      output: Output.object({
        schema: request.schema
      })
    });

    const elapsedMs = Date.now() - start;

    const response = await this.generateResponseObject(result, elapsedMs);
    agent.getServiceByType(MetricsService)?.addCost(`GenerateObject (${this.modelSpec.providerDisplayName}:${this.modelSpec.modelId})`, response.cost.total ?? 0, agent);

    return [result.output as z.infer<typeof request.schema>, response];
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

    const totalUsage = "totalUsage" in result ? await result.totalUsage : result.usage;
    const lastStepUsage =  await result.usage;

    return {
      timestamp: responseData.timestamp.getTime(),
      modelId: responseData.modelId,
      messages: "messages" in responseData ? responseData.messages : [],
      finishReason: await result.finishReason,
      lastStepUsage,
      totalUsage,
      cost: this.calculateCost(totalUsage),
      timing: this.calculateTiming(elapsedMs, totalUsage),
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

    const req = {
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
    } satisfies ChatRequest & { schema: typeof rerankSchema };

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
