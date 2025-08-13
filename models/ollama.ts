import {createOllama} from "ollama-ai-provider";
import cachedDataRetriever from "../util/cachedDataRetriever.ts";
import type ModelRegistry from "../ModelRegistry.ts";
import type {ModelConfig} from "../ModelRegistry.ts";
import {abandon} from "@token-ring/utility/abandon";

const providerName = "Ollama";

export async function init(modelRegistry: ModelRegistry, config: ModelConfig) {
	const { baseURL, generateModelSpec } = config;
	if (!baseURL) {
		throw new Error("No config.baseURL provided for Ollama provider.");
	}
	if (!generateModelSpec) {
		throw new Error(
			"No config.generateModelSpec provided for Ollama provider.",
		);
	}

	const chatModelSpecs: Record<string, any> = {};
	const embeddingModelSpecs: Record<string, any> = {};

	const ollama = createOllama({ baseURL });
	const getModelList = cachedDataRetriever(`${baseURL}/tags`, {
		headers: {},
		cacheTime: 60000,
		timeout: 1000,
	});
	const getRunningModels = cachedDataRetriever(`${baseURL}/ps`, {
		headers: {},
		cacheTime: 60000,
		timeout: 1000,
	});
	abandon(getRunningModels()); // In background, fetch the list of running models.

	const modelList = await getModelList();
	if (!modelList?.models) return;

	for (const modelInfo of modelList.models) {
		const { type, capabilities = {} } = generateModelSpec(modelInfo);

		if (type === "chat") {
			chatModelSpecs[modelInfo.model] = {
				provider: config.provider ?? providerName,
				name: modelInfo.model,
				impl: ollama.chat(modelInfo.model),
				isAvailable: () => getModelList().then((data) => !!data),
				isHot: () =>
					capabilities.alwaysHot ||
					getRunningModels().then((result: any) =>
						result?.models?.find?.((row: any) => modelInfo.model === row.model),
					),
					...capabilities,
			};
		} else if (type === "embedding") {
			embeddingModelSpecs[modelInfo.model] = {
				provider: providerName,
				name: modelInfo.model,
				impl: ollama.embedding(modelInfo.model),
				isAvailable: () => getModelList().then((data) => !!data),
				isHot: () =>
					capabilities.alwaysHot ||
					getRunningModels().then((result: any) =>
						result?.models?.find?.((row: any) => modelInfo.model === row.model),
					),
			};
		}
	}

	if (Object.keys(chatModelSpecs).length > 0) {
		modelRegistry.chat.registerAllModelSpecs(chatModelSpecs);
	}

	if (Object.keys(embeddingModelSpecs).length > 0) {
		modelRegistry.embedding.registerAllModelSpecs(embeddingModelSpecs);
	}
}
