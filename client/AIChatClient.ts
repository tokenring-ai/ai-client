import type { LanguageModelV4Source, SharedV4Warning } from "@ai-sdk/provider";
import type Agent from "@tokenring-ai/agent/Agent";
import { MetricsService } from "@tokenring-ai/metrics";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import type { ModelMessage, ProviderMetadata } from "ai";
import {
  assistantModelMessageSchema,
  type GenerateObjectResult,
  type GenerateTextResult,
  generateText,
  type LanguageModel,
  type LanguageModelUsage,
  modelMessageSchema,
  Output,
  type StreamTextResult,
  streamText,
  systemModelMessageSchema,
  type ToolSet,
  toolModelMessageSchema,
  userModelMessageSchema,
} from "ai";
import { type ZodObject, z } from "zod";
import type { ModelSettings } from "../ModelTypeRegistry.ts";
import { BaseModelSpecSchema, ProviderOptionsSchema } from "./modelCapabilities.ts";

// Use the authoritative schemas from the AI SDK for chat message validation and types.
// These are fully validating and ensure exact compatibility + serializability.
export const ChatInputMessageSchema = modelMessageSchema;
export const SystemMessageSchema = systemModelMessageSchema;
export const UserMessageSchema = userModelMessageSchema;
export const AssistantMessageSchema = assistantModelMessageSchema;
export const ToolMessageSchema = toolModelMessageSchema;

export type ChatInputMessage = ModelMessage;

export const BaseChatRequestSchema = z.object({
  temperature: z.number().exactOptional(),
  seed: z.number().exactOptional(),
  topP: z.number().exactOptional(),
  topK: z.number().exactOptional(),
  frequencyPenalty: z.number().exactOptional(),
  presencePenalty: z.number().exactOptional(),
  providerOptions: ProviderOptionsSchema.prefault({}),
  instructions: z.string(),
  messages: z.array(ChatInputMessageSchema),
  parallelTools: z.boolean().exactOptional(),
});

export const AgentRequestWithToolsSchema = BaseChatRequestSchema.extend({
  type: z.literal("agent").default("agent"),
  tools: z.custom<ToolSet>(),
  prepareStep: z.custom<Parameters<typeof streamText<ToolSet, never>>[0]["prepareStep"]>().optional(),
  stopWhen: z.custom<Parameters<typeof streamText<ToolSet, never>>[0]["stopWhen"]>().optional(),
  onStepFinish: z.custom<Parameters<typeof streamText<ToolSet, never>>[0]["onStepFinish"]>().optional(),
});

export type AgentRequestWithTools<TOOLS extends ToolSet = ToolSet> = z.input<typeof AgentRequestWithToolsSchema> & {
  tools: TOOLS;
};

export type ParsedAgentRequestWithTools<TOOLS extends ToolSet = ToolSet> = z.output<typeof AgentRequestWithToolsSchema> & {
  tools: TOOLS;
};

export const GenerateRequestSchema = BaseChatRequestSchema.extend({
  type: z.literal("generate").default("generate"),
  schema: z.custom<ZodObject>(),
});

export type GenerateRequest<Schema extends ZodObject = ZodObject> = z.input<typeof GenerateRequestSchema> & {
  schema: Schema;
};

export type ParsedGenerateRequest<Schema extends ZodObject = ZodObject> = z.output<typeof GenerateRequestSchema> & {
  schema: Schema;
};

export type ChatRequest = AgentRequestWithTools | GenerateRequest;
export type ParsedChatRequest = ParsedAgentRequestWithTools | ParsedGenerateRequest;

export type RerankRequest = {
  query: string;
  documents: string[];
  topN?: number | undefined;
};

