import { vi } from "vitest";

// Mock environment variables
process.env.OPENAI_API_KEY = "test-openai-key";
process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
process.env.GOOGLE_API_KEY = "test-google-key";

// Mock console methods to reduce noise during tests
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
