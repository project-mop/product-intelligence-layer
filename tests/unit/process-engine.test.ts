/**
 * Process Engine Unit Tests
 *
 * Tests for the ProcessEngine service that orchestrates LLM generation.
 *
 * @see docs/stories/3-2-llm-gateway-integration.md
 * @see docs/testing-strategy-mvp.md
 */

import { describe, expect, it, vi } from "vitest";
import { ProcessEngine, ProcessEngineError } from "~/server/services/process/engine";
import type { LLMGateway, GenerateParams, GenerateResult } from "~/server/services/llm/types";
import { LLMError } from "~/server/services/llm/types";
import type { ProcessConfig } from "~/server/services/process/types";

/**
 * Create a mock LLM gateway for testing.
 */
function createMockGateway(
  generateFn: (params: GenerateParams) => Promise<GenerateResult>
): LLMGateway {
  return {
    generate: vi.fn(generateFn),
  };
}

/**
 * Base ProcessConfig for tests.
 */
const baseConfig: ProcessConfig = {
  systemPrompt: "Test system prompt",
  goal: "Generate test output",
  outputSchemaDescription: "{ result: string }",
  inputSchemaDescription: "{ input: string }",
  maxTokens: 1024,
  temperature: 0.3,
  cacheTtlSeconds: 900,
  cacheEnabled: true,
  requestsPerMinute: 60,
};

