/**
 * Cache Hash Computation Utility
 *
 * Computes deterministic hashes for cache key generation.
 * Uses SHA256 with sorted JSON serialization for consistent hashing.
 *
 * @see docs/architecture.md#Input-Hash-Calculation
 * @see docs/stories/4-5-response-caching.md
 */

import { createHash } from "crypto";

/**
 * Recursively sorts object keys to ensure deterministic JSON serialization.
 * Arrays maintain their order but nested objects have sorted keys.
 *
 * @param value - Any JSON-serializable value
 * @returns Value with all object keys sorted alphabetically
 */
function sortObjectKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(value as Record<string, unknown>).sort();

  for (const key of keys) {
    sorted[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
  }

  return sorted;
}

/**
 * Computes a deterministic cache input hash.
 *
 * Hash computation:
 * 1. Sort all object keys recursively (ensures consistent serialization)
 * 2. Concatenate: tenantId + ":" + processId + ":" + sortedJSON(input)
 * 3. SHA256 hash the payload
 * 4. Truncate to 32 characters for storage efficiency
 *
 * @param tenantId - The tenant ID (included for tenant isolation)
 * @param processId - The process ID
 * @param input - The input object to hash
 * @returns 32-character hexadecimal hash string
 *
 * @example
 * ```typescript
 * // Identical payloads produce identical hashes regardless of key order
 * computeInputHash("ten_123", "proc_456", { b: 2, a: 1 })
 * // same as
 * computeInputHash("ten_123", "proc_456", { a: 1, b: 2 })
 * ```
 */
export function computeInputHash(
  tenantId: string,
  processId: string,
  input: Record<string, unknown>
): string {
  const sortedInput = sortObjectKeys(input);
  const normalized = JSON.stringify(sortedInput);
  const payload = `${tenantId}:${processId}:${normalized}`;

  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}
