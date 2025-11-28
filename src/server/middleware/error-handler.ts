/**
 * Centralized Error Handler Middleware
 *
 * Provides consistent error handling for all API endpoints.
 * Ensures standardized error response format and prevents internal detail leakage.
 *
 * @see docs/stories/4-3-error-response-contract.md
 * @see docs/architecture.md#Error-Handling-Matrix
 */

import { generateRequestId } from "~/lib/id";
import {
  ApiError,
  ErrorCode,
  ERROR_HTTP_STATUS,
  sanitizeErrorMessage,
  type ApiErrorResponse,
} from "~/lib/errors";
import { LLMError } from "~/server/services/llm/types";
import { ProcessEngineError } from "~/server/services/process/engine";

/**
 * Default retry-after value for retryable errors (in seconds).
 */
const DEFAULT_RETRY_AFTER = 30;

/**
 * Error codes that should include Retry-After header.
 */
const RETRYABLE_ERROR_CODES = new Set([
  ErrorCode.RATE_LIMITED,
  ErrorCode.RATE_LIMIT_EXCEEDED,
  ErrorCode.LLM_TIMEOUT,
  ErrorCode.LLM_ERROR,
]);

/**
 * Formats an error into a standardized API error response.
 *
 * @param error - The error to format
 * @param requestId - The request ID for tracing
 * @returns Formatted ApiErrorResponse object
 *
 * @see docs/stories/4-3-error-response-contract.md AC#1, AC#10
 */
export function formatErrorResponse(
  error: unknown,
  _requestId: string
): { body: ApiErrorResponse; statusCode: number; retryAfter?: number } {
  // Handle ApiError instances
  if (error instanceof ApiError) {
    return {
      body: error.toResponse(),
      statusCode: error.statusCode,
      retryAfter: error.retryAfter,
    };
  }

  // Handle LLMError instances
  if (error instanceof LLMError) {
    const code =
      error.code === "LLM_TIMEOUT"
        ? ErrorCode.LLM_TIMEOUT
        : error.code === "LLM_RATE_LIMITED"
          ? ErrorCode.RATE_LIMITED
          : ErrorCode.LLM_ERROR;

    const statusCode = ERROR_HTTP_STATUS[code];
    const retryAfter = DEFAULT_RETRY_AFTER;

    return {
      body: {
        success: false,
        error: {
          code,
          message: sanitizeErrorMessage(error.message, code),
          retry_after: retryAfter,
        },
      },
      statusCode,
      retryAfter,
    };
  }

  // Handle ProcessEngineError instances
  if (error instanceof ProcessEngineError) {
    const code =
      error.code === "OUTPUT_PARSE_FAILED"
        ? ErrorCode.OUTPUT_PARSE_FAILED
        : ErrorCode.INTERNAL_ERROR;

    return {
      body: {
        success: false,
        error: {
          code,
          message: sanitizeErrorMessage(error.message, code),
        },
      },
      statusCode: ERROR_HTTP_STATUS[code],
    };
  }

  // Handle generic Error instances
  if (error instanceof Error) {
    console.error("[Error Handler] Unknown error:", error);
    return {
      body: {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: sanitizeErrorMessage(error.message, ErrorCode.INTERNAL_ERROR),
        },
      },
      statusCode: 500,
    };
  }

  // Handle non-Error values
  console.error("[Error Handler] Non-Error thrown:", error);
  return {
    body: {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: "An unexpected error occurred. Please try again.",
      },
    },
    statusCode: 500,
  };
}

/**
 * Handles an error and returns a standardized Response object.
 *
 * This is the main entry point for error handling in API endpoints.
 * It catches any error type and returns a properly formatted Response
 * with appropriate HTTP status code, headers, and body.
 *
 * Features:
 * - Converts ApiError, LLMError, and ProcessEngineError to standardized format
 * - Sanitizes error messages to remove internal details (AC#10)
 * - Sets Retry-After header for retryable errors (AC#9)
 * - Logs internal errors for debugging
 * - Always includes X-Request-Id header
 *
 * @param error - The error to handle
 * @param requestId - The request ID for tracing (generated if not provided)
 * @returns Response object with standardized error format
 *
 * @example
 * ```typescript
 * try {
 *   // ... API logic ...
 * } catch (error) {
 *   return handleApiError(error, requestId);
 * }
 * ```
 *
 * @see docs/stories/4-3-error-response-contract.md AC#1, AC#9, AC#10
 */
export function handleApiError(
  error: unknown,
  requestId?: string
): Response {
  const reqId = requestId ?? generateRequestId();

  // Format the error into standardized response
  const { body, statusCode, retryAfter } = formatErrorResponse(error, reqId);

  // Build response headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-Id": reqId,
  };

  // Add Retry-After header for retryable errors (AC#9)
  if (retryAfter !== undefined) {
    headers["Retry-After"] = String(retryAfter);
  }

  return new Response(JSON.stringify(body), { status: statusCode, headers });
}

/**
 * Creates an ApiError from an error code with appropriate defaults.
 *
 * Utility function for creating consistent ApiError instances.
 *
 * @param code - The error code
 * @param message - Optional custom message (will be sanitized)
 * @param retryAfter - Optional retry-after value in seconds
 * @returns ApiError instance
 */
export function createApiError(
  code: ErrorCode,
  message?: string,
  retryAfter?: number
): ApiError {
  const defaultMessages: Partial<Record<ErrorCode, string>> = {
    [ErrorCode.UNAUTHORIZED]: "Invalid or missing API key",
    [ErrorCode.FORBIDDEN]: "API key lacks access to this resource",
    [ErrorCode.NOT_FOUND]: "Resource not found",
    [ErrorCode.VALIDATION_ERROR]: "Input validation failed",
    [ErrorCode.RATE_LIMITED]: "Rate limit exceeded",
    [ErrorCode.LLM_TIMEOUT]: "Intelligence service timed out. Please retry.",
    [ErrorCode.LLM_ERROR]: "Intelligence service temporarily unavailable. Please retry.",
    [ErrorCode.INTERNAL_ERROR]: "An unexpected error occurred. Please try again.",
  };

  const finalMessage = message
    ? sanitizeErrorMessage(message, code)
    : defaultMessages[code] ?? "An unexpected error occurred";

  // Auto-set retryAfter for retryable errors if not provided
  const finalRetryAfter =
    retryAfter ??
    (RETRYABLE_ERROR_CODES.has(code) ? DEFAULT_RETRY_AFTER : undefined);

  return new ApiError(
    code,
    finalMessage,
    ERROR_HTTP_STATUS[code],
    undefined,
    finalRetryAfter
  );
}
