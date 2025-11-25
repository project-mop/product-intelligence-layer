/**
 * API Key Service
 *
 * Handles API key generation, creation, rotation, and revocation.
 * Keys are stored as SHA-256 hashes; plaintext is only returned once at creation.
 *
 * Key format: pil_{env}_{random}
 * - pil_: Product Intelligence Layer prefix
 * - env: "live" for PRODUCTION, "test" for SANDBOX
 * - random: 32 bytes (64 hex characters)
 *
 * @see docs/tech-spec-epic-1.md#API-Key-Service-Interface
 */

import { randomBytes, createHash } from "crypto";
import type { Environment, ApiKey } from "../../../../generated/prisma";

import { db } from "~/server/db";
import { generateApiKeyId } from "~/lib/id";

/**
 * Default API key expiration in days.
 * Configurable via API_KEY_DEFAULT_EXPIRY_DAYS environment variable.
 */
const DEFAULT_EXPIRY_DAYS = Number(process.env.API_KEY_DEFAULT_EXPIRY_DAYS) || 90;

/**
 * Maps Environment enum to key prefix.
 */
const ENVIRONMENT_PREFIX: Record<Environment, string> = {
  PRODUCTION: "live",
  SANDBOX: "test",
};

/**
 * Generates a cryptographically secure API key with environment prefix.
 *
 * Format: pil_{env}_{random}
 * - env: "live" (PRODUCTION) or "test" (SANDBOX)
 * - random: 32 bytes hex-encoded (64 characters)
 *
 * @param environment - The environment (PRODUCTION or SANDBOX)
 * @returns The plaintext API key
 */
export function generateKey(environment: Environment): string {
  const envPrefix = ENVIRONMENT_PREFIX[environment];
  const random = randomBytes(32).toString("hex");
  return `pil_${envPrefix}_${random}`;
}

/**
 * Creates a SHA-256 hash of an API key for secure storage.
 *
 * @param plainTextKey - The plaintext API key
 * @returns SHA-256 hex digest of the key
 */
export function hashKey(plainTextKey: string): string {
  return createHash("sha256").update(plainTextKey).digest("hex");
}

/**
 * Parameters for creating a new API key.
 */
export interface CreateApiKeyParams {
  tenantId: string;
  name: string;
  environment: Environment;
  scopes?: string[];
  expiresAt?: Date;
}

/**
 * Result of creating a new API key.
 * The plainTextKey is only available at creation time.
 */
export interface CreateApiKeyResult {
  apiKey: ApiKey;
  plainTextKey: string;
}

/**
 * Creates a new API key for a tenant.
 *
 * Generates a secure key, stores only the hash, and returns the plaintext once.
 * Default expiration is 90 days unless specified.
 *
 * @param params - Key creation parameters
 * @returns The created ApiKey record and plaintext key (shown only once)
 */
export async function createApiKey(
  params: CreateApiKeyParams
): Promise<CreateApiKeyResult> {
  const { tenantId, name, environment, scopes = ["process:*"], expiresAt } = params;

  // Generate the plaintext key
  const plainTextKey = generateKey(environment);

  // Hash for storage
  const keyHash = hashKey(plainTextKey);

  // Calculate expiration (default 90 days from now)
  const defaultExpiration = new Date();
  defaultExpiration.setDate(defaultExpiration.getDate() + DEFAULT_EXPIRY_DAYS);
  const finalExpiresAt = expiresAt ?? defaultExpiration;

  // Create the API key record
  const apiKey = await db.apiKey.create({
    data: {
      id: generateApiKeyId(),
      tenantId,
      name,
      keyHash,
      scopes: scopes,
      environment,
      expiresAt: finalExpiresAt,
    },
  });

  return {
    apiKey,
    plainTextKey,
  };
}

/**
 * Parameters for rotating an API key.
 */
export interface RotateApiKeyParams {
  keyId: string;
  tenantId: string;
}

/**
 * Rotates an API key by revoking the old one and creating a new one.
 *
 * The operation is atomic - if the new key creation fails, the old key
 * remains valid. The new key inherits name, scopes, environment, and
 * a fresh expiration period.
 *
 * @param params - Key rotation parameters
 * @returns The new ApiKey record and plaintext key
 * @throws Error if key not found or not owned by tenant
 */
export async function rotateApiKey(
  params: RotateApiKeyParams
): Promise<CreateApiKeyResult> {
  const { keyId, tenantId } = params;

  // Find the existing key
  const existingKey = await db.apiKey.findFirst({
    where: {
      id: keyId,
      tenantId,
      revokedAt: null,
    },
  });

  if (!existingKey) {
    throw new Error("API key not found or already revoked");
  }

  // Generate new key with same configuration
  const plainTextKey = generateKey(existingKey.environment);
  const keyHash = hashKey(plainTextKey);

  // Calculate new expiration
  const newExpiration = new Date();
  newExpiration.setDate(newExpiration.getDate() + DEFAULT_EXPIRY_DAYS);

  // Atomic operation: revoke old key and create new one
  const [, newApiKey] = await db.$transaction([
    // Revoke the old key
    db.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    }),
    // Create the new key with inherited properties
    db.apiKey.create({
      data: {
        id: generateApiKeyId(),
        tenantId,
        name: existingKey.name,
        keyHash,
        scopes: existingKey.scopes as string[],
        environment: existingKey.environment,
        expiresAt: newExpiration,
      },
    }),
  ]);

  return {
    apiKey: newApiKey,
    plainTextKey,
  };
}

/**
 * Parameters for revoking an API key.
 */
export interface RevokeApiKeyParams {
  keyId: string;
  tenantId: string;
}

/**
 * Revokes an API key immediately.
 *
 * Once revoked, the key will return 401 on any validation attempt.
 *
 * @param params - Key revocation parameters
 * @throws Error if key not found or not owned by tenant
 */
export async function revokeApiKey(params: RevokeApiKeyParams): Promise<void> {
  const { keyId, tenantId } = params;

  const result = await db.apiKey.updateMany({
    where: {
      id: keyId,
      tenantId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  if (result.count === 0) {
    throw new Error("API key not found or already revoked");
  }
}

/**
 * Lists all API keys for a tenant (without plaintext).
 *
 * @param tenantId - The tenant ID
 * @returns Array of ApiKey records (keyHash excluded from selection would be ideal,
 *          but Prisma returns full model - the hash is not sensitive, just not useful to clients)
 */
export async function listApiKeys(tenantId: string): Promise<ApiKey[]> {
  return db.apiKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Updates an API key's name.
 *
 * @param keyId - The key ID to update
 * @param tenantId - The tenant ID (for authorization)
 * @param name - The new name
 * @returns The updated ApiKey
 * @throws Error if key not found or not owned by tenant
 */
export async function updateApiKeyName(
  keyId: string,
  tenantId: string,
  name: string
): Promise<ApiKey> {
  const existingKey = await db.apiKey.findFirst({
    where: {
      id: keyId,
      tenantId,
    },
  });

  if (!existingKey) {
    throw new Error("API key not found");
  }

  return db.apiKey.update({
    where: { id: keyId },
    data: { name },
  });
}
