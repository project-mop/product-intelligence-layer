/**
 * Unit Tests for Retry Handler
 *
 * Tests the validateOutputWithRetry function for handling
 * output validation with automatic retry on failure.
 *
 * @see src/server/services/process/retry-handler.ts
 * @see docs/stories/4-2-output-schema-enforcement.md
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  validateOutputWithRetry,
  redactPii,
} from "~/server/services/process/retry-handler";
import type { LLMGateway, GenerateResult } from "~/server/services/llm/types";
import type { AssembledPrompt } from "~/server/services/process/prompt";
import type { ProcessConfig } from "~/server/services/process/types";
import { ErrorCode } from "~/lib/errors";

// Mock LLM gateway
function createMockGateway(responses: GenerateResult[]): LLMGateway {
  let callCount = 0;
  return {
    generate: vi.fn().mockImplementation(() => {
      const response = responses[callCount];
      callCount++;
      return Promise.resolve(response);
    }),
  };
}

// Test fixtures
const testSchema = {
  type: "object" as const,
  required: ["shortDescription"],
  properties: {
    shortDescription: { type: "string" as const, minLength: 1 },
    price: { type: "number" as const },
  },
};

const testPrompt: AssembledPrompt = {
  system: "You are a helpful assistant. Output JSON only.",
  user: '{"productName": "Widget"}',
};

const testConfig: ProcessConfig = {
  systemPrompt: "Test system prompt",
  maxTokens: 1024,
  temperature: 0.3,
  inputSchemaDescription: "Test input",
  outputSchemaDescription: "Test output",
  goal: "Generate product intelligence",
  cacheTtlSeconds: 900,
  cacheEnabled: true,
  requestsPerMinute: 60,
};

const testContext = {
  requestId: "req-123",
  processId: "proc-456",
  tenantId: "tenant-789",
};

function createLlmResult(text: string): GenerateResult {
  return {
    text,
    usage: { inputTokens: 100, outputTokens: 50 },
    model: "claude-sonnet-4-20250514",
    durationMs: 500,
  };
}

describe("validateOutputWithRetry", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("successful first attempt (no retry)", () => {
    it("should return validated data on first attempt success", async () => {
      const validResponse = JSON.stringify({
        shortDescription: "A great product",
        price: 29.99,
      });

      const gateway = createMockGateway([createLlmResult(validResponse)]);

      const result = await validateOutputWithRetry(
        testSchema,
        createLlmResult(validResponse),
        gateway,
        testPrompt,
        testConfig,
        testContext
      );

      expect(result.data).toEqual({
        shortDescription: "A great product",
        price: 29.99,
      });
      expect(result.retried).toBe(false);
      expect(result.attempts).toBe(1);
      expect(result.attemptResults).toHaveLength(1);
      expect(result.attemptResults[0]?.validationSuccess).toBe(true);

      // LLM gateway should not have been called (initial response was valid)
      expect(gateway.generate).not.toHaveBeenCalled();
    });
  });

  describe("first attempt fails, second succeeds (AC #3, #4)", () => {
    it("should retry on JSON parse failure and succeed", async () => {
      const invalidJson = "This is not valid JSON";
      const validResponse = JSON.stringify({
        shortDescription: "A great product",
      });

      const gateway = createMockGateway([createLlmResult(validResponse)]);

      const result = await validateOutputWithRetry(
        testSchema,
        createLlmResult(invalidJson),
        gateway,
        testPrompt,
        testConfig,
        testContext
      );

      expect(result.data).toEqual({ shortDescription: "A great product" });
      expect(result.retried).toBe(true);
      expect(result.attempts).toBe(2);
      expect(result.attemptResults).toHaveLength(2);
      expect(result.attemptResults[0]?.parseSuccess).toBe(false);
      expect(result.attemptResults[1]?.validationSuccess).toBe(true);

      // LLM gateway should have been called for retry
      expect(gateway.generate).toHaveBeenCalledTimes(1);
    });

    it("should retry on schema validation failure and succeed", async () => {
      // First response is valid JSON but missing required field
      const invalidSchema = JSON.stringify({ price: 29.99 });
      const validResponse = JSON.stringify({
        shortDescription: "A great product",
      });

      const gateway = createMockGateway([createLlmResult(validResponse)]);

      const result = await validateOutputWithRetry(
        testSchema,
        createLlmResult(invalidSchema),
        gateway,
        testPrompt,
        testConfig,
        testContext
      );

      expect(result.data).toEqual({ shortDescription: "A great product" });
      expect(result.retried).toBe(true);
      expect(result.attempts).toBe(2);
      expect(result.attemptResults[0]?.parseSuccess).toBe(true);
      expect(result.attemptResults[0]?.validationSuccess).toBe(false);
      expect(result.attemptResults[1]?.validationSuccess).toBe(true);
    });
  });

  describe("retry prompt format (AC #5)", () => {
    it("should include schema description in retry prompt", async () => {
      const invalidJson = "Invalid JSON";
      const validResponse = JSON.stringify({
        shortDescription: "A great product",
      });

      const gateway = createMockGateway([createLlmResult(validResponse)]);

      await validateOutputWithRetry(
        testSchema,
        createLlmResult(invalidJson),
        gateway,
        testPrompt,
        testConfig,
        testContext
      );

      // Check that the retry prompt includes schema and error message
      const generateCall = vi.mocked(gateway.generate).mock.calls[0];
      const systemPrompt = generateCall?.[0]?.systemPrompt;

      expect(systemPrompt).toContain("PREVIOUS ATTEMPT FAILED VALIDATION");
      expect(systemPrompt).toContain("shortDescription");
      expect(systemPrompt).toContain("CRITICAL REQUIREMENTS");
      expect(systemPrompt).toContain("Output ONLY valid JSON");
    });

    it("should include previous validation errors in retry prompt", async () => {
      // First response missing required field
      const invalidSchema = JSON.stringify({ price: 29.99 });
      const validResponse = JSON.stringify({
        shortDescription: "A great product",
      });

      const gateway = createMockGateway([createLlmResult(validResponse)]);

      await validateOutputWithRetry(
        testSchema,
        createLlmResult(invalidSchema),
        gateway,
        testPrompt,
        testConfig,
        testContext
      );

      const generateCall = vi.mocked(gateway.generate).mock.calls[0];
      const systemPrompt = generateCall?.[0]?.systemPrompt;

      expect(systemPrompt).toContain("Previous error:");
      expect(systemPrompt).toContain("shortDescription");
    });
  });

  describe("both attempts fail (AC #6)", () => {
    it("should throw OUTPUT_VALIDATION_FAILED after two failures", async () => {
      const invalidJson = "Invalid JSON";
      const stillInvalidJson = "Still not valid JSON";

      const gateway = createMockGateway([createLlmResult(stillInvalidJson)]);

      await expect(
        validateOutputWithRetry(
          testSchema,
          createLlmResult(invalidJson),
          gateway,
          testPrompt,
          testConfig,
          testContext
        )
      ).rejects.toMatchObject({
        code: ErrorCode.OUTPUT_VALIDATION_FAILED,
        message: "Failed to generate valid response after retry",
      });
    });

    it("should include field-level errors in thrown error (AC #7)", async () => {
      const invalidSchema = JSON.stringify({ price: 29.99 });
      const stillInvalid = JSON.stringify({ wrongField: "value" });

      const gateway = createMockGateway([createLlmResult(stillInvalid)]);

      try {
        await validateOutputWithRetry(
          testSchema,
          createLlmResult(invalidSchema),
          gateway,
          testPrompt,
          testConfig,
          testContext
        );
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toMatchObject({
          code: ErrorCode.OUTPUT_VALIDATION_FAILED,
          details: {
            issues: expect.arrayContaining([
              expect.objectContaining({
                path: expect.any(Array),
                message: expect.any(String),
              }),
            ]),
          },
        });
      }
    });
  });

  describe("logging both attempts (AC #10)", () => {
    it("should log attempt details", async () => {
      const validResponse = JSON.stringify({
        shortDescription: "A great product",
      });

      const gateway = createMockGateway([]);

      await validateOutputWithRetry(
        testSchema,
        createLlmResult(validResponse),
        gateway,
        testPrompt,
        testConfig,
        testContext
      );

      // Should log successful attempt
      expect(console.info).toHaveBeenCalledWith(
        "[RetryHandler] Validation attempt succeeded",
        expect.objectContaining({
          type: "output_validation_attempt",
          requestId: "req-123",
          processId: "proc-456",
          tenantId: "tenant-789",
          attempt: 1,
          validationSuccess: true,
        })
      );
    });

    it("should log failed attempts with error details", async () => {
      const invalidJson = "Invalid JSON";
      const validResponse = JSON.stringify({
        shortDescription: "A great product",
      });

      const gateway = createMockGateway([createLlmResult(validResponse)]);

      await validateOutputWithRetry(
        testSchema,
        createLlmResult(invalidJson),
        gateway,
        testPrompt,
        testConfig,
        testContext
      );

      // Should log failed first attempt
      expect(console.warn).toHaveBeenCalledWith(
        "[RetryHandler] Validation attempt failed",
        expect.objectContaining({
          attempt: 1,
          validationSuccess: false,
        })
      );

      // Should log successful second attempt
      expect(console.info).toHaveBeenCalledWith(
        "[RetryHandler] Validation attempt succeeded",
        expect.objectContaining({
          attempt: 2,
          validationSuccess: true,
        })
      );
    });

    it("should include attempt results in return value", async () => {
      const invalidSchema = JSON.stringify({ price: 29.99 });
      const validResponse = JSON.stringify({
        shortDescription: "A great product",
      });

      const gateway = createMockGateway([createLlmResult(validResponse)]);

      const result = await validateOutputWithRetry(
        testSchema,
        createLlmResult(invalidSchema),
        gateway,
        testPrompt,
        testConfig,
        testContext
      );

      expect(result.attemptResults).toHaveLength(2);

      // First attempt
      expect(result.attemptResults[0]).toMatchObject({
        attempt: 1,
        parseSuccess: true,
        validationSuccess: false,
        validationErrors: expect.arrayContaining([
          expect.objectContaining({
            path: expect.any(Array),
          }),
        ]),
      });

      // Second attempt
      expect(result.attemptResults[1]).toMatchObject({
        attempt: 2,
        parseSuccess: true,
        validationSuccess: true,
      });
    });
  });
});

describe("redactPii", () => {
  it("should redact email addresses", () => {
    const text = "Contact us at test@example.com for more info";
    const redacted = redactPii(text);
    expect(redacted).toBe("Contact us at [EMAIL_REDACTED] for more info");
  });

  it("should redact phone numbers", () => {
    const text = "Call us at 555-123-4567 or 555.123.4567";
    const redacted = redactPii(text);
    expect(redacted).toContain("[PHONE_REDACTED]");
  });

  it("should redact credit card numbers", () => {
    const text = "Card: 4111-1111-1111-1111";
    const redacted = redactPii(text);
    expect(redacted).toContain("[CC_REDACTED]");
  });

  it("should redact SSN", () => {
    const text = "SSN: 123-45-6789";
    const redacted = redactPii(text);
    expect(redacted).toContain("[SSN_REDACTED]");
  });

  it("should handle text without PII", () => {
    const text = "This is a normal product description";
    const redacted = redactPii(text);
    expect(redacted).toBe(text);
  });
});
