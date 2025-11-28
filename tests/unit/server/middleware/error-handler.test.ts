/**
 * Unit Tests for Centralized Error Handler Middleware
 *
 * Tests the handleApiError function and formatErrorResponse utility.
 *
 * @see src/server/middleware/error-handler.ts
 * @see docs/stories/4-3-error-response-contract.md
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  handleApiError,
  formatErrorResponse,
  createApiError,
} from "~/server/middleware/error-handler";
import { ApiError, ErrorCode } from "~/lib/errors";
import { LLMError } from "~/server/services/llm/types";
import { ProcessEngineError } from "~/server/services/process/engine";

describe("formatErrorResponse", () => {
  describe("ApiError handling", () => {
    it("should format ApiError with standard structure (AC#1)", () => {
      const error = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        "Input validation failed",
        400,
        { issues: [{ path: ["name"], message: "Required" }] }
      );

      const result = formatErrorResponse(error, "req-123");

      expect(result.body.success).toBe(false);
      expect(result.body.error.code).toBe("VALIDATION_ERROR");
      expect(result.body.error.message).toBe("Input validation failed");
      expect(result.statusCode).toBe(400);
    });

    it("should include retry_after for rate limited errors (AC#6)", () => {
      const error = new ApiError(
        ErrorCode.RATE_LIMITED,
        "Rate limit exceeded",
        429,
        undefined,
        60
      );

      const result = formatErrorResponse(error, "req-123");

      expect(result.body.error.retry_after).toBe(60);
      expect(result.retryAfter).toBe(60);
      expect(result.statusCode).toBe(429);
    });

    it("should include retry_after for LLM timeout (AC#8)", () => {
      const error = new ApiError(
        ErrorCode.LLM_TIMEOUT,
        "Request timed out",
        503,
        undefined,
        30
      );

      const result = formatErrorResponse(error, "req-123");

      expect(result.body.error.retry_after).toBe(30);
      expect(result.statusCode).toBe(503);
    });
  });

  describe("LLMError handling", () => {
    it("should format LLM_TIMEOUT as 503 with retry_after (AC#8)", () => {
      const error = new LLMError("LLM_TIMEOUT", "Request timed out");

      const result = formatErrorResponse(error, "req-123");

      expect(result.body.error.code).toBe(ErrorCode.LLM_TIMEOUT);
      expect(result.statusCode).toBe(503);
      expect(result.retryAfter).toBe(30);
    });

    it("should format LLM_RATE_LIMITED as 429 with retry_after (AC#6)", () => {
      const error = new LLMError("LLM_RATE_LIMITED", "Rate limit exceeded");

      const result = formatErrorResponse(error, "req-123");

      expect(result.body.error.code).toBe(ErrorCode.RATE_LIMITED);
      expect(result.statusCode).toBe(429);
      expect(result.retryAfter).toBe(30);
    });

    it("should format other LLM errors as 503 LLM_ERROR (AC#8)", () => {
      const error = new LLMError("LLM_ERROR", "Service unavailable");

      const result = formatErrorResponse(error, "req-123");

      expect(result.body.error.code).toBe(ErrorCode.LLM_ERROR);
      expect(result.statusCode).toBe(503);
    });
  });

  describe("ProcessEngineError handling", () => {
    it("should format OUTPUT_PARSE_FAILED as 500", () => {
      const error = new ProcessEngineError(
        "OUTPUT_PARSE_FAILED",
        "Failed to parse output"
      );

      const result = formatErrorResponse(error, "req-123");

      expect(result.body.error.code).toBe(ErrorCode.OUTPUT_PARSE_FAILED);
      expect(result.statusCode).toBe(500);
    });

    it("should format unknown process errors as 500 INTERNAL_ERROR", () => {
      const error = new ProcessEngineError(
        "UNKNOWN_ERROR" as "OUTPUT_PARSE_FAILED",
        "Unknown error"
      );

      const result = formatErrorResponse(error, "req-123");

      expect(result.body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(result.statusCode).toBe(500);
    });
  });

  describe("Unknown error handling (AC#10)", () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("should format generic Error as 500 INTERNAL_ERROR", () => {
      const error = new Error("Something went wrong");

      const result = formatErrorResponse(error, "req-123");

      expect(result.body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(result.statusCode).toBe(500);
    });

    it("should sanitize error message from generic Error", () => {
      const error = new Error("Error at /Users/dev/src/api.ts:123:45");

      const result = formatErrorResponse(error, "req-123");

      expect(result.body.error.message).not.toContain("/Users/");
      expect(result.body.error.message).not.toContain(":123:45");
    });

    it("should handle non-Error values", () => {
      const result = formatErrorResponse("string error", "req-123");

      expect(result.body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(result.body.error.message).toBe(
        "An unexpected error occurred. Please try again."
      );
      expect(result.statusCode).toBe(500);
    });

    it("should log unknown errors for debugging", () => {
      const error = new Error("Test error");

      formatErrorResponse(error, "req-123");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Error Handler] Unknown error:",
        error
      );
    });
  });
});

describe("handleApiError", () => {
  describe("Response format (AC#1)", () => {
    it("should return Response object with JSON body", async () => {
      const error = new ApiError(
        ErrorCode.NOT_FOUND,
        "Resource not found",
        404
      );

      const response = handleApiError(error, "req-123");

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get("Content-Type")).toBe("application/json");

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("should include X-Request-Id header", () => {
      const error = new ApiError(
        ErrorCode.FORBIDDEN,
        "Access denied",
        403
      );

      const response = handleApiError(error, "test-request-id");

      expect(response.headers.get("X-Request-Id")).toBe("test-request-id");
    });

    it("should generate request ID if not provided", () => {
      const error = new ApiError(
        ErrorCode.INTERNAL_ERROR,
        "Error",
        500
      );

      const response = handleApiError(error);

      expect(response.headers.get("X-Request-Id")).toBeTruthy();
    });
  });

  describe("Retry-After header (AC#9)", () => {
    it("should include Retry-After header for 429 responses", async () => {
      const error = new ApiError(
        ErrorCode.RATE_LIMITED,
        "Rate limit exceeded",
        429,
        undefined,
        60
      );

      const response = handleApiError(error, "req-123");

      expect(response.headers.get("Retry-After")).toBe("60");
      expect(response.status).toBe(429);

      const body = await response.json();
      expect(body.error.retry_after).toBe(60);
    });

    it("should include Retry-After header for 503 responses", async () => {
      const error = new ApiError(
        ErrorCode.LLM_TIMEOUT,
        "Request timed out",
        503,
        undefined,
        30
      );

      const response = handleApiError(error, "req-123");

      expect(response.headers.get("Retry-After")).toBe("30");
      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.error.retry_after).toBe(30);
    });

    it("should not include Retry-After header for non-retryable errors", () => {
      const error = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        "Invalid input",
        400
      );

      const response = handleApiError(error, "req-123");

      expect(response.headers.get("Retry-After")).toBeNull();
    });
  });

  describe("HTTP status codes (AC#2-8)", () => {
    it("should return 400 for VALIDATION_ERROR (AC#2)", () => {
      const error = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        "Validation failed",
        400
      );

      const response = handleApiError(error);

      expect(response.status).toBe(400);
    });

    it("should return 401 for UNAUTHORIZED (AC#3)", () => {
      const error = new ApiError(
        ErrorCode.UNAUTHORIZED,
        "Invalid API key",
        401
      );

      const response = handleApiError(error);

      expect(response.status).toBe(401);
    });

    it("should return 403 for FORBIDDEN (AC#4)", () => {
      const error = new ApiError(
        ErrorCode.FORBIDDEN,
        "Access denied",
        403
      );

      const response = handleApiError(error);

      expect(response.status).toBe(403);
    });

    it("should return 404 for NOT_FOUND (AC#5)", () => {
      const error = new ApiError(
        ErrorCode.NOT_FOUND,
        "Not found",
        404
      );

      const response = handleApiError(error);

      expect(response.status).toBe(404);
    });

    it("should return 429 for RATE_LIMITED (AC#6)", () => {
      const error = new ApiError(
        ErrorCode.RATE_LIMITED,
        "Rate limit exceeded",
        429,
        undefined,
        60
      );

      const response = handleApiError(error);

      expect(response.status).toBe(429);
    });

    it("should return 500 for OUTPUT_VALIDATION_FAILED (AC#7)", () => {
      const error = new ApiError(
        ErrorCode.OUTPUT_VALIDATION_FAILED,
        "Output validation failed",
        500
      );

      const response = handleApiError(error);

      expect(response.status).toBe(500);
    });

    it("should return 503 for LLM_TIMEOUT (AC#8)", () => {
      const error = new ApiError(
        ErrorCode.LLM_TIMEOUT,
        "Timeout",
        503,
        undefined,
        30
      );

      const response = handleApiError(error);

      expect(response.status).toBe(503);
    });

    it("should return 503 for LLM_ERROR (AC#8)", () => {
      const error = new ApiError(
        ErrorCode.LLM_ERROR,
        "LLM error",
        503,
        undefined,
        30
      );

      const response = handleApiError(error);

      expect(response.status).toBe(503);
    });
  });
});

describe("createApiError", () => {
  it("should create ApiError with defaults", () => {
    const error = createApiError(ErrorCode.UNAUTHORIZED);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(error.message).toBe("Invalid or missing API key");
    expect(error.statusCode).toBe(401);
  });

  it("should use custom message when provided", () => {
    const error = createApiError(ErrorCode.FORBIDDEN, "Custom forbidden message");

    expect(error.message).toBe("Custom forbidden message");
  });

  it("should auto-set retryAfter for retryable errors", () => {
    const rateLimitedError = createApiError(ErrorCode.RATE_LIMITED);
    const llmTimeoutError = createApiError(ErrorCode.LLM_TIMEOUT);
    const llmError = createApiError(ErrorCode.LLM_ERROR);

    expect(rateLimitedError.retryAfter).toBe(30);
    expect(llmTimeoutError.retryAfter).toBe(30);
    expect(llmError.retryAfter).toBe(30);
  });

  it("should not set retryAfter for non-retryable errors", () => {
    const notFoundError = createApiError(ErrorCode.NOT_FOUND);
    const validationError = createApiError(ErrorCode.VALIDATION_ERROR);

    expect(notFoundError.retryAfter).toBeUndefined();
    expect(validationError.retryAfter).toBeUndefined();
  });

  it("should use custom retryAfter when provided", () => {
    const error = createApiError(ErrorCode.RATE_LIMITED, undefined, 120);

    expect(error.retryAfter).toBe(120);
  });

  it("should sanitize custom messages", () => {
    const error = createApiError(
      ErrorCode.INTERNAL_ERROR,
      "Error at /Users/dev/src/api.ts:123"
    );

    expect(error.message).not.toContain("/Users/");
    expect(error.message).not.toContain(".ts");
  });
});
