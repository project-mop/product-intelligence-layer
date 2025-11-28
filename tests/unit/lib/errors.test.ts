/**
 * Unit Tests for API Error Classes
 *
 * Tests the ApiError class and error helper functions.
 *
 * @see src/lib/errors.ts
 * @see docs/stories/4-1-input-schema-validation.md
 * @see docs/stories/4-3-error-response-contract.md
 */

import { describe, expect, it } from "vitest";
import {
  ApiError,
  ErrorCode,
  ERROR_HTTP_STATUS,
  createValidationError,
  sanitizeErrorMessage,
  type ValidationIssue,
} from "~/lib/errors";

describe("ErrorCode", () => {
  it("should have VALIDATION_ERROR code", () => {
    expect(ErrorCode.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
  });

  it("should have all expected error codes", () => {
    expect(ErrorCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
    expect(ErrorCode.FORBIDDEN).toBe("FORBIDDEN");
    expect(ErrorCode.NOT_FOUND).toBe("NOT_FOUND");
    expect(ErrorCode.BAD_REQUEST).toBe("BAD_REQUEST");
    expect(ErrorCode.NOT_IMPLEMENTED).toBe("NOT_IMPLEMENTED");
    expect(ErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
    expect(ErrorCode.LLM_TIMEOUT).toBe("LLM_TIMEOUT");
    expect(ErrorCode.LLM_ERROR).toBe("LLM_ERROR");
    expect(ErrorCode.OUTPUT_PARSE_FAILED).toBe("OUTPUT_PARSE_FAILED");
    expect(ErrorCode.INVALID_INPUT).toBe("INVALID_INPUT");
    expect(ErrorCode.RATE_LIMITED).toBe("RATE_LIMITED");
  });

  it("should have RATE_LIMIT_EXCEEDED as deprecated alias for RATE_LIMITED (Story 4.3)", () => {
    // Both should resolve to the same string value
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe("RATE_LIMITED");
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe(ErrorCode.RATE_LIMITED);
  });
});

describe("ERROR_HTTP_STATUS", () => {
  it("should map VALIDATION_ERROR to 400", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.VALIDATION_ERROR]).toBe(400);
  });

  it("should map all error codes to appropriate HTTP status (Story 4.3 AC#2-8)", () => {
    // AC#2: HTTP 400 for VALIDATION_ERROR
    expect(ERROR_HTTP_STATUS[ErrorCode.VALIDATION_ERROR]).toBe(400);
    // AC#3: HTTP 401 for UNAUTHORIZED
    expect(ERROR_HTTP_STATUS[ErrorCode.UNAUTHORIZED]).toBe(401);
    // AC#4: HTTP 403 for FORBIDDEN
    expect(ERROR_HTTP_STATUS[ErrorCode.FORBIDDEN]).toBe(403);
    // AC#5: HTTP 404 for NOT_FOUND
    expect(ERROR_HTTP_STATUS[ErrorCode.NOT_FOUND]).toBe(404);
    // AC#6: HTTP 429 for RATE_LIMITED
    expect(ERROR_HTTP_STATUS[ErrorCode.RATE_LIMITED]).toBe(429);
    // AC#7: HTTP 500 for OUTPUT_VALIDATION_FAILED
    expect(ERROR_HTTP_STATUS[ErrorCode.OUTPUT_VALIDATION_FAILED]).toBe(500);
    // AC#8: HTTP 503 for LLM_TIMEOUT and LLM_ERROR
    expect(ERROR_HTTP_STATUS[ErrorCode.LLM_TIMEOUT]).toBe(503);
    expect(ERROR_HTTP_STATUS[ErrorCode.LLM_ERROR]).toBe(503);
    // Other codes
    expect(ERROR_HTTP_STATUS[ErrorCode.BAD_REQUEST]).toBe(400);
    expect(ERROR_HTTP_STATUS[ErrorCode.NOT_IMPLEMENTED]).toBe(501);
    expect(ERROR_HTTP_STATUS[ErrorCode.INTERNAL_ERROR]).toBe(500);
    expect(ERROR_HTTP_STATUS[ErrorCode.OUTPUT_PARSE_FAILED]).toBe(500);
    expect(ERROR_HTTP_STATUS[ErrorCode.INVALID_INPUT]).toBe(400);
  });
});

