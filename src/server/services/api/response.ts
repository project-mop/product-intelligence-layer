/**
 * API Response Helpers
 *
 * Standard response format utilities for public REST API endpoints.
 * Ensures consistent response structure across all intelligence endpoints.
 *
 * @see docs/tech-spec-epic-3.md#Response-Format
 * @see docs/architecture.md#Public-API-Patterns
 * @see docs/stories/4-3-error-response-contract.md
 */

import { generateRequestId } from "~/lib/id";

/**
 * API version for response metadata.
 */
const API_VERSION = "1.0.0";

/**
 * Standard success response metadata.
 */
export interface ResponseMeta {
  version: string;
  cached: boolean;
  latency_ms: number;
  request_id: string;
}

/**
 * Standard success response format.
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: ResponseMeta;
}

/**
 * Standard error response format.
 * @see docs/stories/4-3-error-response-contract.md AC#1
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    /** Seconds to wait before retrying (for 429/503 responses) */
    retry_after?: number;
  };
}

/**
 * API error codes.
 */
export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "NOT_IMPLEMENTED"
  | "INTERNAL_ERROR"
  | "LLM_TIMEOUT"
  | "LLM_ERROR"
  | "OUTPUT_PARSE_FAILED"
  | "OUTPUT_VALIDATION_FAILED"
  | "INVALID_INPUT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED";

/**
 * HTTP status codes for each error code.
 * @see docs/architecture.md#Error-Handling-Matrix
 */
const ERROR_STATUS_CODES: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  NOT_IMPLEMENTED: 501,
  INTERNAL_ERROR: 500,
  LLM_TIMEOUT: 503,
  LLM_ERROR: 503,
  OUTPUT_PARSE_FAILED: 500,
  OUTPUT_VALIDATION_FAILED: 500, // Server error per AC #7
  INVALID_INPUT: 400,
  VALIDATION_ERROR: 400,
  RATE_LIMITED: 429,
};

/**
 * Creates a successful API response with standard format.
 *
 * @param data - The response data
 * @param requestId - The request ID (generated if not provided)
 * @param startTime - Start time for latency calculation
 * @param cached - Whether the response was cached
 * @returns Response object with JSON body and headers
 *
 * @example
 * ```typescript
 * const startTime = Date.now();
 * // ... process request ...
 * return createSuccessResponse({ result: "data" }, requestId, startTime);
 * ```
 */
export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  startTime: number,
  cached = false
): Response {
  const latency_ms = Date.now() - startTime;

  const body: SuccessResponse<T> = {
    success: true,
    data,
    meta: {
      version: API_VERSION,
      cached,
      latency_ms,
      request_id: requestId,
    },
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
      "X-Cache": cached ? "HIT" : "MISS",
    },
  });
}

/**
 * Options for creating error responses.
 */
export interface CreateErrorResponseOptions {
  /** Request ID for tracing */
  requestId?: string;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** Retry-After value in seconds (for 429/503 responses) */
  retryAfter?: number;
}

/**
 * Creates an error API response with standard format.
 *
 * @param code - The error code
 * @param message - Human-readable error message
 * @param options - Optional response configuration
 * @returns Response object with JSON body and headers
 *
 * @example
 * ```typescript
 * // Simple error
 * return createErrorResponse("NOT_FOUND", "Process not found", { requestId });
 *
 * // With Retry-After (for 429/503)
 * return createErrorResponse("RATE_LIMITED", "Rate limit exceeded", {
 *   requestId,
 *   retryAfter: 60
 * });
 * ```
 *
 * @see docs/stories/4-3-error-response-contract.md
 */
export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  options?: CreateErrorResponseOptions | string // string for backwards compatibility (requestId)
): Response {
  // Handle backwards compatibility: if options is string, it's requestId
  const opts: CreateErrorResponseOptions =
    typeof options === "string" ? { requestId: options } : options ?? {};

  const { requestId, details, retryAfter } = opts;
  const reqId = requestId ?? generateRequestId();
  const status = ERROR_STATUS_CODES[code];

  const body: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      ...(retryAfter !== undefined && { retry_after: retryAfter }),
    },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-Id": reqId,
  };

  // Add Retry-After HTTP header for retryable errors (AC#9)
  if (retryAfter !== undefined) {
    headers["Retry-After"] = String(retryAfter);
  }

  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Creates an error response with backwards-compatible signature.
 * @deprecated Use createErrorResponse with options object instead.
 */
export function createErrorResponseLegacy(
  code: ApiErrorCode,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>
): Response {
  return createErrorResponse(code, message, { requestId, details });
}

/**
 * Creates a 401 Unauthorized response.
 */
export function unauthorized(
  message: string,
  requestId?: string
): Response {
  return createErrorResponse("UNAUTHORIZED", message, requestId);
}

/**
 * Creates a 403 Forbidden response.
 */
export function forbidden(
  message: string,
  requestId?: string
): Response {
  return createErrorResponse("FORBIDDEN", message, requestId);
}

/**
 * Creates a 404 Not Found response.
 */
export function notFound(
  message: string,
  requestId?: string
): Response {
  return createErrorResponse("NOT_FOUND", message, requestId);
}

