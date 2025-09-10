import Agent from "@tokenring-ai/chat/Agent";
import { Registry } from "@tokenring-ai/registry";
import { beforeEach, describe, expect, it } from "vitest";
import { createChatRequest } from "../chatRequestBuilder/createChatRequest.ts";
import EphemeralChatMessageStorage from "../EphemeralChatMessageStorage.ts";

// Use a real ServiceRegistry and add the storage service properly
const createMockRegistry = () => {
	const registry = new Registry();
	const storage = new EphemeralChatMessageStorage();
	// noinspection JSIgnoredPromiseFromCall
	registry.services.addServices(storage);
	// Add a mock ChatService so persona parameter code does not throw
	// noinspection JSIgnoredPromiseFromCall
	registry.services.addServices(
		new Agent({
			personas: {
				writer: {
					instructions:
						"You are an expert news article writer in an interactive chat, with access to a variety of tools to research topics, to write and publish news articles.",
					model: "gemini-2.5-flash",
				},
			},
			persona: "writer",
		}),
	);

	// Patch ServiceRegistry to add getMemories/getAttentionItems on the instance
	registry.services.getMemories = async function* () {
		yield { role: "system", content: "Test memory 1" };
		yield { role: "user", content: "Test memory 2" };
	};
	registry.services.getAttentionItems = async function* () {
		yield { role: "system", content: "Attention item" };
	};

	registry.tools = {
		iterateActiveTools: () => [],
	};

	return registry;
};

