/**
 * ID Generation Utility
 *
 * Generates prefixed IDs for self-documenting database records.
 * Format: {prefix}_{random} (e.g., ten_abc123xyz)
 *
 * @see docs/architecture.md#ID-Format
 */

import { randomBytes } from "crypto";

/** Entity prefixes for ID generation */
export const ID_PREFIXES = {
  tenant: "ten",
  user: "usr",
  process: "proc",
  processVersion: "procv",
  apiKey: "key",
  request: "req",
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

/**
 * Generates a prefixed ID for the given entity type.
 *
 * @param prefix - The entity prefix (e.g., "ten", "usr", "proc")
 * @param length - Length of the random portion (default: 16)
 * @returns Prefixed ID string (e.g., "ten_a1b2c3d4e5f6g7h8")
 *
 * @example
 * generateId("ten") // "ten_a1b2c3d4e5f6g7h8"
 * generateId("proc") // "proc_x9y8z7w6v5u4t3s2"
 */
export function generateId(prefix: IdPrefix, length: number = 16): string {
  const random = randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
  return `${prefix}_${random}`;
}

/**
 * Generates a tenant ID.
 * @returns ID with "ten_" prefix
 */
export function generateTenantId(): string {
  return generateId(ID_PREFIXES.tenant);
}

/**
 * Generates a user ID.
 * @returns ID with "usr_" prefix
 */
export function generateUserId(): string {
  return generateId(ID_PREFIXES.user);
}

/**
 * Generates a process ID.
 * @returns ID with "proc_" prefix
 */
export function generateProcessId(): string {
  return generateId(ID_PREFIXES.process);
}

/**
 * Generates a process version ID.
 * @returns ID with "procv_" prefix
 */
export function generateProcessVersionId(): string {
  return generateId(ID_PREFIXES.processVersion);
}

/**
 * Generates an API key ID.
 * @returns ID with "key_" prefix
 */
export function generateApiKeyId(): string {
  return generateId(ID_PREFIXES.apiKey);
}

/**
 * Generates a request ID.
 * @returns ID with "req_" prefix
 */
export function generateRequestId(): string {
  return generateId(ID_PREFIXES.request);
}

/**
 * Validates that an ID has the expected prefix.
 *
 * @param id - The ID to validate
 * @param expectedPrefix - The expected prefix
 * @returns true if the ID has the expected prefix
 *
 * @example
 * hasPrefix("ten_abc123", "ten") // true
 * hasPrefix("usr_xyz789", "ten") // false
 */
export function hasPrefix(id: string, expectedPrefix: IdPrefix): boolean {
  return id.startsWith(`${expectedPrefix}_`);
}

/**
 * Extracts the prefix from an ID.
 *
 * @param id - The ID to extract prefix from
 * @returns The prefix portion of the ID, or null if invalid format
 *
 * @example
 * extractPrefix("ten_abc123") // "ten"
 * extractPrefix("invalid") // null
 */
export function extractPrefix(id: string): string | null {
  const match = id.match(/^([a-z]+)_/);
  return match?.[1] ?? null;
}
