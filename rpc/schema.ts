import {JsonRPCSchema} from "@tokenring-ai/web-host/jsonrpc/types";
import {z} from "zod";

export default {
  path: "/rpc/ai-client",
  methods: {
    listChatModels: {
      type: "query",
      input: z.object({
        agentId: z.string().optional()
      }),
      result: z.object({
        models: z.record(z.string(),z.object({
          status: z.string(),
          available: z.boolean(),
          hot: z.boolean(),
          modelSpec: z.any()
        }))
      })
    },
    listChatModelsByProvider: {
      type: "query",
      input: z.object({
        agentId: z.string().optional()
      }),
      result: z.object({
        modelsByProvider: z.record(z.string(),z.record(z.string(),z.object({
          status: z.string(),
          available: z.boolean(),
          hot: z.boolean(),
          modelSpec: z.any()
        })))
      })
    },
    listEmbeddingModels: {
      type: "query",
      input: z.object({
        agentId: z.string().optional()
      }),
      result: z.object({
        models: z.record(z.string(),z.object({
          status: z.string(),
          available: z.boolean(),
          hot: z.boolean(),
          modelSpec: z.any()
        }))
      })
    },
    listEmbeddingModelsByProvider: {
      type: "query",
      input: z.object({
        agentId: z.string().optional()
      }),
      result: z.object({
        modelsByProvider: z.record(z.string(),z.record(z.string(),z.object({
          status: z.string(),
          available: z.boolean(),
          hot: z.boolean(),
          modelSpec: z.any()
        })))
      })
    },
    listImageGenerationModels: {
      type: "query",
      input: z.object({
        agentId: z.string().optional()
      }),
      result: z.object({
        models: z.record(z.string(),z.object({
          status: z.string(),
          available: z.boolean(),
          hot: z.boolean(),
          modelSpec: z.any()
        }))
      })
    },
    listImageGenerationModelsByProvider: {
      type: "query",
      input: z.object({
        agentId: z.string().optional()
      }),
      result: z.object({
        modelsByProvider: z.record(z.string(),z.record(z.string(),z.object({
          status: z.string(),
          available: z.boolean(),
          hot: z.boolean(),
          modelSpec: z.any()
        })))
      })
    },
    listSpeechModels: {
      type: "query",
      input: z.object({
        agentId: z.string().optional()
      }),
      result: z.object({
        models: z.record(z.string(),z.object({
          status: z.string(),
          available: z.boolean(),
          hot: z.boolean(),
          modelSpec: z.any()
        }))
      })
    },
    listSpeechModelsByProvider: {
      type: "query",
      input: z.object({
        agentId: z.string().optional()
      }),
      result: z.object({
        modelsByProvider: z.record(z.string(),z.record(z.string(),z.object({
          status: z.string(),
          available: z.boolean(),
          hot: z.boolean(),
          modelSpec: z.any()
        })))
      })
    },
    listTranscriptionModels: {
      type: "query",
      input: z.object({
        agentId: z.string().optional()
      }),
      result: z.object({
        models: z.record(z.string(),z.object({
          status: z.string(),
          available: z.boolean(),
          hot: z.boolean(),
          modelSpec: z.any()
        }))
      })
    },
    listTranscriptionModelsByProvider: {
      type: "query",
      input: z.object({
        agentId: z.string().optional()
      }),
      result: z.object({
        modelsByProvider: z.record(z.string(),z.record(z.string(),z.object({
          status: z.string(),
          available: z.boolean(),
          hot: z.boolean(),
          modelSpec: z.any()
        })))
      })
    },
    listRerankingModels: {
      type: "query",
      input: z.object({
        agentId: z.string().optional()
      }),
      result: z.object({
        models: z.record(z.string(),z.object({
          status: z.string(),
          available: z.boolean(),
          hot: z.boolean(),
          modelSpec: z.any()
        }))
      })
    },
    listRerankingModelsByProvider: {
      type: "query",
      input: z.object({
        agentId: z.string().optional()
      }),
      result: z.object({
        modelsByProvider: z.record(z.string(),z.record(z.string(),z.object({
          status: z.string(),
          available: z.boolean(),
          hot: z.boolean(),
          modelSpec: z.any()
        })))
      })
    }
  }
} satisfies JsonRPCSchema;
