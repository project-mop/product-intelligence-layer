/**
 * API Key Validation Middleware
 *
 * Validates API keys from Authorization headers for public API endpoints.
 * Checks existence, revocation status, and expiration.
 *
 * Usage:
 * ```typescript
 * const context = await validateApiKey(request.headers.get("Authorization"));
 * if (!context.valid) {
 *   return new Response(context.error.message, { status: context.error.status });
 * }
 * // Use context.tenantId, context.keyId, context.scopes, context.environment
 * ```
 *
 * @see docs/tech-spec-epic-1.md#API-Key-Validation-Flow
 */

import type { Environment } from "../../../../generated/prisma";

import { db } from "~/server/db";
import { hashKey } from "./api-key";

/**
 * API Key context returned after successful validation.
 */
export interface ApiKeyContext {
  tenantId: string;
  keyId: string;
  scopes: string[];
  environment: Environment;
}

/**
 * Validation error details.
 */
export interface ApiKeyValidationError {
  status: 401;
  code: "INVALID_KEY" | "REVOKED_KEY" | "EXPIRED_KEY" | "MISSING_AUTH";
  message: string;
}

/**
 * Result of API key validation.
 */
export type ApiKeyValidationResult =
  | { valid: true; context: ApiKeyContext }
  | { valid: false; error: ApiKeyValidationError };

/**
 * Validates an API key from the Authorization header.
 *
 * Expected format: `Authorization: Bearer pil_live_...` or `Authorization: Bearer pil_test_...`
 *
 * Validation steps:
 * 1. Extract token from Authorization header
 * 2. Hash the token
 * 3. Query database by hash
 * 4. Check if key is revoked
 * 5. Check if key is expired
 * 6. Update lastUsedAt (fire-and-forget)
 * 7. Return ApiKeyContext
 *
 * @param authHeader - The Authorization header value (or null)
 * @returns Validation result with context or error
 */
export async function validateApiKey(
  authHeader: string | null
): Promise<ApiKeyValidationResult> {
  // Step 1: Extract token from header
  if (!authHeader) {
    return {
      valid: false,
      error: {
        status: 401,
        code: "MISSING_AUTH",
        message: "Authorization header is required",
      },
    };
  }

  // Check Bearer prefix
  if (!authHeader.startsWith("Bearer ")) {
    return {
      valid: false,
      error: {
        status: 401,
        code: "INVALID_KEY",
        message: "Invalid authorization format. Expected: Bearer <token>",
      },
    };
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  // Validate token format (should start with pil_live_ or pil_test_)
  if (!token.startsWith("pil_live_") && !token.startsWith("pil_test_")) {
    return {
      valid: false,
      error: {
        status: 401,
        code: "INVALID_KEY",
        message: "Invalid API key format",
      },
    };
  }

  // Step 2: Hash the token
  const keyHash = hashKey(token);

  // Step 3: Query database by hash
  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      tenantId: true,
      scopes: true,
      environment: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!apiKey) {
    return {
      valid: false,
      error: {
        status: 401,
        code: "INVALID_KEY",
        message: "Invalid API key",
      },
    };
  }

  // Step 4: Check if revoked
  if (apiKey.revokedAt) {
    return {
      valid: false,
      error: {
        status: 401,
        code: "REVOKED_KEY",
        message: "API key has been revoked",
      },
    };
  }

  // Step 5: Check if expired
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return {
      valid: false,
      error: {
        status: 401,
        code: "EXPIRED_KEY",
        message: "API key has expired",
      },
    };
  }

  // Step 6: Update lastUsedAt (fire-and-forget)
  void db.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      // Silently ignore update failures - don't block the request
    });

  // Step 7: Return context
  return {
    valid: true,
    context: {
      tenantId: apiKey.tenantId,
      keyId: apiKey.id,
      scopes: apiKey.scopes as string[],
      environment: apiKey.environment,
    },
  };
}

/**
 * Checks if the API key context has the required scope for a process.
 *
 * Scope format: "process:*" (all processes) or "process:proc_abc123" (specific process)
 *
 * @param ctx - The validated API key context
 * @param processId - The process ID to check access for
 * @throws Error if access is denied
 */
export function assertProcessAccess(
  ctx: ApiKeyContext,
  processId: string
): void {
  const hasWildcard = ctx.scopes.includes("process:*");
  const hasSpecific = ctx.scopes.includes(`process:${processId}`);

  if (!hasWildcard && !hasSpecific) {
    throw new Error(
      `API key does not have access to process ${processId}. Required scope: process:${processId} or process:*`
    );
  }
}

/**
 * Creates a standardized 401 response for API key validation errors.
 *
 * @param error - The validation error
 * @returns Response object with appropriate status and body
 */
export function createUnauthorizedResponse(
  error: ApiKeyValidationError
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: error.code,
        message: error.message,
      },
    }),
    {
      status: error.status,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