describe("ProcessEngine", () => {
  describe("successful generation", () => {
    it("should generate intelligence from valid JSON response", async () => {
      const mockGateway = createMockGateway(async () => ({
        text: '{"result": "success"}',
        usage: { inputTokens: 10, outputTokens: 5 },
        model: "claude-3-haiku",
        durationMs: 100,
      }));

      const engine = new ProcessEngine(mockGateway);
      const result = await engine.generateIntelligence(baseConfig, {
        input: "test",
      });

      expect(result.data).toEqual({ result: "success" });
      expect(result.meta.retried).toBe(false);
      expect(result.meta.model).toBe("claude-3-haiku");
      expect(result.meta.usage.inputTokens).toBe(10);
      expect(result.meta.usage.outputTokens).toBe(5);
    });

    it("should track latency in result meta", async () => {
      const mockGateway = createMockGateway(async () => {
        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          text: '{"data": "value"}',
          usage: { inputTokens: 10, outputTokens: 5 },
          model: "claude-3-haiku",
          durationMs: 50,
        };
      });

      const engine = new ProcessEngine(mockGateway);
      const result = await engine.generateIntelligence(baseConfig, {});

      // Use lower threshold to account for timer resolution variance
      expect(result.meta.latencyMs).toBeGreaterThanOrEqual(40);
    });

    it("should pass correct params to LLM gateway", async () => {
      const generateFn = vi.fn(async () => ({
        text: '{"result": "ok"}',
        usage: { inputTokens: 10, outputTokens: 5 },
        model: "claude-3-haiku",
        durationMs: 100,
      }));

      const mockGateway = createMockGateway(generateFn);
      const engine = new ProcessEngine(mockGateway);

      const customConfig: ProcessConfig = {
        ...baseConfig,
        maxTokens: 2048,
        temperature: 0.7,
      };

      await engine.generateIntelligence(customConfig, { name: "test" });

      expect(generateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 2048,
          temperature: 0.7,
        })
      );
    });

    it("should handle complex JSON structures", async () => {
      const complexData = {
        products: [
          { id: 1, name: "Widget", price: 9.99 },
          { id: 2, name: "Gadget", price: 19.99 },
        ],
        metadata: {
          count: 2,
          page: 1,
          hasMore: false,
        },
      };

      const mockGateway = createMockGateway(async () => ({
        text: JSON.stringify(complexData),
        usage: { inputTokens: 20, outputTokens: 30 },
        model: "claude-3-haiku",
        durationMs: 200,
      }));

      const engine = new ProcessEngine(mockGateway);
      const result = await engine.generateIntelligence(baseConfig, {});

      expect(result.data).toEqual(complexData);
      expect((result.data as typeof complexData).products).toHaveLength(2);
      expect((result.data as typeof complexData).metadata.count).toBe(2);
    });
  });

  describe("JSON parsing", () => {
    it("should extract JSON from markdown code blocks", async () => {
      const mockGateway = createMockGateway(async () => ({
        text: '```json\n{"result": "extracted"}\n```',
        usage: { inputTokens: 10, outputTokens: 10 },
        model: "claude-3-haiku",
        durationMs: 100,
      }));

      const engine = new ProcessEngine(mockGateway);
      const result = await engine.generateIntelligence(baseConfig, {});

      expect(result.data).toEqual({ result: "extracted" });
    });

    it("should extract JSON from text with surrounding content", async () => {
      const mockGateway = createMockGateway(async () => ({
        text: 'Here is the result: {"result": "found"} as requested.',
        usage: { inputTokens: 10, outputTokens: 10 },
        model: "claude-3-haiku",
        durationMs: 100,
      }));

      const engine = new ProcessEngine(mockGateway);
      const result = await engine.generateIntelligence(baseConfig, {});

      expect(result.data).toEqual({ result: "found" });
    });
  });

  describe("retry on parse failure", () => {
    it("should retry once on first parse failure", async () => {
      let callCount = 0;
      const mockGateway = createMockGateway(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            text: "This is not valid JSON",
            usage: { inputTokens: 10, outputTokens: 5 },
            model: "claude-3-haiku",
            durationMs: 100,
          };
        }
        return {
          text: '{"result": "success after retry"}',
          usage: { inputTokens: 15, outputTokens: 8 },
          model: "claude-3-haiku",
          durationMs: 150,
        };
      });

      const engine = new ProcessEngine(mockGateway);
      const result = await engine.generateIntelligence(baseConfig, {});

      expect(callCount).toBe(2);
      expect(result.data).toEqual({ result: "success after retry" });
      expect(result.meta.retried).toBe(true);
    });

    it("should aggregate token usage on retry", async () => {
      let callCount = 0;
      const mockGateway = createMockGateway(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            text: "Invalid JSON",
            usage: { inputTokens: 10, outputTokens: 5 },
            model: "claude-3-haiku",
            durationMs: 100,
          };
        }
        return {
          text: '{"success": true}',
          usage: { inputTokens: 15, outputTokens: 8 },
          model: "claude-3-haiku",
          durationMs: 150,
        };
      });

      const engine = new ProcessEngine(mockGateway);
      const result = await engine.generateIntelligence(baseConfig, {});

      // Should sum tokens from both calls
      expect(result.meta.usage.inputTokens).toBe(25); // 10 + 15
      expect(result.meta.usage.outputTokens).toBe(13); // 5 + 8
    });

    it("should use enhanced prompt on retry", async () => {
      const generateCalls: GenerateParams[] = [];
      let callCount = 0;

      const mockGateway = createMockGateway(async (params) => {
        generateCalls.push(params);
        callCount++;
        if (callCount === 1) {
          return {
            text: "Not JSON",
            usage: { inputTokens: 10, outputTokens: 5 },
            model: "claude-3-haiku",
            durationMs: 100,
          };
        }
        return {
          text: '{"ok": true}',
          usage: { inputTokens: 15, outputTokens: 5 },
          model: "claude-3-haiku",
          durationMs: 100,
        };
      });

      const engine = new ProcessEngine(mockGateway);
      await engine.generateIntelligence(baseConfig, {});

      expect(generateCalls).toHaveLength(2);

      // Second call should have enhanced system prompt
      const retryPrompt = generateCalls[1]!.systemPrompt!;
      expect(retryPrompt).toContain("PREVIOUS ATTEMPT FAILED VALIDATION");
    });

    it("should throw OUTPUT_PARSE_FAILED after two failures", async () => {
      const mockGateway = createMockGateway(async () => ({
        text: "This will never be valid JSON {{}}}}",
        usage: { inputTokens: 10, outputTokens: 5 },
        model: "claude-3-haiku",
        durationMs: 100,
      }));

      const engine = new ProcessEngine(mockGateway);

      await expect(
        engine.generateIntelligence(baseConfig, {})
      ).rejects.toThrow(ProcessEngineError);

      try {
        await engine.generateIntelligence(baseConfig, {});
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessEngineError);
        expect((error as ProcessEngineError).code).toBe("OUTPUT_PARSE_FAILED");
      }
    });
  });

  describe("error propagation", () => {
    it("should propagate LLM_TIMEOUT errors", async () => {
      const mockGateway = createMockGateway(async () => {
        throw new LLMError("LLM_TIMEOUT", "Request timed out");
      });

      const engine = new ProcessEngine(mockGateway);

      await expect(
        engine.generateIntelligence(baseConfig, {})
      ).rejects.toThrow(LLMError);

      try {
        await engine.generateIntelligence(baseConfig, {});
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe("LLM_TIMEOUT");
      }
    });

    it("should propagate LLM_ERROR errors", async () => {
      const mockGateway = createMockGateway(async () => {
        throw new LLMError("LLM_ERROR", "API error");
      });

      const engine = new ProcessEngine(mockGateway);

      await expect(
        engine.generateIntelligence(baseConfig, {})
      ).rejects.toThrow(LLMError);
    });

    it("should propagate LLM_RATE_LIMITED errors", async () => {
      const mockGateway = createMockGateway(async () => {
        throw new LLMError("LLM_RATE_LIMITED", "Rate limited");
      });

      const engine = new ProcessEngine(mockGateway);

      try {
        await engine.generateIntelligence(baseConfig, {});
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe("LLM_RATE_LIMITED");
      }
    });

    it("should propagate LLM errors during retry", async () => {
      let callCount = 0;
      const mockGateway = createMockGateway(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            text: "Not JSON",
            usage: { inputTokens: 10, outputTokens: 5 },
            model: "claude-3-haiku",
            durationMs: 100,
          };
        }
        // Fail on retry with LLM error
        throw new LLMError("LLM_ERROR", "API error on retry");
      });

      const engine = new ProcessEngine(mockGateway);

      await expect(
        engine.generateIntelligence(baseConfig, {})
      ).rejects.toThrow(LLMError);
    });
  });

  describe("ProcessEngineError", () => {
    it("should create error with code and message", () => {
      const error = new ProcessEngineError(
        "OUTPUT_PARSE_FAILED",
        "Could not parse JSON"
      );

      expect(error.code).toBe("OUTPUT_PARSE_FAILED");
      expect(error.message).toBe("Could not parse JSON");
      expect(error.name).toBe("ProcessEngineError");
    });

    it("should create error with cause", () => {
      const cause = new Error("Parse error");
      const error = new ProcessEngineError(
        "OUTPUT_PARSE_FAILED",
        "Could not parse JSON",
        cause
      );

      expect(error.cause).toBe(cause);
    });
  });
});
