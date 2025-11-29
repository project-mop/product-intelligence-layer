/**
 * API Error Classes and Types
 *
 * Standardized error types for the public API.
 * Used for structured error responses with field-level details.
 *
 * @see docs/architecture.md#Error-Handling-Matrix
 * @see docs/stories/4-1-input-schema-validation.md
 * @see docs/stories/4-3-error-response-contract.md
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
  /** Rate limit exceeded (Story 4.3) */
  RATE_LIMITED = "RATE_LIMITED",
  /** @deprecated Use RATE_LIMITED instead */
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  RATE_LIMIT_EXCEEDED = "RATE_LIMITED",
  /** Version not found (Story 5.5) */
  VERSION_NOT_FOUND = "VERSION_NOT_FOUND",
  /** Version environment mismatch (Story 5.5) */
  VERSION_ENVIRONMENT_MISMATCH = "VERSION_ENVIRONMENT_MISMATCH",
  /** No active version available (Story 5.5) */
  NO_ACTIVE_VERSION = "NO_ACTIVE_VERSION",
  /** Invalid version header format (Story 5.5) */
  INVALID_VERSION = "INVALID_VERSION",
}

/**
 * HTTP status codes for each error code.
 * @see docs/architecture.md#Error-Handling-Matrix
 *
 * Note: RATE_LIMIT_EXCEEDED maps to "RATE_LIMITED" (deprecated alias),
 * so it uses the same key and doesn't need a separate entry.
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
  [ErrorCode.OUTPUT_VALIDATION_FAILED]: 500, // Server error per AC #7
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.VERSION_NOT_FOUND]: 404, // Story 5.5 AC: 7
  [ErrorCode.VERSION_ENVIRONMENT_MISMATCH]: 403, // Story 5.5 AC: 8
  [ErrorCode.NO_ACTIVE_VERSION]: 404, // Story 5.5
  [ErrorCode.INVALID_VERSION]: 400, // Story 5.5 - bad X-Version header
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
 * @see docs/architecture.md#Error-Response-Format
 * @see docs/stories/4-3-error-response-contract.md AC#1
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
    /** Seconds to wait before retrying (for 429/503 responses) */
    retry_after?: number;
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
   * @see docs/stories/4-3-error-response-contract.md AC#1
   */
  toResponse(): ApiErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
        ...(this.retryAfter !== undefined && { retry_after: this.retryAfter }),
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

/**
 * Patterns to remove from error messages to prevent leaking internal details.
 * @see docs/stories/4-3-error-response-contract.md AC#10
 */
const SANITIZE_PATTERNS = [
  // Stack traces (at /path/to/file.ts:123:45)
  /\s+at\s+.+:\d+:\d+\)?/g,
  // File paths (/Users/foo/project/src/file.ts)
  /(?:\/[\w.-]+)+\.(?:ts|js|tsx|jsx|mjs|cjs)/g,
  // Windows paths (C:\Users\foo\project\src\file.ts)
  /(?:[A-Za-z]:\\[\w\\.-]+)+\.(?:ts|js|tsx|jsx|mjs|cjs)/g,
  // Node module paths (node_modules/.../file.js)
  /node_modules[/\\][^\s]*/g,
  // Node module references without path
  /node_modules[:\s]*/g,
  // Line/column numbers (e.g., :123:45 or :123)
  /:\d+(:\d+)?/g,
  // Unix file paths without extension
  /\/[\w.-]+(?:\/[\w.-]+)+/g,
  // Error: prefix followed by internal details
  /Error:\s*at\s+/g,
];

/**
 * Default user-friendly messages for internal errors.
 */
const GENERIC_ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.INTERNAL_ERROR]: "An unexpected error occurred. Please try again.",
  [ErrorCode.LLM_ERROR]: "Intelligence service temporarily unavailable. Please retry.",
  [ErrorCode.LLM_TIMEOUT]: "Intelligence service timed out. Please retry.",
};

/**
 * Sanitize error messages to remove stack traces, file paths, and internal details.
 * Returns a user-friendly message safe for API responses.
 *
 * @param message - The original error message
 * @param errorCode - Optional error code to provide a default message
 * @returns Sanitized message safe for external exposure
 *
 * @example
 * ```typescript
 * sanitizeErrorMessage("Error at /Users/dev/src/api.ts:123:45");
 * // Returns: "Error"
 *
 * sanitizeErrorMessage("Connection failed", ErrorCode.INTERNAL_ERROR);
 * // Returns: "An unexpected error occurred. Please try again."
 * ```
 *
 * @see docs/stories/4-3-error-response-contract.md AC#10
 */
export function sanitizeErrorMessage(
  message: string,
  errorCode?: ErrorCode
): string {
  // Check if message contains internal details
  let sanitized = message;

  for (const pattern of SANITIZE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // Trim and clean up extra whitespace
  sanitized = sanitized.replace(/\s+/g, " ").trim();

  // If message is empty or only contains generic error prefix, use default
  if (!sanitized || sanitized === "Error" || sanitized === "Error:") {
    if (errorCode && GENERIC_ERROR_MESSAGES[errorCode]) {
      return GENERIC_ERROR_MESSAGES[errorCode];
    }
    return "An unexpected error occurred";
  }

  return sanitized;
}
