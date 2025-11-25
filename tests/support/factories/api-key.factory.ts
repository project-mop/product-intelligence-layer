/**
 * API Key Test Factory
 *
 * Generates test data for API key tests.
 * Uses deterministic patterns for reproducible tests.
 */

import type { ApiKey } from "../../../../generated/prisma";

let idCounter = 0;

/**
 * Generates a unique test ID with prefix
 */
function generateTestId(prefix: string): string {
  return `${prefix}_test_${++idCounter}`;
}

/**
 * Generates a mock API key hash (64 hex chars)
 */
function generateTestHash(): string {
  const chars = "0123456789abcdef";
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

/**
 * Default API key data
 */
const defaultApiKey: Omit<ApiKey, "id" | "tenantId" | "keyHash"> = {
  name: "Test API Key",
  scopes: ["process:*"],
  environment: "PRODUCTION",
  expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
  revokedAt: null,
  lastUsedAt: null,
  createdAt: new Date(),
};

/**
 * Creates a mock API key record for testing.
 *
 * @param overrides - Partial ApiKey fields to override defaults
 * @returns Complete ApiKey object
 */
export function createMockApiKey(
  overrides: Partial<ApiKey> = {}
): ApiKey {
  return {
    id: generateTestId("key"),
    tenantId: generateTestId("ten"),
    keyHash: generateTestHash(),
    ...defaultApiKey,
    ...overrides,
  };
}

/**
 * Creates a mock API key with specific environment.
 */
export function createMockApiKeyForEnvironment(
  environment: "PRODUCTION" | "SANDBOX",
  overrides: Partial<ApiKey> = {}
): ApiKey {
  return createMockApiKey({
    environment,
    ...overrides,
  });
}

/**
 * Creates a revoked API key for testing revocation logic.
 */
export function createRevokedApiKey(
  overrides: Partial<ApiKey> = {}
): ApiKey {
  return createMockApiKey({
    revokedAt: new Date(),
    ...overrides,
  });
}

/**
 * Creates an expired API key for testing expiration logic.
 */
export function createExpiredApiKey(
  overrides: Partial<ApiKey> = {}
): ApiKey {
  return createMockApiKey({
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    ...overrides,
  });
}

/**
 * Creates an API key that never expires.
 */
export function createNonExpiringApiKey(
  overrides: Partial<ApiKey> = {}
): ApiKey {
  return createMockApiKey({
    expiresAt: null,
    ...overrides,
  });
}

/**
 * Resets the ID counter (for test isolation).
 */
export function resetIdCounter(): void {
  idCounter = 0;
}
