/**
 * LLM Gateway Unit Tests
 *
 * Tests for the LLM Gateway types and Anthropic adapter.
 * Uses mocked Anthropic SDK to avoid real API calls.
 *
 * @see docs/stories/3-2-llm-gateway-integration.md
 * @see docs/testing-strategy-mvp.md
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LLMError } from "~/server/services/llm/types";

describe("LLM Gateway Types", () => {
  describe("LLMError", () => {
    it("should create error with code and message", () => {
      const error = new LLMError("LLM_TIMEOUT", "Request timed out");

      expect(error.code).toBe("LLM_TIMEOUT");
      expect(error.message).toBe("Request timed out");
      expect(error.name).toBe("LLMError");
      expect(error.cause).toBeUndefined();
    });

    it("should create error with cause", () => {
      const cause = new Error("Original error");
      const error = new LLMError("LLM_ERROR", "API error", cause);

      expect(error.code).toBe("LLM_ERROR");
      expect(error.message).toBe("API error");
      expect(error.cause).toBe(cause);
    });
  });
});

describe("AnthropicGateway", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Reset modules before each test
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    // Note: These tests require mocking the Anthropic SDK constructor
    // because the SDK detects test environment as "browser" and throws
    // The actual initialization is tested via integration tests

    it("should throw error when no API key provided", async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const { AnthropicGateway } = await import("~/server/services/llm/anthropic");
      expect(() => new AnthropicGateway()).toThrow("ANTHROPIC_API_KEY is required");
    });
  });

  describe("generate", () => {
    it("should call Anthropic API with correct parameters", async () => {
      // Mock the Anthropic SDK
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: '{"result": "success"}' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: "claude-3-haiku-20240307",
      });

      vi.doMock("@anthropic-ai/sdk", () => ({
        default: class MockAnthropic {
          messages = { create: mockCreate };
        },
      }));

      process.env.ANTHROPIC_API_KEY = "test-api-key";

      const { AnthropicGateway } = await import("~/server/services/llm/anthropic");
      const gateway = new AnthropicGateway();

      const result = await gateway.generate({
        prompt: "Test prompt",
        systemPrompt: "You are helpful",
        maxTokens: 100,
        temperature: 0.5,
      });

      expect(result.text).toBe('{"result": "success"}');
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(5);
      expect(result.model).toBe("claude-3-haiku-20240307");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      expect(mockCreate).toHaveBeenCalledWith({
        model: "claude-3-haiku-20240307",
        max_tokens: 100,
        temperature: 0.5,
        system: "You are helpful",
        messages: [{ role: "user", content: "Test prompt" }],
      });
    });

    it("should handle multiple content blocks", async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [
          { type: "text", text: "Part 1" },
          { type: "text", text: " Part 2" },
        ],
        usage: { input_tokens: 10, output_tokens: 10 },
        model: "claude-3-haiku-20240307",
      });

      vi.doMock("@anthropic-ai/sdk", () => ({
        default: class MockAnthropic {
          messages = { create: mockCreate };
        },
      }));

      process.env.ANTHROPIC_API_KEY = "test-api-key";

      const { AnthropicGateway } = await import("~/server/services/llm/anthropic");
      const gateway = new AnthropicGateway();

      const result = await gateway.generate({
        prompt: "Test prompt",
        maxTokens: 100,
        temperature: 0.5,
      });

      expect(result.text).toBe("Part 1 Part 2");
    });

    it("should track request duration", async () => {
      const mockCreate = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          content: [{ type: "text", text: "response" }],
          usage: { input_tokens: 10, output_tokens: 5 },
          model: "claude-3-haiku-20240307",
        };
      });

      vi.doMock("@anthropic-ai/sdk", () => ({
        default: class MockAnthropic {
          messages = { create: mockCreate };
        },
      }));

      process.env.ANTHROPIC_API_KEY = "test-api-key";

      const { AnthropicGateway } = await import("~/server/services/llm/anthropic");
      const gateway = new AnthropicGateway();

      const result = await gateway.generate({
        prompt: "Test prompt",
        maxTokens: 100,
        temperature: 0.5,
      });

      expect(result.durationMs).toBeGreaterThanOrEqual(50);
    });
  });

  // Note: Error handling tests are covered by process-engine tests
  // which test the error mapping logic via mocked gateways.
  // The AnthropicGateway.mapError method is private and tested indirectly.
});
