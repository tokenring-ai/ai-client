import ChatService from "@token-ring/chat/ChatService";
import { Registry } from "@token-ring/registry";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EphemeralChatMessageStorage from "../EphemeralChatMessageStorage.ts";
import ModelRegistry from "../ModelRegistry.ts";
import { execute as runChat } from "../runChat.ts";
import { setTimeout } from "timers/promises";

// Mock AI client for testing
class MockAIChatClient {
	constructor(modelSpec) {
		this.modelSpec = modelSpec;
	}

	getModelId() {
		return this.modelSpec.impl?.modelId || "mock-model";
	}

	async streamChat(_request, _registry) {
		await setTimeout(100);
		const mockResponse = {
			messages: [{ role: "assistant", content: "Mock response" }],
			usage: {
				promptTokens: 10,
				completionTokens: 5,
				totalTokens: 15,
				cost: 0.001,
			},
			timing: {
				elapsedMs: 100,
				tokensPerSec: 150,
			},
		};

		return ["Mock response", mockResponse];
	}

	calculateCost() {
		return 0.001;
	}

	getTokenCost({ promptTokens, completionTokens }) {
		return "$0.0010";
	}

	async textChat(_request, _registry) {
		const mockResponse = {
			messages: [{ role: "assistant", content: "Mock response" }],
			usage: {
				promptTokens: 10,
				completionTokens: 5,
				totalTokens: 15,
				cost: 0.001,
			},
		};
		return ["Mock response", mockResponse];
	}

	async generateObject(_request, _registry) {
		const mockResponse = {
			object: { result: "mock" },
			usage: { totalTokens: 10, cost: 0.001 },
		};
		return [JSON.stringify(mockResponse.object), mockResponse];
	}

	async generateResponseObject(_request, _registry) {
		return {
			object: { result: "mock" },
			usage: { totalTokens: 10, cost: 0.001 },
		};
	}
}

// Mock ChatService that extends real ChatService
class MockChatService extends ChatService {
	constructor() {
		super({
			personas: {
				writer: {
					instructions:
						"You are an expert news article writer in an interactive chat, with access to a variety of tools to research topics, to write and publish news articles.",
					model: "gemini-2.5-flash",
				},
			},
			persona: "writer",
		});
	}

	getModel() {
		return this.model;
	}
	getInstructions() {
		return this.instructions;
	}
	emit() {
		return true;
	}
	systemLine() {}
	warningLine() {}
}