describe("ApiError", () => {
  describe("construction", () => {
    it("should construct with required parameters", () => {
      const error = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        "Input validation failed",
        400
      );

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe("Input validation failed");
      expect(error.statusCode).toBe(400);
      expect(error.details).toBeUndefined();
      expect(error.retryAfter).toBeUndefined();
    });

    it("should construct with details", () => {
      const issues: ValidationIssue[] = [
        { path: ["name"], message: "Required" },
      ];

      const error = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        "Input validation failed",
        400,
        { issues }
      );

      expect(error.details).toEqual({ issues });
    });

    it("should construct with retryAfter", () => {
      const error = new ApiError(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        "Rate limit exceeded",
        429,
        undefined,
        60
      );

      expect(error.retryAfter).toBe(60);
    });

    it("should extend Error", () => {
      const error = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        "Test error",
        400
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("ApiError");
    });
  });

  describe("toResponse", () => {
    it("should return standard error response format (AC #4)", () => {
      const error = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        "Input validation failed",
        400
      );

      const response = error.toResponse();

      expect(response).toEqual({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Input validation failed",
        },
      });
    });

    it("should include details when present (AC #4)", () => {
      const issues: ValidationIssue[] = [
        { path: ["productName"], message: "Required" },
        { path: ["price"], message: "Expected number, received string" },
      ];

      const error = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        "Input validation failed",
        400,
        { issues }
      );

      const response = error.toResponse();

      expect(response).toEqual({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Input validation failed",
          details: {
            issues: [
              { path: ["productName"], message: "Required" },
              { path: ["price"], message: "Expected number, received string" },
            ],
          },
        },
      });
    });

    it("should not include details when undefined", () => {
      const error = new ApiError(
        ErrorCode.NOT_FOUND,
        "Process not found",
        404
      );

      const response = error.toResponse();

      expect(response.error).not.toHaveProperty("details");
    });

    it("should handle nested paths in issues (AC #5)", () => {
      const issues: ValidationIssue[] = [
        { path: ["attributes", "price"], message: "Must be positive" },
      ];

      const error = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        "Input validation failed",
        400,
        { issues }
      );

      const response = error.toResponse();

      expect(response.error.details?.issues?.[0]?.path).toEqual([
        "attributes",
        "price",
      ]);
    });
  });
});

describe("createValidationError", () => {
  it("should create validation error with issues", () => {
    const issues: ValidationIssue[] = [
      { path: ["name"], message: "Required" },
    ];

    const error = createValidationError(issues);

    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toBe("Input validation failed");
    expect(error.statusCode).toBe(400);
    expect(error.details?.issues).toEqual(issues);
  });

  it("should create error with multiple issues (AC #6)", () => {
    const issues: ValidationIssue[] = [
      { path: ["productName"], message: "Required" },
      { path: ["category"], message: "Required" },
      { path: ["price"], message: "Expected number, received string" },
    ];

    const error = createValidationError(issues);

    expect(error.details?.issues?.length).toBe(3);
  });

  it("should create error with nested path issues (AC #5)", () => {
    const issues: ValidationIssue[] = [
      { path: ["attributes", "pricing", "amount"], message: "Must be positive" },
    ];

    const error = createValidationError(issues);

    expect(error.details?.issues?.[0]?.path).toEqual([
      "attributes",
      "pricing",
      "amount",
    ]);
  });

  it("should return ApiError instance", () => {
    const error = createValidationError([]);

    expect(error).toBeInstanceOf(ApiError);
  });

  it("should produce correct toResponse output", () => {
    const issues: ValidationIssue[] = [
      { path: ["productName"], message: "Required" },
    ];

    const error = createValidationError(issues);
    const response = error.toResponse();

    expect(response).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Input validation failed",
        details: {
          issues: [{ path: ["productName"], message: "Required" }],
        },
      },
    });
  });
});

/**
 * Story 4.3: Error Response Contract Tests
 *
 * Tests for the standardized error response format with retry_after support.
 */
