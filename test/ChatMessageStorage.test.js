import { beforeEach, describe, expect, it } from "vitest";
import EphemeralChatMessageStorage from "../EphemeralChatMessageStorage.ts";

describe("EphemeralChatMessageStorage Integration Tests", () => {
	let storage;

	beforeEach(() => {
		storage = new EphemeralChatMessageStorage();
	});

	describe("Basic Operations", () => {
		it("should store and retrieve messages", async () => {
			const request = {
				messages: [{ role: "user", content: "Hello" }],
				model: "gpt-4.1",
			};
			const response = {
				messages: [{ role: "assistant", content: "Hi there!" }],
				usage: { promptTokens: 10, completionTokens: 5 },
			};

			const message = await storage.storeChat(null, request, response);

			expect(message.id).toBeDefined();
			expect(message.sessionId).toBeDefined();
			expect(message.request).toEqual(request);
			expect(message.response).toEqual(response);
			expect(message.cumulativeInputLength).toBeGreaterThan(0);
		});

		it("should handle new sessions", async () => {
			const request = { messages: [{ role: "user", content: "Test" }] };
			const response = {
				messages: [{ role: "assistant", content: "Response" }],
			};

			const message = await storage.storeChat(null, request, response);

			expect(message.sessionId).toBeDefined();
			expect(storage.session.id).toBe(message.sessionId);
		});

		it("should maintain conversation chains", async () => {
			const request1 = { messages: [{ role: "user", content: "First" }] };
			const response1 = {
				messages: [{ role: "assistant", content: "First response" }],
			};

			const message1 = await storage.storeChat(null, request1, response1);

			const request2 = { messages: [{ role: "user", content: "Second" }] };
			const response2 = {
				messages: [{ role: "assistant", content: "Second response" }],
			};

			const message2 = await storage.storeChat(message1, request2, response2);

			expect(message2.previousMessageId).toBe(message1.id);
			expect(message2.sessionId).toBe(message1.sessionId);
		});

		it("should calculate cumulative input length correctly", async () => {
			const request1 = {
				messages: [{ role: "user", content: "Short message" }],
			};
			const response1 = {
				messages: [{ role: "assistant", content: "Short response" }],
			};

			const message1 = await storage.storeChat(null, request1, response1);
			const initialLength = message1.cumulativeInputLength;

			const request2 = {
				messages: [{ role: "user", content: "Another message" }],
			};
			const response2 = {
				messages: [{ role: "assistant", content: "Another response" }],
			};

			const message2 = await storage.storeChat(message1, request2, response2);

			expect(message2.cumulativeInputLength).toBeGreaterThan(initialLength);
		});
	});

	describe("Message Management", () => {
		it("should set and get current message", () => {
			expect(storage.getCurrentMessage()).toBeNull();

			const mockMessage = { id: "test", content: "test" };
			storage.setCurrentMessage(mockMessage);

			expect(storage.getCurrentMessage()).toBe(mockMessage);
		});

		it("should maintain message history with popMessage", async () => {
			const request = { messages: [{ role: "user", content: "Test" }] };
			const response = {
				messages: [{ role: "assistant", content: "Response" }],
			};

			const message1 = await storage.storeChat(null, request, response);
			const message2 = await storage.storeChat(message1, request, response);

			expect(storage.getCurrentMessage().id).toBe(message2.id);

			storage.popMessage();
			expect(storage.getCurrentMessage().id).toBe(message1.id);

			storage.popMessage();
			expect(storage.getCurrentMessage()).toBeNull();
		});

		it("should retrieve messages by ID", async () => {
			const request = { messages: [{ role: "user", content: "Test" }] };
			const response = {
				messages: [{ role: "assistant", content: "Response" }],
			};

			const message = await storage.storeChat(null, request, response);
			const retrieved = await storage.retrieveMessageById(message.id);

			expect(retrieved).toEqual(message);
		});

		it("should throw error for non-existent message", async () => {
			await expect(
				storage.retrieveMessageById("non-existent-id"),
			).rejects.toThrow("Message with id non-existent-id not found");
		});
	});

	describe("Session Management", () => {
		it("should create new sessions automatically", async () => {
			const request = { messages: [{ role: "user", content: "Test" }] };
			const response = {
				messages: [{ role: "assistant", content: "Response" }],
			};

			const message1 = await storage.storeChat(null, request, response);
			const message2 = await storage.storeChat(message1, request, response);

			expect(message1.sessionId).toBe(message2.sessionId);
		});

		it("should handle empty storage gracefully", () => {
			expect(storage.getCurrentMessage()).toBeNull();
			expect(storage.previousMessages).toEqual([]);
		});
	});
});
