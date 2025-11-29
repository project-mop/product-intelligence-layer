/**
 * PostgreSQL Cache Service Implementation
 *
 * Implements CacheService interface using PostgreSQL via Prisma.
 * Follows singleton pattern consistent with LLM gateway.
 *
 * @see docs/architecture.md#ADR-001-PostgreSQL-for-Caching
 * @see docs/stories/4-5-response-caching.md
 */

import { db } from "~/server/db";
import type { CacheEntry, CacheService } from "./types";

/**
 * PostgreSQL-based cache service implementation.
 *
 * Features:
 * - Tenant isolation via tenantId in all queries
 * - Upsert pattern for handling concurrent writes
 * - Silent failure handling (logs errors but doesn't throw)
 * - Automatic expiration check on reads
 */
export class PostgresCacheService implements CacheService {
  /**
   * Retrieves a cached entry if it exists and is not expired.
   *
   * @param tenantId - The tenant ID (for tenant isolation)
   * @param processId - The process ID
   * @param inputHash - The computed input hash (cache key)
   * @returns The cached entry or null if not found/expired
   */
  async get(
    tenantId: string,
    processId: string,
    inputHash: string
  ): Promise<CacheEntry | null> {
    try {
      const cached = await db.responseCache.findFirst({
        where: {
          tenantId,
          processId,
          inputHash,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!cached) {
        return null;
      }

      return {
        data: cached.response as Record<string, unknown>,
        meta: {
          version: cached.version,
          cachedAt: cached.cachedAt.toISOString(),
          inputHash: cached.inputHash,
        },
      };
    } catch (error) {
      // Silent failure for cache operations per AC#9
      console.error("[CacheService] Error reading cache:", error);
      return null;
    }
  }

  /**
   * Stores a cache entry with the specified TTL.
   *
   * Uses upsert pattern to handle concurrent requests gracefully.
   * Failures are silent (logged but not thrown).
   *
   * @param tenantId - The tenant ID
   * @param processId - The process ID
   * @param inputHash - The computed input hash (cache key)
   * @param entry - The cache entry to store
   * @param ttlSeconds - Time-to-live in seconds
   */
  async set(
    tenantId: string,
    processId: string,
    inputHash: string,
    entry: CacheEntry,
    ttlSeconds: number
  ): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

      await db.responseCache.upsert({
        where: {
          tenantId_processId_inputHash: {
            tenantId,
            processId,
            inputHash,
          },
        },
        create: {
          tenantId,
          processId,
          inputHash,
          response: entry.data as object,
          version: entry.meta.version,
          cachedAt: now,
          expiresAt,
        },
        update: {
          response: entry.data as object,
          version: entry.meta.version,
          cachedAt: now,
          expiresAt,
        },
      });
    } catch (error) {
      // Silent failure for cache write operations per AC#9
      // Log error but don't throw - response should still be returned to caller
      console.error("[CacheService] Error writing cache:", error);
    }
  }

  /**
   * Invalidates all cache entries for a process.
   *
   * Used when process configuration changes require cache refresh.
   *
   * @param tenantId - The tenant ID
   * @param processId - The process ID to invalidate
   */
  async invalidate(tenantId: string, processId: string): Promise<void> {
    try {
      await db.responseCache.deleteMany({
        where: {
          tenantId,
          processId,
        },
      });
    } catch (error) {
      // Silent failure for cache operations
      console.error("[CacheService] Error invalidating cache:", error);
    }
  }

  /**
   * Invalidates all cache entries for a process (by processId only).
   *
   * Used for promotion operations where tenant context is implicit.
   * Returns the count of invalidated entries.
   *
   * Story 5.3 AC: 8 - Cache entries for the process are invalidated on promotion.
   *
   * @param processId - The process ID to invalidate
   * @returns Number of cache entries deleted
   */
  async invalidateByProcess(processId: string): Promise<number> {
    try {
      const result = await db.responseCache.deleteMany({
        where: { processId },
      });
      return result.count;
    } catch (error) {
      // Silent failure for cache operations
      console.error("[CacheService] Error invalidating cache by process:", error);
      return 0;
    }
  }
}

/**
 * Singleton cache service instance.
 *
 * Follows the same pattern as LLM gateway (Story 4.4).
 */
let cacheServiceInstance: PostgresCacheService | null = null;

/**
 * Gets the singleton cache service instance.
 *
 * @returns The PostgresCacheService singleton
 */
export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new PostgresCacheService();
  }
  return cacheServiceInstance;
}

/**
 * Resets the cache service singleton (for testing).
 *
 * @internal
 */
export function resetCacheService(): void {
  cacheServiceInstance = null;
}
