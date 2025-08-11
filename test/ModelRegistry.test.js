import { Registry } from "@token-ring/registry";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ModelRegistry from "../ModelRegistry.ts";
import * as providers from "../models.ts";

// Mock axios for HTTP requests
vi.mock("axios", () => ({
	default: {
		get: vi.fn(),
	},
}));

import axios from "axios";

/** @type {import('vitest').MockedFunction<typeof axios.get>} */
const mockedAxiosGet = /** @type {any} */ (axios.get);

describe("ModelRegistry Integration Tests", () => {
	let registry;
	let modelRegistry;

	beforeEach(() => {
		registry = new Registry();
		modelRegistry = new ModelRegistry();
		registry.services.addServices(modelRegistry);

		// Mock successful API responses
		mockedAxiosGet.mockResolvedValue({ data: { data: [] } });
	});

	describe("Provider Registration", () => {
		it("should register OpenAI provider with valid config", async () => {
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

		it("should register Anthropic provider with valid config", async () => {
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

		it("should register Google provider with valid config", async () => {
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

	describe("Model Filtering", () => {
		beforeEach(async () => {
			const config = {
				openai: {
					provider: "openai",
					apiKey: "test-key",
				},
			};
			await modelRegistry.initializeModels(providers, config);
		});

		it("should filter models by name", () => {
			const specs = modelRegistry.chat.getModelSpecs("gpt-4.1");
			expect(specs).toHaveLength(1);
			expect(specs[0].provider).toBe("openai");
		});

		it("should filter models by capabilities", () => {
			const specs = modelRegistry.chat.filterModelSpecs({
				contextLength: ">100000",
				reasoning: ">2",
			});

			expect(specs.length).toBeGreaterThan(0);
			specs.forEach((spec) => {
				expect(spec.contextLength).toBeGreaterThan(100000);
				expect(spec.reasoning).toBeGreaterThan(2);
			});
		});

		it("should handle string requirements", () => {
			const specs = modelRegistry.chat.filterModelSpecs("gpt-4.1");
			expect(specs).toHaveLength(1);
		});
	});

	describe("Model Status", () => {
		beforeEach(async () => {
			const config = {
				openai: {
					provider: "openai",
					apiKey: "test-key",
				},
			};
			await modelRegistry.initializeModels(providers, config);
		});

		it("should get all models with status", async () => {
			const models = await modelRegistry.chat.getAllModelsWithOnlineStatus();
			expect(Array.isArray(models)).toBe(true);

			const gpt41 = models.find((m) => m.name === "gpt-4.1");
			expect(gpt41).toBeDefined();
			expect(gpt41.status).toMatch(/online|offline|cold/);
		});

		it("should group models by provider", async () => {
			const modelsByProvider = await modelRegistry.chat.getModelsByProvider();
			expect(typeof modelsByProvider).toBe("object");
			expect(modelsByProvider.openai).toBeDefined();
		});
	});
});