export const ChatModelSpecSchema = BaseModelSpecSchema.extend({
  impl: z.custom<Exclude<LanguageModel, string>>(),
  mangleRequest: z.custom<(req: ParsedChatRequest, settings: ModelSettings) => void>().exactOptional(),
  tools: z.boolean().default(true),
  structuredOutput: z.boolean().default(true),
  webSearch: z.boolean().exactOptional(),
  maxCompletionTokens: z.number().exactOptional(),
  maxContextLength: z.number(),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
  costPerMillionCachedInputTokens: z.number().exactOptional(),
  costPerMillionReasoningTokens: z.number().exactOptional(),
});

export type ChatModelSpec = z.input<typeof ChatModelSpecSchema>;
export type ParsedChatModelSpec = z.output<typeof ChatModelSpecSchema>;

export const SerializedChatModelSpecSchema = ChatModelSpecSchema.omit({
  impl: true,
  mangleRequest: true,
  isAvailable: true,
  isHot: true,
});

export const AIResponseCostSchema = z.object({
  input: z.number().exactOptional(),
  cachedInput: z.number().exactOptional(),
  output: z.number().exactOptional(),
  reasoning: z.number().exactOptional(),
  total: z.number().exactOptional(),
});

export type AIResponseCost = z.infer<typeof AIResponseCostSchema>;

export const AIResponseTimingSchema = z.object({
  elapsedMs: z.number(),
  tokensPerSec: z.number().exactOptional(),
  totalTokens: z.number().exactOptional(),
});

export type AIResponseTiming = z.infer<typeof AIResponseTimingSchema>;

const FinishReasonSchema = z.enum(["stop", "length", "content-filter", "tool-calls", "error", "other", "unknown"]);