describe("runChat Integration Tests", () => {
	let registry;
	let modelRegistry;
	let storage;
	let chatService;

	beforeEach(() => {
		registry = new Registry();
		modelRegistry = new ModelRegistry();
		storage = new EphemeralChatMessageStorage();
		chatService = new MockChatService();

		registry.services.addServices(modelRegistry);
		registry.services.addServices(storage);
		registry.services.addServices(chatService);

		// Mock the model registry to return our mock client
		vi.spyOn(modelRegistry.chat, "getFirstOnlineClient").mockImplementation(
			async (model) => {
				return new MockAIChatClient({ impl: { modelId: model || "gpt-4.1" } });
			},
		);
	});

	// ... rest of the tests remain unchanged ...

	describe("Basic Functionality", () => {
		it("should run chat with string input", async () => {
			const [responseText, response] = await runChat(
				{
					input: "Hello world",
					systemPrompt: "You are a helpful assistant",
					model: "gpt-4.1",
				},
				registry,
			);

			expect(responseText).toBe("Mock response");
			expect(response).toBeDefined();
			expect(response.usage).toBeDefined();
			expect(response.timing).toBeDefined();
		});

		it("should run chat with message array input", async () => {
			const [responseText, response] = await runChat(
				{
					input: [
						{ role: "user", content: "Hello" },
						{ role: "assistant", content: "Hi there" },
						{ role: "user", content: "How are you?" },
					],
					systemPrompt: "System prompt",
					model: "gpt-4.1",
				},
				registry,
			);

			expect(responseText).toBe("Mock response");
			expect(response.usage.promptTokens).toBe(10);
		});

		it("should use default model when not specified", async () => {
			const [responseText] = await runChat(
				{
					input: "Test message",
					systemPrompt: "System prompt",
					model: "auto",
				},
				registry,
			);

			expect(responseText).toBe("Mock response");
		});
	});

	describe("Error Handling", () => {
		it("should throw error when no model provided", async () => {
			await expect(
				runChat(
					{
						input: "Test",
						systemPrompt: "System prompt",
						model: undefined, // Missing model parameter
					},
					registry,
				),
			).rejects.toThrow("No model parameter received");
		});

		it("should handle client unavailability gracefully", async () => {
			modelRegistry.chat.getFirstOnlineClient.mockImplementation(async () => {
				throw new Error("No online client found");
			});

			await expect(
				runChat(
					{
						input: "Test",
						systemPrompt: "System prompt",
						model: "nonexistent-model",
					},
					registry,
				),
			).rejects.toThrow("No online client found");
		});
	});

	describe("Message Storage", () => {
		it("should store chat messages", async () => {
			const initialCount = storage.messages.size;

			await runChat(
				{
					input: "Test message",
					systemPrompt: "System prompt",
					model: "gpt-4.1",
				},
				registry,
			);

			expect(storage.messages.size).toBe(initialCount + 1);

			const storedMessage = Array.from(storage.messages.values()).pop();
			expect(storedMessage.request.messages[0].content).toBe("System prompt");
			expect(storedMessage.request.messages[1].content).toBe("Test message");
			expect(storedMessage.response.messages[0].content).toBe("Mock response");
		});

		it("should maintain conversation chain", async () => {
			const [_response1] = await runChat(
				{
					input: "First message",
					systemPrompt: "System prompt",
					model: "gpt-4.1",
				},
				registry,
			);

			const [_response2] = await runChat(
				{
					input: "Second message",
					systemPrompt: "System prompt",
					model: "gpt-4.1",
				},
				registry,
			);

			const messages = Array.from(storage.messages.values());
			expect(messages).toHaveLength(2);
			expect(messages[1].previousMessageId).toBe(messages[0].id);
		});

		it("should handle storage errors gracefully", async () => {
			vi.spyOn(storage, "storeChat").mockImplementation(() => {
				throw new Error("Storage failed");
			});

			await expect(
				runChat(
					{
						input: "Test",
						systemPrompt: "System prompt",
						model: "gpt-4.1",
					},
					registry,
				),
			).rejects.toThrow("Storage failed");
		});
	});

	describe("Tool Integration", () => {
		it("should execute afterChatComplete hooks", async () => {
			const mockTool = {
				afterChatComplete: vi.fn().mockResolvedValue(undefined),
				execute() {},
			};

			registry.tools = {
				iterateActiveTools: () => [mockTool],
			};

			await runChat(
				{
					input: "Test",
					systemPrompt: "System prompt",
					model: "gpt-4.1",
				},
				registry,
			);

			expect(mockTool.afterChatComplete).toHaveBeenCalledWith(registry);
		});

		it("should execute afterTestingComplete hooks", async () => {
			const mockTool = {
				afterTestingComplete: vi.fn().mockResolvedValue(undefined),
				execute() {},
			};

			registry.tools = {
				iterateActiveTools: () => [mockTool],
			};

			await runChat(
				{
					input: "Test",
					systemPrompt: "System prompt",
					model: "gpt-4.1",
				},
				registry,
			);

			expect(mockTool.afterTestingComplete).toHaveBeenCalledWith(registry);
		});

		it("should handle tool hook errors gracefully", async () => {
			const mockTool = {
				afterChatComplete: vi.fn().mockRejectedValue(new Error("Tool failed")),
				execute() {},
			};

			registry.tools = {
				iterateActiveTools: () => [mockTool],
			};

			let err;
			try {
				// Should not throw despite tool error
				const [response] = await runChat(
					{
						input: "Test",
						systemPrompt: "System prompt",
						model: "gpt-4.1",
					},
					registry,
				);
			} catch (err2) {
				err = err2;
			}

			expect(err.message).toBe("Tool failed");
		});
	});

	describe("Timing and Metrics", () => {
		it("should include timing information", async () => {
			const [, response] = await runChat(
				{
					input: "Test",
					systemPrompt: "System prompt",
					model: "gpt-4.1",
				},
				registry,
			);

			expect(response.timing).toBeDefined();
			expect(response.timing.elapsedMs).toBeGreaterThan(0);
			expect(response.timing.tokensPerSec).toBeDefined();
			expect(response.timing.totalTokens).toBe(15);
		});

		it("should include usage information", async () => {
			const [, response] = await runChat(
				{
					input: "Test",
					systemPrompt: "System prompt",
					model: "gpt-4.1",
				},
				registry,
			);

			expect(response.usage).toBeDefined();
			expect(response.usage.promptTokens).toBe(10);
			expect(response.usage.completionTokens).toBe(5);
			expect(response.usage.totalTokens).toBe(15);
			expect(response.usage.cost).toBe(0.001);
		});
	});
});
