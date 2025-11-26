/**
 * API Key Test Factory
 *
 * Generates test data for API key tests.
 * Provides both in-memory (build) and persisted (create) methods.
 *
 * @module tests/support/factories/api-key.factory
 */

import type { ApiKey, Environment } from "../../../generated/prisma";
import { Prisma } from "../../../generated/prisma";
import { generateApiKeyId } from "~/lib/id";
import { testDb } from "../db";
import { createHash, randomBytes } from "crypto";

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
 * Generates a real API key and its hash for integration tests.
 * Returns both the plaintext key and its SHA-256 hash.
 */
function generateRealKeyAndHash(environment: Environment): {
  plainTextKey: string;
  keyHash: string;
} {
  const envPrefix = environment === "PRODUCTION" ? "live" : "test";
  const random = randomBytes(32).toString("hex");
  const plainTextKey = `pil_${envPrefix}_${random}`;
  const keyHash = createHash("sha256").update(plainTextKey).digest("hex");
  return { plainTextKey, keyHash };
}

/**
 * Default API key data
 */
const defaultApiKey = (): Omit<ApiKey, "id" | "tenantId" | "keyHash"> => ({
  name: `Test API Key ${idCounter + 1}`,
  scopes: ["process:*"],
  environment: "PRODUCTION",
  expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
  revokedAt: null,
  lastUsedAt: null,
  createdAt: new Date(),
});

/** Options for building/creating an API key */
interface ApiKeyFactoryOptions extends Partial<ApiKey> {
  tenantId?: string;
}

/**
 * Creates a mock API key record for testing (in-memory only).
 * Use this for unit tests that don't need database interaction.
 *
 * @param overrides - Partial ApiKey fields to override defaults
 * @returns Complete ApiKey object
 */
export function createMockApiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: generateTestId("key"),
    tenantId: generateTestId("ten"),
    keyHash: generateTestHash(),
    ...defaultApiKey(),
    ...overrides,
  };
}

/**
 * Builds an API key object in memory without persisting.
 * Alias for createMockApiKey for consistency with other factories.
 */
function build(overrides: ApiKeyFactoryOptions = {}): ApiKey {
  return createMockApiKey(overrides);
}

/**
 * Creates an API key and persists it to the test database.
 * Use this for integration tests that need real database records.
 *
 * @param overrides - Partial ApiKey fields to override defaults
 * @returns Promise resolving to { apiKey, plainTextKey }
 */
async function create(
  overrides: ApiKeyFactoryOptions = {}
): Promise<{ apiKey: ApiKey; plainTextKey: string }> {
  const environment = overrides.environment ?? "PRODUCTION";
  const { plainTextKey, keyHash } = generateRealKeyAndHash(environment);

  const baseData = {
    id: overrides.id ?? generateApiKeyId(),
    tenantId: overrides.tenantId ?? generateTestId("ten"),
    keyHash,
    ...defaultApiKey(),
    ...overrides,
    environment,
  };

  const apiKey = await testDb.apiKey.create({
    data: {
      ...baseData,
      scopes: baseData.scopes === null ? Prisma.JsonNull : baseData.scopes,
    },
  });

  return { apiKey, plainTextKey };
}

/**
 * Creates an API key for an existing tenant.
 * Convenience method that ensures tenantId is provided.
 *
 * @param tenantId - The tenant ID to create the key for
 * @param overrides - Additional overrides
 */
async function createForTenant(
  tenantId: string,
  overrides: Partial<Omit<ApiKey, "tenantId">> = {}
): Promise<{ apiKey: ApiKey; plainTextKey: string }> {
  return create({ ...overrides, tenantId });
}

/**
 * Creates multiple API keys for the same tenant.
 */
async function createMany(
  count: number,
  tenantId: string,
  overrides: Partial<Omit<ApiKey, "id" | "tenantId">> = {}
): Promise<Array<{ apiKey: ApiKey; plainTextKey: string }>> {
  const results: Array<{ apiKey: ApiKey; plainTextKey: string }> = [];
  for (let i = 0; i < count; i++) {
    results.push(await createForTenant(tenantId, overrides));
  }
  return results;
}

export const apiKeyFactory = {
  build,
  create,
  createForTenant,
  createMany,
};

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