describe("Story 4.3: Error Response Contract", () => {
  describe("ApiError.toResponse with retry_after (AC#1, AC#6, AC#8, AC#9)", () => {
    it("should include retry_after in response when set", () => {
      const error = new ApiError(
        ErrorCode.RATE_LIMITED,
        "Rate limit exceeded",
        429,
        undefined,
        60
      );

      const response = error.toResponse();

      expect(response).toEqual({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Rate limit exceeded",
          retry_after: 60,
        },
      });
    });

    it("should not include retry_after when not set", () => {
      const error = new ApiError(
        ErrorCode.NOT_FOUND,
        "Not found",
        404
      );

      const response = error.toResponse();

      expect(response.error).not.toHaveProperty("retry_after");
    });

    it("should include both details and retry_after when both set", () => {
      const error = new ApiError(
        ErrorCode.LLM_ERROR,
        "LLM service error",
        503,
        { provider: "anthropic" },
        30
      );

      const response = error.toResponse();

      expect(response).toEqual({
        success: false,
        error: {
          code: "LLM_ERROR",
          message: "LLM service error",
          details: { provider: "anthropic" },
          retry_after: 30,
        },
      });
    });

    it("should format LLM_TIMEOUT with retry_after (AC#8)", () => {
      const error = new ApiError(
        ErrorCode.LLM_TIMEOUT,
        "Request timed out",
        503,
        undefined,
        30
      );

      const response = error.toResponse();

      expect(response.error.code).toBe("LLM_TIMEOUT");
      expect(response.error.retry_after).toBe(30);
    });
  });

  describe("Standard error response format (AC#1)", () => {
    it("should have success: false", () => {
      const error = new ApiError(
        ErrorCode.INTERNAL_ERROR,
        "Something went wrong",
        500
      );

      const response = error.toResponse();

      expect(response.success).toBe(false);
    });

    it("should have error object with code and message", () => {
      const error = new ApiError(
        ErrorCode.FORBIDDEN,
        "Access denied",
        403
      );

      const response = error.toResponse();

      expect(response.error).toHaveProperty("code");
      expect(response.error).toHaveProperty("message");
      expect(typeof response.error.code).toBe("string");
      expect(typeof response.error.message).toBe("string");
    });
  });
});

describe("sanitizeErrorMessage (AC#10)", () => {
  it("should remove stack traces from error messages", () => {
    const message = "Error occurred at /Users/dev/project/src/api.ts:123:45";
    const sanitized = sanitizeErrorMessage(message);

    expect(sanitized).not.toContain("/Users/");
    expect(sanitized).not.toContain(":123:45");
  });

  it("should remove file paths from error messages", () => {
    const message = "Failed to load /home/user/app/config.ts";
    const sanitized = sanitizeErrorMessage(message);

    expect(sanitized).not.toContain("/home/");
    expect(sanitized).not.toContain(".ts");
  });

  it("should remove Windows file paths", () => {
    const message = "Error in C:\\Users\\dev\\project\\src\\api.ts";
    const sanitized = sanitizeErrorMessage(message);

    expect(sanitized).not.toContain("C:\\");
    expect(sanitized).not.toContain(".ts");
  });

  it("should remove node_modules paths", () => {
    const message = "Error from node_modules/@prisma/client/index.js";
    const sanitized = sanitizeErrorMessage(message);

    expect(sanitized).not.toContain("node_modules");
  });

  it("should preserve clean error messages", () => {
    const message = "Rate limit exceeded";
    const sanitized = sanitizeErrorMessage(message);

    expect(sanitized).toBe("Rate limit exceeded");
  });

  it("should return default message for empty result", () => {
    const message = "Error at /path/to/file.ts:10:5";
    const sanitized = sanitizeErrorMessage(message);

    expect(sanitized).toBe("An unexpected error occurred");
  });

  it("should return error-code-specific default for known codes", () => {
    const sanitized = sanitizeErrorMessage("Error:", ErrorCode.INTERNAL_ERROR);

    expect(sanitized).toBe("An unexpected error occurred. Please try again.");
  });

  it("should return LLM-specific default for LLM errors", () => {
    const sanitized = sanitizeErrorMessage("Error:", ErrorCode.LLM_TIMEOUT);

    expect(sanitized).toBe("Intelligence service timed out. Please retry.");
  });

  it("should not expose internal details in any case", () => {
    const messagesWithInternalDetails = [
      "TypeError: Cannot read property 'foo' of undefined at Object.<anonymous> (/src/index.ts:10:20)",
      "Error: Connection refused at /var/app/node_modules/pg/lib/client.js:123",
      "ENOENT: no such file or directory, open '/etc/secrets/config.json'",
    ];

    for (const message of messagesWithInternalDetails) {
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).not.toMatch(/\/[\w/.-]+\.(ts|js)/);
      expect(sanitized).not.toMatch(/:\d+:\d+/);
    }
  });
});
