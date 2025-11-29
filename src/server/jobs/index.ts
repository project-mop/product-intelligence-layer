/**
 * Job Queue Initialization
 *
 * Initializes pg-boss job queue and registers all scheduled jobs.
 * Uses the same PostgreSQL database - no additional infrastructure needed.
 *
 * Story 4.6 AC: 8 - pg-boss job runs hourly to delete expired cache entries
 *
 * @see docs/architecture.md#ADR-004-pg-boss-for-Background-Jobs
 * @see docs/stories/4-6-configurable-cache-ttl.md
 */

import PgBoss from "pg-boss";
import { env } from "~/env";
import { logger } from "~/lib/logger";
import { cleanupExpiredCache } from "./cache-cleanup";

/**
 * Singleton pg-boss instance.
 */
let boss: PgBoss | null = null;

/**
 * Job names used in the system.
 */
export const JOB_NAMES = {
  CACHE_CLEANUP: "cache-cleanup",
} as const;

/**
 * Cron expressions for scheduled jobs.
 */
export const JOB_SCHEDULES = {
  /** Run hourly at minute 0 */
  HOURLY: "0 * * * *",
} as const;

/**
 * Initialize and start the pg-boss job queue.
 *
 * This function:
 * 1. Creates a pg-boss instance connected to the database
 * 2. Starts the boss (creates tables on first run)
 * 3. Registers scheduled jobs (cache cleanup, etc.)
 * 4. Registers job workers
 *
 * Safe to call multiple times - returns existing instance if already started.
 *
 * @returns The initialized PgBoss instance
 */
export async function initJobQueue(): Promise<PgBoss> {
  if (boss) {
    return boss;
  }

  logger.info("[jobs] Initializing pg-boss job queue");

  boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    // Use 'pgboss' schema to avoid conflicts with app tables
    schema: "pgboss",
    // Retry failed jobs up to 3 times
    retryLimit: 3,
    // Exponential backoff for retries
    retryBackoff: true,
    // Keep completed jobs for 7 days for debugging
    archiveCompletedAfterSeconds: 60 * 60 * 24 * 7,
    // Delete archived jobs after 30 days
    deleteAfterSeconds: 60 * 60 * 24 * 30,
  });

  // Handle boss errors
  boss.on("error", (error) => {
    logger.error("[jobs] pg-boss error", {
      error: error.message,
    });
  });

  // Start the boss (creates tables on first run)
  await boss.start();
  logger.info("[jobs] pg-boss started successfully");

  // Register scheduled jobs
  await registerScheduledJobs(boss);

  // Register job workers
  await registerJobWorkers(boss);

  return boss;
}

/**
 * Register scheduled jobs (cron-based).
 *
 * These are registered via boss.schedule() which is idempotent.
 */
async function registerScheduledJobs(bossInstance: PgBoss): Promise<void> {
  // Cache cleanup - runs hourly (Story 4.6 AC: 8)
  await bossInstance.schedule(
    JOB_NAMES.CACHE_CLEANUP,
    JOB_SCHEDULES.HOURLY,
    {},
    {
      // Ensure only one cleanup runs at a time
      singletonKey: JOB_NAMES.CACHE_CLEANUP,
    }
  );

  logger.info("[jobs] Scheduled cache-cleanup job", {
    schedule: JOB_SCHEDULES.HOURLY,
  });
}

/**
 * Register job workers (handlers).
 *
 * Workers process jobs when they're due.
 */
async function registerJobWorkers(bossInstance: PgBoss): Promise<void> {
  // Cache cleanup worker
  await bossInstance.work(JOB_NAMES.CACHE_CLEANUP, async () => {
    const result = await cleanupExpiredCache();
    return result;
  });

  logger.info("[jobs] Registered cache-cleanup worker");
}

/**
 * Stop the pg-boss job queue gracefully.
 *
 * Should be called during application shutdown.
 */
export async function stopJobQueue(): Promise<void> {
  if (boss) {
    logger.info("[jobs] Stopping pg-boss job queue");
    await boss.stop();
    boss = null;
    logger.info("[jobs] pg-boss stopped successfully");
  }
}

/**
 * Get the current pg-boss instance (for testing).
 *
 * @internal
 */
export function getJobQueue(): PgBoss | null {
  return boss;
}

/**
 * Reset the job queue singleton (for testing).
 *
 * @internal
 */
export function resetJobQueue(): void {
  boss = null;
}
