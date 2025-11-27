/**
 * API Response Helpers
 *
 * Standard response format utilities for public REST API endpoints.
 * Ensures consistent response structure across all intelligence endpoints.
 *
 * @see docs/tech-spec-epic-3.md#Response-Format
 * @see docs/architecture.md#Public-API-Patterns
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
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
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
  | "INTERNAL_ERROR";

/**
 * HTTP status codes for each error code.
 */
const ERROR_STATUS_CODES: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  NOT_IMPLEMENTED: 501,
  INTERNAL_ERROR: 500,
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
    },
  });
}

/**
 * Creates an error API response with standard format.
 *
 * @param code - The error code
 * @param message - Human-readable error message
 * @param requestId - The request ID (generated if not provided)
 * @param details - Optional additional error details
 * @returns Response object with JSON body and headers
 *
 * @example
 * ```typescript
 * return createErrorResponse("NOT_FOUND", "Process not found", requestId);
 * ```
 */
export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>
): Response {
  const reqId = requestId ?? generateRequestId();
  const status = ERROR_STATUS_CODES[code];

  const body: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": reqId,
    },
  });
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
  return createErrorResponse("BAD_REQUEST", message, requestId, details);
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