describe("createChatRequest Integration Tests", () => {
	let registry;
	let storage;

	beforeEach(() => {
		registry = createMockRegistry();
		storage = registry.requireFirstServiceByType(EphemeralChatMessageStorage);
	});

	// ... rest of the tests remain unchanged ...

	describe("Basic Request Creation", () => {
		it("should create basic request with string input", async () => {
			const request = await createChatRequest(
				{
					input: "Hello world",
					systemPrompt: "You are a helpful assistant",
				},
				registry,
			);

			expect(request.messages).toHaveLength(4);
			expect(request.messages[0]).toEqual({
				role: "system",
				content: "You are a helpful assistant",
			});
			expect(request.messages[1]).toEqual({
				role: "system",
				content: "Test memory 1",
			});
			expect(request.messages[2]).toEqual({
				role: "user",
				content: "Test memory 2",
			});
			expect(request.messages[3]).toEqual({
				role: "user",
				content: "Hello world",
			});
			expect(request.maxSteps).toBe(15);
			expect(request.tools).toEqual({});
		});

		it("should create request with message array input", async () => {
			const input = [
				{ role: "user", content: "First message" },
				{ role: "assistant", content: "Response" },
				{ role: "user", content: "Follow up" },
			];

			const request = await createChatRequest(
				{
					input,
					systemPrompt: "System prompt",
				},
				registry,
			);

			expect(request.messages).toHaveLength(6);
			expect(request.messages[0].role).toBe("system");
			expect(request.messages.slice(3)).toEqual(input);
		});

		it("should handle string system prompt", async () => {
			const request = await createChatRequest(
				{
					input: "Test",
					systemPrompt: "System message",
				},
				registry,
			);

			expect(request.messages[0]).toEqual({
				role: "system",
				content: "System message",
			});
		});

		it("should handle object system prompt", async () => {
			const systemPrompt = { role: "system", content: "System message" };
			const request = await createChatRequest(
				{
					input: "Test",
					systemPrompt,
				},
				registry,
			);

			expect(request.messages[0]).toEqual(systemPrompt);
		});

		it("should throw error for empty input", async () => {
			await expect(createChatRequest({ input: [] }, registry)).rejects.toThrow(
				"input: parameter must be an array with a length greater than 0",
			);
		});
	});

	// ... rest of the tests remain unchanged ...

	describe("Conversation History", () => {
		it("should include prior messages when available", async () => {
			// Store a previous message
			const prevRequest = {
				messages: [{ role: "user", content: "Previous question" }],
				model: "gpt-4.1",
			};
			const prevResponse = {
				messages: [{ role: "assistant", content: "Previous answer" }],
			};

			const prevMessage = await storage.storeChat(
				null,
				prevRequest,
				prevResponse,
			);
			storage.setCurrentMessage(prevMessage);

			const request = await createChatRequest(
				{
					input: "New question",
					systemPrompt: "System prompt",
					includePriorMessages: true,
				},
				registry,
			);

			expect(request.messages).toHaveLength(4);
			expect(request.messages[0].role).toBe("system");
			expect(request.messages[1].content).toBe("Previous question");
			expect(request.messages[2].content).toBe("Previous answer");
			expect(request.messages[3].content).toBe("New question");
		});

		it("should exclude prior messages when disabled", async () => {
			const prevRequest = {
				messages: [{ role: "user", content: "Previous" }],
				model: "gpt-4.1",
			};
			const prevResponse = {
				messages: [{ role: "assistant", content: "Response" }],
			};

			const prevMessage = await storage.storeChat(
				null,
				prevRequest,
				prevResponse,
			);
			storage.setCurrentMessage(prevMessage);

			const request = await createChatRequest(
				{
					input: "New question",
					systemPrompt: "System prompt",
					includePriorMessages: false,
				},
				registry,
			);

			expect(request.messages).toHaveLength(5);
			expect(request.messages).toEqual([
				{
					role: "system",
					content: "System prompt",
				},
				{
					role: "system",
					content: "Test memory 1",
				},
				{
					role: "user",
					content: "Test memory 2",
				},
				{
					role: "system",
					content: "Attention item",
				},
				{
					role: "user",
					content: "New question",
				},
			]);
		});

		it("should handle system messages in history correctly", async () => {
			const prevRequest = {
				messages: [
					{ role: "system", content: "System context" },
					{ role: "user", content: "Question" },
				],
				model: "gpt-4.1",
			};
			const prevResponse = {
				messages: [{ role: "assistant", content: "Answer" }],
			};

			const prevMessage = await storage.storeChat(
				null,
				prevRequest,
				prevResponse,
			);
			storage.setCurrentMessage(prevMessage);

			const request = await createChatRequest(
				{
					input: "New question",
					systemPrompt: "New system prompt",
					includePriorMessages: true,
				},
				registry,
			);

			// Should not duplicate system messages
			const systemMessages = request.messages.filter(
				(m) => m.role === "system",
			);
			expect(systemMessages).toHaveLength(1);
			expect(systemMessages[0].content).toBe("New system prompt");
		});
	});

	describe("Memories and Attention Items", () => {
		it("should include memories for new conversations", async () => {
			const request = await createChatRequest(
				{
					input: "Hello",
					systemPrompt: "System prompt",
					includeMemories: true,
					includePriorMessages: false,
				},
				registry,
			);

			expect(request.messages).toContainEqual({
				role: "system",
				content: "Test memory 1",
			});
			expect(request.messages).toContainEqual({
				role: "user",
				content: "Test memory 2",
			});
		});

		it("should exclude memories when disabled", async () => {
			const request = await createChatRequest(
				{
					input: "Hello",
					systemPrompt: "System prompt",
					includeMemories: false,
					includePriorMessages: false,
				},
				registry,
			);

			const memoryContents = request.messages.map((m) => m.content);
			expect(memoryContents).not.toContain("Test memory 1");
			expect(memoryContents).not.toContain("Test memory 2");
		});

		it("should include attention items", async () => {
			const request = await createChatRequest(
				{
					input: "Hello",
					systemPrompt: "System prompt",
					includeMemories: true,
					includePriorMessages: false,
				},
				registry,
			);

			expect(request.messages).toContainEqual({
				role: "system",
				content: "Attention item",
			});
		});

		it("should handle memory positioning correctly", async () => {
			const request = await createChatRequest(
				{
					input: "Hello",
					systemPrompt: "System prompt",
					includeMemories: true,
					includePriorMessages: false,
				},
				registry,
			);

			const systemMessages = request.messages.filter(
				(m) => m.role === "system",
			);
			expect(systemMessages[0].content).toBe("System prompt");
			expect(systemMessages[1].content).toBe("Test memory 1");
			expect(systemMessages[2].content).toBe("Attention item");
		});
	});

	describe("Configuration Options", () => {
		it("should respect includeTools flag", async () => {
			const request = await createChatRequest(
				{
					input: "Test",
					systemPrompt: "System",
					includeTools: false,
				},
				registry,
			);

			expect(request.tools).toEqual({});
		});

		it("should respect includePriorMessages flag", async () => {
			const prevRequest = {
				messages: [{ role: "user", content: "Previous" }],
				model: "gpt-4.1",
			};
			const prevResponse = {
				messages: [{ role: "assistant", content: "Response" }],
			};

			const prevMessage = await storage.storeChat(
				null,
				prevRequest,
				prevResponse,
			);
			storage.setCurrentMessage(prevMessage);

			const request = await createChatRequest(
				{
					input: "New",
					systemPrompt: "System",
					includePriorMessages: false,
				},
				registry,
			);

			expect(request.messages).toHaveLength(5);
			expect(request.messages).toEqual([
				{
					role: "system",
					content: "System",
				},
				{
					role: "system",
					content: "Test memory 1",
				},
				{
					role: "user",
					content: "Test memory 2",
				},
				{
					role: "system",
					content: "Attention item",
				},
				{
					role: "user",
					content: "New",
				},
			]);
		});
	});
});