/**
 * Creates a 400 Bad Request response.
 */
export function badRequest(
  message: string,
  requestId?: string,
  details?: Record<string, unknown>
): Response {
  return createErrorResponse("BAD_REQUEST", message, { requestId, details });
}

/**
 * Creates a 501 Not Implemented response.
 */
export function notImplemented(
  message: string,
  requestId?: string
): Response {
  return createErrorResponse("NOT_IMPLEMENTED", message, requestId);
}

/**
 * Creates a 500 Internal Server Error response.
 */
export function internalError(
  message: string,
  requestId?: string
): Response {
  return createErrorResponse("INTERNAL_ERROR", message, requestId);
}

/**
 * Default retry-after value in seconds for retryable errors.
 */
const DEFAULT_RETRY_AFTER_SECONDS = 30;

/**
 * Creates a 503 LLM Timeout response with Retry-After header.
 *
 * @param requestId - The request ID
 * @param retryAfterSeconds - Seconds to wait before retry (default: 30)
 * @returns Response with 503 status and Retry-After header
 *
 * @see docs/stories/4-3-error-response-contract.md AC#8, AC#9
 */
export function llmTimeout(
  requestId?: string,
  retryAfterSeconds: number = DEFAULT_RETRY_AFTER_SECONDS
): Response {
  return createErrorResponse(
    "LLM_TIMEOUT",
    "Intelligence service timed out. Please retry.",
    { requestId, retryAfter: retryAfterSeconds }
  );
}

/**
 * Creates a 503 LLM Error response with Retry-After header.
 *
 * @param requestId - The request ID
 * @param retryAfterSeconds - Seconds to wait before retry (default: 30)
 * @returns Response with 503 status and Retry-After header
 *
 * @see docs/stories/4-3-error-response-contract.md AC#8, AC#9
 */
export function llmError(
  requestId?: string,
  retryAfterSeconds: number = DEFAULT_RETRY_AFTER_SECONDS
): Response {
  return createErrorResponse(
    "LLM_ERROR",
    "Intelligence service temporarily unavailable. Please retry.",
    { requestId, retryAfter: retryAfterSeconds }
  );
}

/**
 * Creates a 429 Rate Limited response with Retry-After header.
 *
 * @param retryAfterSeconds - Seconds to wait before rate limit resets
 * @param requestId - The request ID
 * @returns Response with 429 status and Retry-After header
 *
 * @example
 * ```typescript
 * // Rate limit exceeded, retry after 60 seconds
 * return rateLimitedError(60, requestId);
 * ```
 *
 * @see docs/stories/4-3-error-response-contract.md AC#6, AC#9
 */
export function rateLimitedError(
  retryAfterSeconds: number,
  requestId?: string
): Response {
  return createErrorResponse(
    "RATE_LIMITED",
    `Rate limit exceeded. Please retry after ${retryAfterSeconds} seconds.`,
    { requestId, retryAfter: retryAfterSeconds }
  );
}

/**
 * Creates a 500 Output Parse Failed response.
 */
export function outputParseFailed(
  message: string,
  requestId?: string
): Response {
  return createErrorResponse("OUTPUT_PARSE_FAILED", message, requestId);
}

/**
 * Creates a 400 Invalid Input response.
 */
export function invalidInput(
  message: string,
  requestId?: string,
  details?: Record<string, unknown>
): Response {
  return createErrorResponse("INVALID_INPUT", message, { requestId, details });
}

/**
 * Validation issue with path and message.
 */
export interface ValidationIssue {
  /** Path to the field that failed validation (e.g., ["attributes", "price"]) */
  path: string[];
  /** Human-readable error message */
  message: string;
}

/**
 * Creates a 400 Validation Error response with field-level details.
 *
 * @param issues - Array of validation issues with paths and messages
 * @param requestId - The request ID
 * @returns Response object with JSON body and headers
 *
 * @example
 * ```typescript
 * return validationError([
 *   { path: ["productName"], message: "Required" },
 *   { path: ["price"], message: "Expected number, received string" }
 * ], requestId);
 * ```
 */
export function validationError(
  issues: ValidationIssue[],
  requestId?: string
): Response {
  return createErrorResponse("VALIDATION_ERROR", "Input validation failed", {
    requestId,
    details: { issues },
  });
}

/**
 * Creates a 500 Output Validation Failed response with field-level details.
 *
 * Used when LLM output fails schema validation after retry (Story 4.2).
 * Returns 500 because this is a server-side failure (LLM not producing valid output),
 * not a client input error.
 *
 * @param issues - Array of validation issues with paths and messages
 * @param requestId - The request ID
 * @returns Response object with JSON body and headers
 *
 * @example
 * ```typescript
 * return outputValidationError([
 *   { path: ["shortDescription"], message: "Expected string, received undefined" }
 * ], requestId);
 * ```
 *
 * @see docs/stories/4-2-output-schema-enforcement.md
 */
export function outputValidationError(
  issues: ValidationIssue[],
  requestId?: string
): Response {
  return createErrorResponse(
    "OUTPUT_VALIDATION_FAILED",
    "Failed to generate valid response after retry",
    { requestId, details: { issues } }
  );
}