export const AIResponseSchema = z.object({
  providerMetadata: z.custom<ProviderMetadata>().optional(),
  finishReason: FinishReasonSchema,
  timestamp: z.number(),
  modelId: z.string(),
  messages: z.array(ChatInputMessageSchema).exactOptional(),
  text: z.string().exactOptional(),
  lastStepUsage: z.custom<LanguageModelUsage>(),
  totalUsage: z.custom<LanguageModelUsage>(),
  cost: AIResponseCostSchema,
  timing: AIResponseTimingSchema,
  sources: z.array(z.custom<LanguageModelV4Source>()).exactOptional(),
  warnings: z.array(z.custom<SharedV4Warning>()).exactOptional(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;

const rerankSchema = z.object({
  rankings: z
    .array(
      z.object({
        index: z.number().int().describe("Original index of the document"),
        score: z.number().min(0).max(1).describe("Relevance score between 0 and 1"),
        reasoning: z.string().exactOptional().describe("Brief explanation of the relevance score"),
      }),
    )
    .describe("Ranked list of documents ordered by relevance (most relevant first)"),
});

/**
 * Chat client that relies on the Vercel AI SDK instead of the OpenAI SDK.
 * It keeps the identical public interface so it can be used as a drop-in
 * replacement for `OpenAIChatCompletionClient`.
 */
export default class AIChatClient {
  constructor(
    private readonly modelSpec: ChatModelSpec,
    private settings: ModelSettings,
  ) {}

  /**
   * Set settings for this client instance.
   */
  setSettings(settings: ModelSettings): void {
    this.settings = new Map(settings.entries());
  }

  /**
   * Get a copy of the settings.
   */
  getSettings(): ModelSettings {
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
  calculateCost({ inputTokens, outputTokens, inputTokenDetails, outputTokenDetails }: LanguageModelUsage): AIResponseCost {
    const cachedInputTokens = inputTokenDetails.cacheReadTokens;
    const reasoningTokens = outputTokenDetails.reasoningTokens;
    const inputRate = this.modelSpec.costPerMillionInputTokens / 1000000;
    const cachedInputRate = (this.modelSpec.costPerMillionCachedInputTokens ?? this.modelSpec.costPerMillionInputTokens) / 1000000;
    const outputRate = this.modelSpec.costPerMillionOutputTokens / 1000000;
    const reasoningRate = (this.modelSpec.costPerMillionReasoningTokens ?? this.modelSpec.costPerMillionOutputTokens) / 1000000;

    const input = inputTokens ? inputTokens * inputRate : undefined;
    const cachedInput = cachedInputTokens ? cachedInputTokens * cachedInputRate : undefined;
    const output = outputTokens ? outputTokens * outputRate : undefined;
    const reasoning = reasoningTokens ? reasoningTokens * reasoningRate : undefined;

    return stripUndefinedKeys({
      input,
      cachedInput,
      output,
      reasoning,
      total: (input ?? 0) + (cachedInput ?? 0) + (output ?? 0) + (reasoning ?? 0),
    });
  }

  calculateTiming(elapsedMs: number, usage: LanguageModelUsage): AIResponseTiming {
    const totalTokens =
      (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) + (usage.inputTokenDetails.cacheReadTokens ?? 0) + (usage.outputTokenDetails.reasoningTokens ?? 0);

    return stripUndefinedKeys({
      elapsedMs,
      tokensPerSec: totalTokens > 0 ? totalTokens / (elapsedMs / 1000) : undefined,
      totalTokens: totalTokens > 0 ? totalTokens : undefined,
    });
  }

  /**
   * Streams a chat completion via `streamText`, relaying every delta
   * back to the `ChatService`.
   */
  async streamChat<TOOLS extends ToolSet>(request: AgentRequestWithTools<TOOLS>, agent: Agent): Promise<AIResponse> {
    const signal = agent.getAbortSignal();

    const parsedRequest = AgentRequestWithToolsSchema.parse(request);
    parsedRequest.providerOptions = deepClone(this.modelSpec.providerOptions, parsedRequest.providerOptions);

    this.modelSpec.mangleRequest?.(parsedRequest, this.settings);

    const isHot = this.modelSpec.isHot ? await this.modelSpec.isHot() : true;

    if (!isHot) {
      agent.infoMessage("Model is not hot and will need to be cold started. Setting retries to 15...");
    }

    const start = Date.now();
    const result = streamText(
      stripUndefinedKeys({
        ...parsedRequest,
        maxRetries: 15,
        model: this.modelSpec.impl,
        abortSignal: signal,
        onError: () => {
          //TODO: If we don't have this here, errors get stupidly barfed out as unhandled rejections in the main event loop
        },
      }),
    );

    const stream = result.fullStream;

    let chunkType: "chat" | "reasoning" | null = null;
    let chunkText = "";
    let chunkEmpty = true;

    // Function to flush buffers
    const flushBuffer = (finalMessage: true | undefined) => {
      if (chunkEmpty) {
        chunkText = chunkText.trimStart();
      }

      if (chunkType && chunkText) {
        chunkEmpty = false;
        if (chunkType === "chat") {
          agent.chatOutput(chunkText);
        } else {
          agent.reasoningOutput(chunkText);
        }
        chunkText = "";
      }

      if (finalMessage) {
        chunkType = null;
        chunkEmpty = true;
        chunkText = "";
      }
    };

    // Start the flush timer (flush every 50ms)
    const flushTimer = setInterval(flushBuffer, 100);

    try {
      for await (const part of stream) {
        switch (part.type) {
          case "text-end":
          case "reasoning-end":
            {
              flushBuffer(true);
            }
            break;
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
  async textChat<TOOLS extends ToolSet>(request: AgentRequestWithTools<TOOLS>, agent: Agent): Promise<[string, AIResponse]> {
    const parsedRequest = AgentRequestWithToolsSchema.parse(request);
    parsedRequest.providerOptions = deepClone(this.modelSpec.providerOptions, parsedRequest.providerOptions);

    this.modelSpec.mangleRequest?.(parsedRequest, this.settings);

    const signal = agent.getAbortSignal();

    const start = Date.now();
    const result = await generateText(
      stripUndefinedKeys({
        ...parsedRequest,
        model: this.modelSpec.impl,
        abortSignal: signal,
      }),
    );
    const elapsedMs = Date.now() - start;

    const response = await this.generateResponseObject(result, elapsedMs);
    agent.getServiceByType(MetricsService)?.addCost(`Chat (${this.modelSpec.providerDisplayName}:${this.modelSpec.modelId})`, response.cost.total ?? 0, agent);

    return [response.text ?? "", response];
  }

  /**
   * Sends a chat completion request and returns the generated object response.
   */
  async generateObject<T extends ZodObject>(request: GenerateRequest<T>, agent: Agent): Promise<[z.infer<T>, AIResponse]> {
    const parsedRequest = GenerateRequestSchema.parse(request);
    parsedRequest.providerOptions = deepClone(this.modelSpec.providerOptions, parsedRequest.providerOptions);

    this.modelSpec.mangleRequest?.(parsedRequest, this.settings);

    const { schema, ...remaining } = parsedRequest;

    const signal = agent.getAbortSignal();

    const start = Date.now();
    const result = await generateText({
      model: this.modelSpec.impl,
      abortSignal: signal,
      ...remaining,
      output: Output.object({
        schema,
      }),
    });

    const elapsedMs = Date.now() - start;

    const response = await this.generateResponseObject(result, elapsedMs);
    agent
      .getServiceByType(MetricsService)
      ?.addCost(`GenerateObject (${this.modelSpec.providerDisplayName}:${this.modelSpec.modelId})`, response.cost.total ?? 0, agent);

    return [result.output as z.infer<T>, response];
  }

  /**
   * Generates a response object from the result.
   */
  async generateResponseObject(
    result: StreamTextResult<any, any, never> | GenerateTextResult<any, any, never> | GenerateObjectResult<any>,
    elapsedMs: number,
  ): Promise<AIResponse> {
    const responseData = await result.response;

    const totalUsage = "totalUsage" in result ? await result.totalUsage : result.usage;
    const lastStepUsage = await result.usage;

    const warnings = await result.warnings;

    return {
      timestamp: responseData.timestamp.getTime(),
      modelId: responseData.modelId,
      messages: "messages" in responseData ? responseData.messages : [],
      finishReason: await result.finishReason,
      lastStepUsage,
      totalUsage,
      cost: this.calculateCost(totalUsage),
      timing: this.calculateTiming(elapsedMs, totalUsage),
      ...("sources" in result && {
        sources: await result.sources,
      }),
      ...("text" in result && {
        text: await result.text,
      }),
      ...(warnings && { warnings }),
      providerMetadata: await result.providerMetadata,
    };
  }

  getModelSpec(): ChatModelSpec {
    return this.modelSpec;
  }

  async rerank({ query, documents, topN }: RerankRequest, agent: Agent): Promise<z.infer<typeof rerankSchema>> {
    // Format documents with indices
    const documentsText = documents.map((doc, idx) => `[${idx}] ${doc}`).join("\n\n");

    const userPrompt = `Query: ${query}

Documents to rank:
${documentsText}

Please rank these documents by their relevance to the query.`;

    const req = {
      instructions: `
You are a relevance scoring system. Your task is to evaluate how relevant each document is to the given query and rank them accordingly.

For each document:
1. Assign a relevance score between 0 (completely irrelevant) and 1 (perfectly relevant)
2. Consider semantic similarity, topic alignment, and how well the document answers or relates to the query
3. Return the documents sorted by relevance (highest score first)

Be objective and precise in your scoring.`.trim(),
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      // Create a schema for the reranking output
      schema: rerankSchema,
    } satisfies GenerateRequest<typeof rerankSchema>;

    // Use generateObject to get structured reranking results
    const [result] = await this.generateObject(req, agent);

    // Sort rankings by score (descending)
    const sortedRankings = result.rankings.sort((a, b) => b.score - a.score);

    // Apply topK if specified
    const finalRankings = topN ? sortedRankings.slice(0, topN) : sortedRankings;

    // Convert to RerankResult format
    return {
      rankings: finalRankings.map(ranking => ({
        index: ranking.index,
        score: ranking.score,
      })),
    };
  }
}
