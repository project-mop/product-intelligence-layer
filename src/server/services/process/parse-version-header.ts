/**
 * X-Version Header Parser
 *
 * Parses the X-Version header from API requests.
 * Version number must be a positive integer.
 *
 * @see docs/stories/5-5-version-pinning-and-deprecation.md AC: 1
 */

import { ApiError, ErrorCode, ERROR_HTTP_STATUS } from "~/lib/errors";

/**
 * Parse the X-Version header from a request.
 *
 * @param request - The incoming request
 * @returns Parsed version number, or undefined if header not present
 * @throws ApiError with INVALID_VERSION code if header is invalid
 *
 * @example
 * ```typescript
 * const pinnedVersion = parseVersionHeader(request);
 * if (pinnedVersion !== undefined) {
 *   // Use pinned version
 * }
 * ```
 */
export function parseVersionHeader(request: Request): number | undefined {
  const header = request.headers.get("X-Version");

  if (!header) {
    return undefined;
  }

  // Trim whitespace
  const trimmed = header.trim();

  if (trimmed === "") {
    return undefined;
  }

  // Parse as integer
  const parsed = parseInt(trimmed, 10);

  // Validate: must be a positive integer
  if (isNaN(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
    throw new ApiError(
      ErrorCode.INVALID_VERSION,
      "X-Version header must be a positive integer",
      ERROR_HTTP_STATUS[ErrorCode.INVALID_VERSION],
      { providedValue: header }
    );
  }

  // Validate: not too large (prevent overflow attacks)
  if (parsed > 999999) {
    throw new ApiError(
      ErrorCode.INVALID_VERSION,
      "X-Version header value is too large",
      ERROR_HTTP_STATUS[ErrorCode.INVALID_VERSION],
      { providedValue: header }
    );
  }

  return parsed;
}
