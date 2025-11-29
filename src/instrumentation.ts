/**
 * Next.js Instrumentation
 *
 * This file runs once when the Next.js server starts.
 * Used to initialize background services like pg-boss job queue.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 * @see docs/stories/4-6-configurable-cache-ttl.md
 */

export async function register() {
  // Only run on server, not during build or in edge runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamically import to avoid issues during build
    const { initJobQueue } = await import("~/server/jobs");

    try {
      await initJobQueue();
      console.log("[instrumentation] Job queue initialized successfully");
    } catch (error) {
      // Log but don't crash - app should still work without job queue
      console.error("[instrumentation] Failed to initialize job queue:", error);
    }
  }
}
