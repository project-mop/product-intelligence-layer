/**
 * Cache Service Types
 *
 * TypeScript interfaces for the response caching system.
 *
 * @see docs/tech-spec-epic-4.md#Cache-Entry-Type
 * @see docs/stories/4-5-response-caching.md
 */

/**
 * Cached response entry structure.
 *
 * Contains the cached data along with metadata for cache management.
 */
export interface CacheEntry {
  /** The cached response data */
  data: Record<string, unknown>;

  /** Cache metadata */
  meta: {
    /** Process version at cache time */
    version: string;
    /** ISO timestamp when entry was cached */
    cachedAt: string;
    /** Input hash used as cache key */
    inputHash: string;
  };
}

/**
 * Cache service interface.
 *
 * Abstracts cache operations to allow different implementations
 * (PostgreSQL for MVP, Redis for scale).
 *
 * All operations are tenant-isolated by including tenantId in queries.
 */
export interface CacheService {
  /**
   * Retrieves a cached entry if it exists and is not expired.
   *
   * @param tenantId - The tenant ID (for tenant isolation)
   * @param processId - The process ID
   * @param inputHash - The computed input hash (cache key)
   * @returns The cached entry or null if not found/expired
   */
  get(
    tenantId: string,
    processId: string,
    inputHash: string
  ): Promise<CacheEntry | null>;

  /**
   * Stores a cache entry with the specified TTL.
   *
   * Uses upsert pattern to handle concurrent requests.
   * Failures are silent (logged but not thrown).
   *
   * @param tenantId - The tenant ID
   * @param processId - The process ID
   * @param inputHash - The computed input hash (cache key)
   * @param entry - The cache entry to store
   * @param ttlSeconds - Time-to-live in seconds
   */
  set(
    tenantId: string,
    processId: string,
    inputHash: string,
    entry: CacheEntry,
    ttlSeconds: number
  ): Promise<void>;

  /**
   * Invalidates all cache entries for a process.
   *
   * Used when process configuration changes.
   *
   * @param tenantId - The tenant ID
   * @param processId - The process ID to invalidate
   */
  invalidate(tenantId: string, processId: string): Promise<void>;
}
