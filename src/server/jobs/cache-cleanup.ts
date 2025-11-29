/**
 * Cache Cleanup Job
 *
 * Deletes expired cache entries from the ResponseCache table.
 * Runs hourly via pg-boss scheduled job.
 *
 * Story 4.6 AC: 8, 9
 * - Job runs hourly to delete expired cache entries
 * - Logs number of entries deleted per run
 *
 * @see docs/stories/4-6-configurable-cache-ttl.md
 * @see docs/architecture.md#ADR-004-pg-boss-for-Background-Jobs
 */

import { db } from "~/server/db";
import { logger } from "~/lib/logger";

/**
 * Result of a cache cleanup operation.
 */
export interface CacheCleanupResult {
  /** Number of expired entries deleted */
  deleted: number;
  /** Timestamp of the cleanup run */
  timestamp: string;
}

/**
 * Deletes all expired cache entries from the database.
 *
 * This function is called by the pg-boss worker when the
 * cache-cleanup job runs (hourly).
 *
 * @returns The number of entries deleted and timestamp
 */
export async function cleanupExpiredCache(): Promise<CacheCleanupResult> {
  const timestamp = new Date().toISOString();

  try {
    const result = await db.responseCache.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    const deleted = result.count;

    logger.info("[cache-cleanup] Deleted expired entries", {
      deleted,
      timestamp,
    });

    return { deleted, timestamp };
  } catch (error) {
    logger.error("[cache-cleanup] Failed to cleanup expired cache entries", {
      error: error instanceof Error ? error.message : String(error),
      timestamp,
    });

    // Re-throw to let pg-boss handle retry logic
    throw error;
  }
}
