/**
 * Cache Cleanup Job Unit Tests
 *
 * Tests for the cache cleanup job that deletes expired entries.
 *
 * Story 4.6 AC: 8, 9
 * - Job runs hourly to delete expired cache entries
 * - Logs number of entries deleted per run
 *
 * @see docs/stories/4-6-configurable-cache-ttl.md
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("~/server/db", () => ({
  db: {
    responseCache: {
      deleteMany: vi.fn(),
    },
  },
}));

// Mock the logger
vi.mock("~/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import { db } from "~/server/db";
import { logger } from "~/lib/logger";
import { cleanupExpiredCache } from "~/server/jobs/cache-cleanup";

describe("cleanupExpiredCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete expired cache entries", async () => {
    vi.mocked(db.responseCache.deleteMany).mockResolvedValue({ count: 10 });

    const result = await cleanupExpiredCache();

    expect(result.deleted).toBe(10);
    expect(result.timestamp).toBeDefined();
    expect(db.responseCache.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lt: expect.any(Date) },
      },
    });
  });

  it("should return 0 when no expired entries exist", async () => {
    vi.mocked(db.responseCache.deleteMany).mockResolvedValue({ count: 0 });

    const result = await cleanupExpiredCache();

    expect(result.deleted).toBe(0);
  });

  it("should log successful cleanup with count", async () => {
    vi.mocked(db.responseCache.deleteMany).mockResolvedValue({ count: 5 });

    await cleanupExpiredCache();

    expect(logger.info).toHaveBeenCalledWith(
      "[cache-cleanup] Deleted expired entries",
      expect.objectContaining({
        deleted: 5,
        timestamp: expect.any(String),
      })
    );
  });

  it("should log error on database failure", async () => {
    const dbError = new Error("DB connection failed");
    vi.mocked(db.responseCache.deleteMany).mockRejectedValue(dbError);

    await expect(cleanupExpiredCache()).rejects.toThrow("DB connection failed");

    expect(logger.error).toHaveBeenCalledWith(
      "[cache-cleanup] Failed to cleanup expired cache entries",
      expect.objectContaining({
        error: "DB connection failed",
        timestamp: expect.any(String),
      })
    );
  });

  it("should throw error to allow pg-boss retry", async () => {
    const dbError = new Error("Transient error");
    vi.mocked(db.responseCache.deleteMany).mockRejectedValue(dbError);

    await expect(cleanupExpiredCache()).rejects.toThrow("Transient error");
  });

  it("should use current time for expiration check", async () => {
    const beforeCall = new Date();
    vi.mocked(db.responseCache.deleteMany).mockResolvedValue({ count: 0 });

    await cleanupExpiredCache();
    const afterCall = new Date();

    const callArgs = vi.mocked(db.responseCache.deleteMany).mock.calls[0]?.[0];
    // Extract the lt date from the expiresAt filter
    const expiresAtFilter = callArgs?.where?.expiresAt as { lt: Date } | undefined;
    const usedDate = expiresAtFilter?.lt;

    // The date used should be between before and after call
    expect(usedDate).toBeDefined();
    expect(usedDate!.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    expect(usedDate!.getTime()).toBeLessThanOrEqual(afterCall.getTime());
  });

  it("should return valid ISO timestamp", async () => {
    vi.mocked(db.responseCache.deleteMany).mockResolvedValue({ count: 0 });

    const result = await cleanupExpiredCache();

    // Verify timestamp is valid ISO format
    const parsedDate = new Date(result.timestamp);
    expect(parsedDate.toISOString()).toBe(result.timestamp);
  });

  it("should handle large number of expired entries", async () => {
    vi.mocked(db.responseCache.deleteMany).mockResolvedValue({ count: 10000 });

    const result = await cleanupExpiredCache();

    expect(result.deleted).toBe(10000);
    expect(logger.info).toHaveBeenCalledWith(
      "[cache-cleanup] Deleted expired entries",
      expect.objectContaining({ deleted: 10000 })
    );
  });
});
