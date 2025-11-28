/**
 * Unit Tests for API Error Classes
 *
 * Tests the ApiError class and error helper functions.
 *
 * @see src/lib/errors.ts
 * @see docs/stories/4-1-input-schema-validation.md
 */

import { describe, expect, it } from "vitest";
import {
  ApiError,
  ErrorCode,
  ERROR_HTTP_STATUS,
  createValidationError,
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
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe("RATE_LIMIT_EXCEEDED");
  });
});

describe("ERROR_HTTP_STATUS", () => {
  it("should map VALIDATION_ERROR to 400", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.VALIDATION_ERROR]).toBe(400);
  });

  it("should map all error codes to appropriate HTTP status", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.UNAUTHORIZED]).toBe(401);
    expect(ERROR_HTTP_STATUS[ErrorCode.FORBIDDEN]).toBe(403);
    expect(ERROR_HTTP_STATUS[ErrorCode.NOT_FOUND]).toBe(404);
    expect(ERROR_HTTP_STATUS[ErrorCode.BAD_REQUEST]).toBe(400);
    expect(ERROR_HTTP_STATUS[ErrorCode.NOT_IMPLEMENTED]).toBe(501);
    expect(ERROR_HTTP_STATUS[ErrorCode.INTERNAL_ERROR]).toBe(500);
    expect(ERROR_HTTP_STATUS[ErrorCode.LLM_TIMEOUT]).toBe(503);
    expect(ERROR_HTTP_STATUS[ErrorCode.LLM_ERROR]).toBe(503);
    expect(ERROR_HTTP_STATUS[ErrorCode.OUTPUT_PARSE_FAILED]).toBe(500);
    expect(ERROR_HTTP_STATUS[ErrorCode.INVALID_INPUT]).toBe(400);
    expect(ERROR_HTTP_STATUS[ErrorCode.RATE_LIMIT_EXCEEDED]).toBe(429);
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
