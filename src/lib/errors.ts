/**
 * API Error Classes and Types
 *
 * Standardized error types for the public API.
 * Used for structured error responses with field-level details.
 *
 * @see docs/architecture.md#Error-Handling-Matrix
 * @see docs/stories/4-1-input-schema-validation.md
 */

/**
 * Error codes for API responses.
 */
export enum ErrorCode {
  /** Input validation failed */
  VALIDATION_ERROR = "VALIDATION_ERROR",
  /** Unauthorized access */
  UNAUTHORIZED = "UNAUTHORIZED",
  /** Forbidden resource access */
  FORBIDDEN = "FORBIDDEN",
  /** Resource not found */
  NOT_FOUND = "NOT_FOUND",
  /** Bad request format */
  BAD_REQUEST = "BAD_REQUEST",
  /** Feature not implemented */
  NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
  /** Internal server error */
  INTERNAL_ERROR = "INTERNAL_ERROR",
  /** LLM request timeout */
  LLM_TIMEOUT = "LLM_TIMEOUT",
  /** LLM service error */
  LLM_ERROR = "LLM_ERROR",
  /** Failed to parse LLM output */
  OUTPUT_PARSE_FAILED = "OUTPUT_PARSE_FAILED",
  /** LLM output failed schema validation after retry (Story 4.2) */
  OUTPUT_VALIDATION_FAILED = "OUTPUT_VALIDATION_FAILED",
  /** Invalid input data */
  INVALID_INPUT = "INVALID_INPUT",
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
}

/**
 * HTTP status codes for each error code.
 */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.NOT_IMPLEMENTED]: 501,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.LLM_TIMEOUT]: 503,
  [ErrorCode.LLM_ERROR]: 503,
  [ErrorCode.OUTPUT_PARSE_FAILED]: 500,
  [ErrorCode.OUTPUT_VALIDATION_FAILED]: 500, // Server error per AC #6
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
};

/**
 * A single validation issue with path and message.
 */
export interface ValidationIssue {
  /** Path to the field that failed validation */
  path: string[];
  /** Human-readable error message */
  message: string;
}

/**
 * Error details structure.
 */
export interface ErrorDetails {
  /** Validation issues array for VALIDATION_ERROR */
  issues?: ValidationIssue[];
  /** Additional context-specific details */
  [key: string]: unknown;
}

/**
 * API error response format.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
}

/**
 * Custom error class for API errors.
 *
 * Provides structured error information for API responses.
 *
 * @example
 * ```typescript
 * const error = new ApiError(
 *   ErrorCode.VALIDATION_ERROR,
 *   "Input validation failed",
 *   400,
 *   { issues: [{ path: ["name"], message: "Required" }] }
 * );
 * return new Response(JSON.stringify(error.toResponse()), { status: error.statusCode });
 * ```
 */
export class ApiError extends Error {
  constructor(
    /** Error code for programmatic handling */
    public readonly code: ErrorCode,
    /** Human-readable error message */
    message: string,
    /** HTTP status code */
    public readonly statusCode: number,
    /** Optional error details */
    public readonly details?: ErrorDetails,
    /** Optional retry-after header value in seconds */
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = "ApiError";
  }

  /**
   * Convert to standard API error response format.
   */
  toResponse(): ApiErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Create a validation error with issues.
 *
 * @param issues - Array of validation issues
 * @returns ApiError configured for validation errors
 *
 * @example
 * ```typescript
 * const error = createValidationError([
 *   { path: ["productName"], message: "Required" },
 *   { path: ["price"], message: "Expected number, received string" }
 * ]);
 * ```
 */
export function createValidationError(issues: ValidationIssue[]): ApiError {
  return new ApiError(
    ErrorCode.VALIDATION_ERROR,
    "Input validation failed",
    ERROR_HTTP_STATUS[ErrorCode.VALIDATION_ERROR],
    { issues }
  );
}
