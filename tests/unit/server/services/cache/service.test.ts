/**
 * Cache Service Unit Tests
 *
 * Tests for the PostgresCacheService with mocked Prisma client.
 *
 * @see docs/stories/4-5-response-caching.md
 * @see docs/testing-strategy-mvp.md
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CacheEntry } from "~/server/services/cache/types";

// Mock the db module
vi.mock("~/server/db", () => ({
  db: {
    responseCache: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { db } from "~/server/db";
import {
  PostgresCacheService,
  getCacheService,
  resetCacheService,
} from "~/server/services/cache/service";

describe("PostgresCacheService", () => {
  const tenantId = "ten_test123";
  const processId = "proc_test456";
  const inputHash = "abc123def456789012345678";

  let cacheService: PostgresCacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCacheService();
    cacheService = new PostgresCacheService();
  });

  describe("get", () => {
    it("should return null when entry not found", async () => {
      vi.mocked(db.responseCache.findFirst).mockResolvedValue(null);

      const result = await cacheService.get(tenantId, processId, inputHash);

      expect(result).toBeNull();
      expect(db.responseCache.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId,
          processId,
          inputHash,
          expiresAt: { gt: expect.any(Date) },
        },
      });
    });

    it("should return entry when found and not expired", async () => {
      const now = new Date();
      const cachedAt = new Date(now.getTime() - 60000); // 1 minute ago
      const mockEntry = {
        id: "cache_123",
        tenantId,
        processId,
        inputHash,
        response: { shortDescription: "Cached data" },
        version: "1.0.0",
        cachedAt,
        expiresAt: new Date(now.getTime() + 3600000), // 1 hour from now
        createdAt: cachedAt,
      };

      vi.mocked(db.responseCache.findFirst).mockResolvedValue(mockEntry);

      const result = await cacheService.get(tenantId, processId, inputHash);

      expect(result).toEqual({
        data: { shortDescription: "Cached data" },
        meta: {
          version: "1.0.0",
          cachedAt: cachedAt.toISOString(),
          inputHash,
        },
      });
    });

    it("should return null for expired entry (handled by DB query)", async () => {
      // The expiresAt > now filter is in the query, so expired entries
      // won't be returned by findFirst
      vi.mocked(db.responseCache.findFirst).mockResolvedValue(null);

      const result = await cacheService.get(tenantId, processId, inputHash);

      expect(result).toBeNull();
    });

    it("should return null on database error (silent failure per AC#9)", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      vi.mocked(db.responseCache.findFirst).mockRejectedValue(
        new Error("DB connection failed")
      );

      const result = await cacheService.get(tenantId, processId, inputHash);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[CacheService] Error reading cache:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("should include tenantId in query for tenant isolation (AC#7)", async () => {
      vi.mocked(db.responseCache.findFirst).mockResolvedValue(null);

      await cacheService.get(tenantId, processId, inputHash);

      const callArgs = vi.mocked(db.responseCache.findFirst).mock.calls[0]?.[0];
      expect(callArgs?.where?.tenantId).toBe(tenantId);
    });
  });

  describe("set", () => {
    const mockEntry: CacheEntry = {
      data: { result: "generated data" },
      meta: {
        version: "1.0.0",
        cachedAt: "2025-11-28T10:00:00.000Z",
        inputHash,
      },
    };
    const ttlSeconds = 900; // 15 minutes

    it("should upsert cache entry with correct data", async () => {
      vi.mocked(db.responseCache.upsert).mockResolvedValue({} as never);

      await cacheService.set(tenantId, processId, inputHash, mockEntry, ttlSeconds);

      expect(db.responseCache.upsert).toHaveBeenCalledWith({
        where: {
          tenantId_processId_inputHash: {
            tenantId,
            processId,
            inputHash,
          },
        },
        create: expect.objectContaining({
          tenantId,
          processId,
          inputHash,
          response: mockEntry.data,
          version: mockEntry.meta.version,
        }),
        update: expect.objectContaining({
          response: mockEntry.data,
          version: mockEntry.meta.version,
        }),
      });
    });

    it("should calculate correct expiresAt based on TTL", async () => {
      const beforeCall = Date.now();
      vi.mocked(db.responseCache.upsert).mockResolvedValue({} as never);

      await cacheService.set(tenantId, processId, inputHash, mockEntry, ttlSeconds);

      const afterCall = Date.now();
      const callArgs = vi.mocked(db.responseCache.upsert).mock.calls[0]?.[0];
      const expiresAt = callArgs?.create.expiresAt as Date;

      // expiresAt should be approximately now + ttlSeconds
      const expectedMin = beforeCall + ttlSeconds * 1000;
      const expectedMax = afterCall + ttlSeconds * 1000;

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it("should not throw on database error (silent failure per AC#9)", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      vi.mocked(db.responseCache.upsert).mockRejectedValue(
        new Error("DB write failed")
      );

      // Should not throw
      await expect(
        cacheService.set(tenantId, processId, inputHash, mockEntry, ttlSeconds)
      ).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[CacheService] Error writing cache:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle upsert for concurrent requests", async () => {
      vi.mocked(db.responseCache.upsert).mockResolvedValue({} as never);

      await cacheService.set(tenantId, processId, inputHash, mockEntry, ttlSeconds);

      // Verify upsert was called (handles both create and update cases)
      expect(db.responseCache.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe("invalidate", () => {
    it("should delete all entries for process", async () => {
      vi.mocked(db.responseCache.deleteMany).mockResolvedValue({ count: 5 });

      await cacheService.invalidate(tenantId, processId);

      expect(db.responseCache.deleteMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          processId,
        },
      });
    });

    it("should include tenantId in query for tenant isolation", async () => {
      vi.mocked(db.responseCache.deleteMany).mockResolvedValue({ count: 0 });

      await cacheService.invalidate(tenantId, processId);

      const callArgs = vi.mocked(db.responseCache.deleteMany).mock.calls[0]?.[0];
      expect(callArgs?.where?.tenantId).toBe(tenantId);
    });

    it("should not throw on database error (silent failure)", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      vi.mocked(db.responseCache.deleteMany).mockRejectedValue(
        new Error("DB delete failed")
      );

      await expect(
        cacheService.invalidate(tenantId, processId)
      ).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[CacheService] Error invalidating cache:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("should succeed even when no entries exist", async () => {
      vi.mocked(db.responseCache.deleteMany).mockResolvedValue({ count: 0 });

      await expect(
        cacheService.invalidate(tenantId, processId)
      ).resolves.not.toThrow();
    });
  });

  describe("tenant isolation (AC#7)", () => {
    it("should only query entries for the specified tenant in get", async () => {
      vi.mocked(db.responseCache.findFirst).mockResolvedValue(null);

      await cacheService.get("ten_A", processId, inputHash);
      await cacheService.get("ten_B", processId, inputHash);

      const calls = vi.mocked(db.responseCache.findFirst).mock.calls;
      expect(calls[0]?.[0]?.where?.tenantId).toBe("ten_A");
      expect(calls[1]?.[0]?.where?.tenantId).toBe("ten_B");
    });

    it("should only delete entries for the specified tenant in invalidate", async () => {
      vi.mocked(db.responseCache.deleteMany).mockResolvedValue({ count: 0 });

      await cacheService.invalidate("ten_A", processId);
      await cacheService.invalidate("ten_B", processId);

      const calls = vi.mocked(db.responseCache.deleteMany).mock.calls;
      expect(calls[0]?.[0]?.where?.tenantId).toBe("ten_A");
      expect(calls[1]?.[0]?.where?.tenantId).toBe("ten_B");
    });
  });
});

describe("getCacheService singleton", () => {
  beforeEach(() => {
    resetCacheService();
  });

  it("should return same instance on multiple calls", () => {
    const instance1 = getCacheService();
    const instance2 = getCacheService();

    expect(instance1).toBe(instance2);
  });

  it("should return new instance after reset", () => {
    const instance1 = getCacheService();
    resetCacheService();
    const instance2 = getCacheService();

    expect(instance1).not.toBe(instance2);
  });
});
