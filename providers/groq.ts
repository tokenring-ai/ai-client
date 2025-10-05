import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import type { ChatModelSpec } from "../client/AIChatClient.ts";
import ModelRegistry from "../ModelRegistry.ts";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";

export const GroqModelProviderConfigSchema = z.object({
	apiKey: z.string(),
});

export type GroqModelProviderConfig = z.infer<
	typeof GroqModelProviderConfigSchema
>;

interface Model {
	id: string;
	object: "model";
	created: number;
	owned_by: string;
}

interface ModelList {
	object: "list";
	data: Model[];
}

export async function init(
	providerDisplayName: string,
	modelRegistry: ModelRegistry,
	config: GroqModelProviderConfig,
) {
	if (!config.apiKey) {
		throw new Error("No config.apiKey provided for Groq provider.");
	}

	const getModels = cachedDataRetriever(
		"https://api.groq.com/openai/v1/models",
		{
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
			},
		},
	) as () => Promise<ModelList | null>;

	function generateModelSpec(
		modelId: string,
		modelSpec: Omit<
			ChatModelSpec,
			"isAvailable" | "provider" | "providerDisplayName" | "impl" | "modelId"
		>,
	): ChatModelSpec {
		return {
			modelId,
			providerDisplayName: providerDisplayName,
			impl: groq(modelId),
			async isAvailable() {
				const modelList = await getModels();
				return !!modelList?.data.some((model) => model.id === modelId);
			},
			...modelSpec,
		} as ChatModelSpec;
	}

	modelRegistry.chat.registerAllModelSpecs([
		generateModelSpec("llama-3.1-8b-instant", {
			contextLength: 131072,
			maxCompletionTokens: 131072,
			costPerMillionInputTokens: 0.05,
			costPerMillionOutputTokens: 0.08,
			reasoningText: 3,
			intelligence: 3,
			speed: 6,
			tools: 2,
		}),
		generateModelSpec("llama-3.3-70b-versatile", {
			contextLength: 131072,
			maxCompletionTokens: 32768,
			costPerMillionInputTokens: 0.59,
			costPerMillionOutputTokens: 0.79,
			reasoningText: 4,
			intelligence: 4,
			speed: 5,
			tools: 3,
		}),
		// New and Updated Models
		generateModelSpec("deepseek-r1-distill-llama-70b", {
			contextLength: 131072,
			maxCompletionTokens: 131072,
			costPerMillionInputTokens: 0.75,
			costPerMillionOutputTokens: 0.99,
			reasoningText: 5,
			intelligence: 5,
			speed: 4,
			tools: 4,
		}),
		generateModelSpec("meta-llama/llama-4-maverick-17b-128e-instruct", {
			contextLength: 131072,
			maxCompletionTokens: 8192,
			costPerMillionInputTokens: 0.2,
			costPerMillionOutputTokens: 0.6,
			reasoningText: 4,
			intelligence: 4,
			speed: 4,
			tools: 3,
		}),
		generateModelSpec("meta-llama/llama-4-scout-17b-16e-instruct", {
			contextLength: 131072,
			maxCompletionTokens: 8192,
			costPerMillionInputTokens: 0.11,
			costPerMillionOutputTokens: 0.34,
			reasoningText: 4,
			intelligence: 4,
			speed: 4,
			tools: 3,
		}),
		generateModelSpec("openai/gpt-oss-120b", {
			contextLength: 131072,
			maxCompletionTokens: 65536,
			costPerMillionInputTokens: 0.15,
			costPerMillionOutputTokens: 0.75,
			reasoningText: 5,
			intelligence: 5,
			speed: 3,
			tools: 5,
		}),
		generateModelSpec("openai/gpt-oss-20b", {
			contextLength: 131072,
			maxCompletionTokens: 65536,
			costPerMillionInputTokens: 0.1,
			costPerMillionOutputTokens: 0.5,
			reasoningText: 4,
			intelligence: 4,
			speed: 4,
			tools: 4,
		}),
		generateModelSpec("qwen/qwen3-32b", {
			contextLength: 131072,
			maxCompletionTokens: 40960,
			costPerMillionInputTokens: 0.29,
			costPerMillionOutputTokens: 0.59,
			reasoningText: 4,
			intelligence: 4,
			speed: 4,
			tools: 3,
		}),
		generateModelSpec("moonshotai/kimi-k2-instruct-0905", {
			contextLength: 131072,
			maxCompletionTokens: 16384,
			costPerMillionInputTokens: 1,
			costPerMillionOutputTokens: 3,
			reasoningText: 4,
			intelligence: 4,
			speed: 5,
			tools: 5,
		}),
		generateModelSpec("meta-llama/llama-guard-4-12b", {
			contextLength: 131072,
			maxCompletionTokens: 1024,
			costPerMillionInputTokens: 0.2,
			costPerMillionOutputTokens: 0.2,
			reasoningText: 2,
			intelligence: 2,
			speed: 5,
			tools: 1,
		}),
		generateModelSpec("meta-llama/llama-prompt-guard-2-22m", {
			contextLength: 512,
			maxCompletionTokens: 512,
			costPerMillionInputTokens: 0.03,
			costPerMillionOutputTokens: 0.03,
			reasoningText: 1,
			intelligence: 1,
			speed: 6,
			tools: 1,
		}),
		generateModelSpec("meta-llama/llama-prompt-guard-2-86m", {
			contextLength: 512,
			maxCompletionTokens: 512,
			costPerMillionInputTokens: 0.04,
			costPerMillionOutputTokens: 0.04,
			reasoningText: 1,
			intelligence: 1,
			speed: 6,
			tools: 1,
		}),
	]);
}
