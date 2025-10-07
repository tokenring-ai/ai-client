import {createOpenAICompatible} from "@ai-sdk/openai-compatible";
import {z} from "zod";
import type {ChatModelSpec} from "../client/AIChatClient.ts";
import type {EmbeddingModelSpec as EmbeddingModelSpec} from "../client/AIEmbeddingClient.ts";
import ModelRegistry from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

export type OAICompatibleModelConfigFunction = (
	modelInfo: ModelListData,
) => ModelConfigResults;

export const OAICompatibleModelConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseURL: z.string(),
  generateModelSpec: z.function({
    input: z.tuple([z.any()]),
    output: z.object({
      type: z.string(),
      capabilities: z.record(z.string(), z.any()).optional(),
    })
  }).optional(),
});

export type OAICompatibleModelConfig = z.infer<typeof OAICompatibleModelConfigSchema>;


function defaultModelSpecGenerator(modelInfo: ModelListData) : ModelConfigResults {
  let {id} = modelInfo;
  let type = "chat";
  if (id.match(/embed/i)) {
    type = "embedding";
  }
  return {type};
}

type ModelConfigResults = {
	type: string;
	capabilities?: Record<string, any>;
};
type ModelListData = {
	id: string;
	object: "model";
	owned_by: "organization" | "openai";
	created: number;
	max_model_len?: number;
	meta?: {
		n_ctx_train?: 131072;
	};
};

type ModelListResponse = {
	object: "list";
	data: ModelListData[];
};

export async function init(
  providerDisplayName: string,
	modelRegistry: ModelRegistry,
	config: OAICompatibleModelConfig,
) {
  let {baseURL, apiKey, generateModelSpec} = config;
	if (!baseURL) {
		throw new Error(
			`No config.baseURL provided for ${providerDisplayName} provider.`,
		);
	}
  generateModelSpec ??= defaultModelSpecGenerator;

	const chatModelSpecs: ChatModelSpec[] = [];
	const embeddingModelSpecs: EmbeddingModelSpec[] = [];

	const openai = createOpenAICompatible({
    name: providerDisplayName,
		baseURL,
    apiKey: apiKey ?? "",
	});

	const getModelList = cachedDataRetriever(`${baseURL}/models`, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		cacheTime: 60000,
		timeout: 5000,
	}) as () => Promise<ModelListResponse>;

	getModelList()
		.then((modelList) => {
			if (!modelList?.data) return;

			for (const modelInfo of modelList.data) {
				const { type, capabilities = {} } = generateModelSpec(modelInfo);

				if (type === "chat") {
					chatModelSpecs.push({
						modelId: modelInfo.id,
            providerDisplayName: providerDisplayName,
						impl: openai.chatModel(modelInfo.id),
						isAvailable: () => getModelList().then((data) => !!data),
						isHot: () => Promise.resolve(true),
						costPerMillionInputTokens: 0,
						costPerMillionOutputTokens: 0,
						contextLength:
							modelInfo.max_model_len ?? modelInfo?.meta?.n_ctx_train ?? 4000,
						...capabilities,
					});
				} else if (type === "embedding") {
					embeddingModelSpecs.push({
						modelId: modelInfo.id,
            providerDisplayName: providerDisplayName,
						contextLength: capabilities.contextLength || 8192,
						costPerMillionInputTokens:
							capabilities.costPerMillionInputTokens || 0,
						impl: openai.textEmbeddingModel(modelInfo.id),
						isAvailable: () => getModelList().then((data) => !!data),
						isHot: () => Promise.resolve(true),
					});
				}
			}

			modelRegistry.chat.registerAllModelSpecs(chatModelSpecs);
			modelRegistry.embedding.registerAllModelSpecs(embeddingModelSpecs);
		})
		.catch((e) => {});
}
