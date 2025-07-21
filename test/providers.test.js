import { describe, it, expect, beforeEach, vi } from "vitest";
import * as providers from "../models.js";
import { Registry } from "@token-ring/registry";
import ModelRegistry from "../ModelRegistry.js";

// Mock axios for HTTP requests
vi.mock("axios", () => ({
	default: {
		get: vi.fn(),
	},
}));

import axios from "axios";

describe("Provider Integration Tests", () => {
	let registry;
	let modelRegistry;

	beforeEach(() => {
		registry = new Registry();
		modelRegistry = new ModelRegistry();
		registry.services.addServices(modelRegistry);

		// Mock successful API responses
		axios.get.mockResolvedValue({ data: { data: [] } });
	});

	describe("OpenRouter Provider", () => {
		it("should register OpenRouter models", async () => {
			// Patch the OpenRouter provider's cachedDataRetriever to use the mocked axios.get
			const mockData = {
				data: [
					{
						id: "gpt-3.5-turbo",
						name: "GPT-3.5 Turbo",
						context_length: 4096,
						pricing: {
							prompt: "0.0000015",
							completion: "0.000002",
						},
					},
				],
			};
			axios.get.mockResolvedValueOnce({ data: mockData });

			await providers.openrouter.init(modelRegistry, { apiKey: "test-key" });

			const models = modelRegistry.chat.getRegisteredModelSpecs();
			expect(models).toContain("gpt-3.5-turbo");
		});
	});

	describe("OpenAI Provider", () => {
		it("should register OpenAI models", async () => {
			const config = {
				openai: {
					provider: "openai",
					apiKey: "test-key",
				},
			};

			await modelRegistry.initializeModels(providers, config);

			const models = modelRegistry.chat.getRegisteredModelSpecs();
			expect(models).toContain("gpt-4.1");
			expect(models).toContain("gpt-4.1-mini");
		});
	});

	describe("Anthropic Provider", () => {
		it("should register Anthropic models", async () => {
			const config = {
				anthropic: {
					provider: "anthropic",
					apiKey: "test-key",
				},
			};

			await modelRegistry.initializeModels(providers, config);

			const models = modelRegistry.chat.getRegisteredModelSpecs();
			expect(models).toContain("claude-4-opus");
			expect(models).toContain("claude-4-sonnet");
		});
	});

	describe("Google Provider", () => {
		it("should register Google models", async () => {
			const config = {
				google: {
					provider: "google",
					apiKey: "test-key",
				},
			};

			await modelRegistry.initializeModels(providers, config);

			const models = modelRegistry.chat.getRegisteredModelSpecs();
			expect(models).toContain("gemini-1.5-pro");
			expect(models).toContain("gemini-1.5-flash");
		});
	});

	describe("Error Handling", () => {
		it("should throw error for missing API key", async () => {
			const config = {
				openai: {
					provider: "openai",
					// Missing apiKey
				},
			};

			await expect(
				modelRegistry.initializeModels(providers, config),
			).rejects.toThrow("No config.apiKey provided for OpenAI provider");
		});
	});
});
