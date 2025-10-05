import { AgentTeam, TokenRingPackage } from "@tokenring-ai/agent";
import { z } from "zod";
import AIService from "./AIService.js";

import * as chatCommands from "./chatCommands.ts";
import ModelRegistry from "./ModelRegistry.js";
import { ModelProviderConfigSchema, registerModels } from "./models.js";
import packageJSON from "./package.json" with { type: "json" };

export const AIClientConfigSchema = z.object({
	defaultModel: z.string(),
	models: z.record(z.string(), ModelProviderConfigSchema),
});

export const packageInfo: TokenRingPackage = {
	name: packageJSON.name,
	version: packageJSON.version,
	description: packageJSON.description,
	async install(agentTeam: AgentTeam) {
		agentTeam.addChatCommands(chatCommands);
		agentTeam.services.register(new ModelRegistry());

		const config = agentTeam.getConfigSlice("ai", AIClientConfigSchema);
		if (!config) return;
		await registerModels(
			config.models,
			agentTeam.services.requireItemByType(ModelRegistry),
		);

		agentTeam.addServices(new AIService({ model: config.defaultModel }));
	},
};

export { createChatRequest } from "./chatRequestBuilder/createChatRequest.ts";
export { default as ModelRegistry } from "./ModelRegistry.ts";
