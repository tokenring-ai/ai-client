import Agent from "@tokenring-ai/agent/Agent";
import AIService from "../AIService.js";
import ModelRegistry from "../ModelRegistry.js";
import { createChatRequest } from "../chatRequestBuilder/createChatRequest.js";

export const description: string =
	"/ai settings key=value [key=value...] - Update AI configuration settings | /ai context - Show context items | /ai feature <list|enable|disable> ...";

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

    // /ai feature <list|enable|disable> ...
    if (parts[0] === "feature") {
        return handleFeatureSubcommand(parts.slice(1), agent);
    }

    if (parts[0] === "context") {
        await showContext(agent);
        return;
    }

    if (parts[0] !== "settings") {
        agent.errorLine(
			"Usage: /ai settings key=value [key=value...] | /ai context | /ai feature <list|enable|disable>",
        );
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
		if (
			key === "temperature" ||
			key === "topP" ||
			key === "frequencyPenalty" ||
			key === "presencePenalty"
		) {
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
		} else if (key === "autoCompact") {
			parsedValue = value.toLowerCase() === "true";
		}

		updates[key] = parsedValue;
	}

	if (Object.keys(updates).length > 0) {
		aiService.updateAIConfig(updates, agent);
		agent.infoLine(`Updated AI settings: ${Object.keys(updates).join(", ")}`);
	}
}

function parseModelAndFeatures(model: string): { base: string; features: Record<string, any> } {
    const qIndex = model.indexOf("?");
    const base = qIndex >= 0 ? model.substring(0, qIndex) : model;
    const features: Record<string, any> = Object.create(null);
    if (qIndex >= 0) {
        const query = model.substring(qIndex + 1);
        for (const part of query.split("&")) {
            if (!part) continue;
            const [rawK, rawV] = part.split("=");
            const k = decodeURIComponent(rawK);
            const v = rawV === undefined ? "1" : decodeURIComponent(rawV);
            features[k] = coerceFeatureValue(v);
        }
    }
    return { base, features };
}

function coerceFeatureValue(v: string): any {
    const lower = v.toLowerCase?.();
    if (v === "1" || lower === "true") return true;
    if (v === "0" || lower === "false") return false;
    const asNum = Number(v);
    if (!Number.isNaN(asNum) && String(asNum) === v.replace(/(?<=\d)\.0+$/, (m) => m)) {
        return asNum;
    }
    return v;
}

function serializeModel(base: string, features: Record<string, any>): string {
    const entries = Object.entries(features).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return base;
    const query = entries
        .map(([k, v]) => {
            let val: string;
            if (typeof v === "boolean") val = v ? "1" : "0";
            else val = String(v);
            return `${encodeURIComponent(k)}=${encodeURIComponent(val)}`;
        })
        .join("&");
    return `${base}?${query}`;
}

async function handleFeatureSubcommand(args: string[], agent: Agent): Promise<void> {
    const aiService = agent.requireServiceByType(AIService);
    const currentModel = aiService.getModel(agent);
    const { base, features } = parseModelAndFeatures(currentModel);

    const action = args[0];
    if (!action || !["list", "enable", "disable"].includes(action)) {
        agent.errorLine(
            "Usage: /ai feature <list|enable|disable> [key[=value] ...]",
        );
        return;
    }

    if (action === "list") {
        agent.infoLine(`Current model: ${currentModel}`);
        agent.infoLine(`Base model: ${base}`);
        
        // Show enabled features
        const keys = Object.keys(features);
        if (keys.length === 0) {
            agent.infoLine("Enabled features: (none)");
        } else {
            agent.infoLine("Enabled features:");
            for (const k of keys.sort()) {
                agent.infoLine(`  ${k}: ${features[k]}`);
            }
        }
        
        // Show available features from the model spec
        try {
            const modelRegistry = agent.requireServiceByType(ModelRegistry);
            const client = await modelRegistry.chat.getFirstOnlineClient(base);
            const modelSpec = client.getModelSpec();
            const availableFeatures = modelSpec.features || {};
            const availableKeys = Object.keys(availableFeatures);
            
            if (availableKeys.length === 0) {
                agent.infoLine("Available features: (none)");
            } else {
                agent.infoLine("Available features:");
                for (const k of availableKeys.sort()) {
                    agent.infoLine(`  ${k}`);
                }
            }
        } catch (error) {
            agent.infoLine(`Available features: (could not fetch model spec: ${error})`);
        }
        
        return;
    }

    if (action === "enable") {
        if (args.length < 2) {
            agent.errorLine("/ai feature enable requires at least one key or key=value");
            return;
        }
        for (let i = 1; i < args.length; i++) {
            const token = args[i];
            const eq = token.indexOf("=");
            if (eq === -1) {
                features[token] = true;
            } else {
                const key = token.substring(0, eq);
                const val = token.substring(eq + 1);
                if (!key) {
                    agent.errorLine(`Invalid feature token: ${token}`);
                    continue;
                }
                features[key] = coerceFeatureValue(val);
            }
        }
        const newModel = serializeModel(base, features);
        aiService.setModel(newModel, agent);
        agent.infoLine(`Enabled features. New model: ${newModel}`);
        return;
    }

    // disable
    if (args.length < 2) {
        agent.errorLine("/ai feature disable requires at least one key");
        return;
    }
    for (let i = 1; i < args.length; i++) {
        const key = args[i];
        if (!key) continue;
        delete features[key];
    }
    const newModel = serializeModel(base, features);
    aiService.setModel(newModel, agent);
    agent.infoLine(`Disabled features. New model: ${newModel}`);
}

async function showContext(agent: Agent): Promise<void> {
	try {
		const aiService = agent.requireServiceByType(AIService);
		const config = aiService.getAIConfig(agent);

		const systemPrompt =
			typeof config.systemPrompt === "function"
				? config.systemPrompt(agent)
				: config.systemPrompt;

		const request = await createChatRequest(
			{
				input: "dummy input",
				systemPrompt,
				includeContextItems: true,
				includeTools: false,
				includePriorMessages: true,
			},
			agent,
		);

		agent.infoLine("Context items that would be added to chat request:");
		agent.infoLine(`Total messages: ${request.messages.length}`);

		request.messages.slice(0, -1).forEach((msg, index) => {
			const content =
				typeof msg.content === "string"
					? msg.content
						? Array.isArray(msg.content)
							? msg.content[0].text
							: msg.content
						: msg.content
					: JSON.stringify(msg.content);
			const preview =
				content.length > 100 ? content.substring(0, 130) + "..." : content;
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
        "  - Available keys: model, systemPrompt, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, stopSequences, autoCompact",
        "  - Examples: /ai settings temperature=0.7 autoCompact=true",
        "  - With no arguments: Shows current settings",
        "/ai feature list",
        "  - List currently enabled features and available features supported by the model",
        "/ai feature enable key[=value] [key[=value] ...]",
        "  - Enable or set feature flags. Booleans accept 1/0/true/false; numbers are parsed.",
        "/ai feature disable key [key ...]",
        "  - Disable/remove feature flags from the model string",
        "/ai context",
        "  - Show all context items that would be added to a chat request",
    ];
}
