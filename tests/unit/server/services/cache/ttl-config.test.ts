/**
 * Cache TTL Configuration Unit Tests
 *
 * Tests for cache TTL validation and configuration.
 *
 * Story 4.6 AC: 3 - TTL range: 0 (disabled) to 86400 (24 hours)
 *
 * @see docs/stories/4-6-configurable-cache-ttl.md
 * @see docs/testing-strategy-mvp.md
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Cache TTL validation schema (same as in process.ts router)
 */
const cacheTtlSchema = z
  .number()
  .int()
  .min(0, "Cache TTL must be at least 0 (disabled)")
  .max(86400, "Cache TTL cannot exceed 24 hours (86400 seconds)")
  .optional();

/**
 * Cache config schema for updateVersionConfig
 */
const cacheConfigSchema = z.object({
  cacheTtlSeconds: cacheTtlSchema,
  cacheEnabled: z.boolean().optional(),
});

describe("Cache TTL Validation Schema", () => {
  describe("cacheTtlSeconds validation", () => {
    it("should accept 0 (disabled)", () => {
      const result = cacheTtlSchema.safeParse(0);
      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });

    it("should accept 900 (15 min - default)", () => {
      const result = cacheTtlSchema.safeParse(900);
      expect(result.success).toBe(true);
      expect(result.data).toBe(900);
    });

    it("should accept 3600 (1 hour)", () => {
      const result = cacheTtlSchema.safeParse(3600);
      expect(result.success).toBe(true);
      expect(result.data).toBe(3600);
    });

    it("should accept 86400 (24 hours - max)", () => {
      const result = cacheTtlSchema.safeParse(86400);
      expect(result.success).toBe(true);
      expect(result.data).toBe(86400);
    });

    it("should accept undefined (optional)", () => {
      const result = cacheTtlSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it("should reject negative values", () => {
      const result = cacheTtlSchema.safeParse(-1);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("at least 0");
      }
    });

    it("should reject values exceeding 86400", () => {
      const result = cacheTtlSchema.safeParse(86401);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("cannot exceed");
      }
    });

    it("should reject floating point numbers", () => {
      const result = cacheTtlSchema.safeParse(900.5);
      expect(result.success).toBe(false);
    });

    it("should reject strings", () => {
      const result = cacheTtlSchema.safeParse("900");
      expect(result.success).toBe(false);
    });

    it("should reject null", () => {
      const result = cacheTtlSchema.safeParse(null);
      expect(result.success).toBe(false);
    });
  });

  describe("cacheEnabled validation", () => {
    it("should accept true", () => {
      const result = cacheConfigSchema.safeParse({ cacheEnabled: true });
      expect(result.success).toBe(true);
      expect(result.data?.cacheEnabled).toBe(true);
    });

    it("should accept false", () => {
      const result = cacheConfigSchema.safeParse({ cacheEnabled: false });
      expect(result.success).toBe(true);
      expect(result.data?.cacheEnabled).toBe(false);
    });

    it("should accept undefined (optional)", () => {
      const result = cacheConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.cacheEnabled).toBeUndefined();
    });

    it("should reject non-boolean values", () => {
      const result = cacheConfigSchema.safeParse({ cacheEnabled: "true" });
      expect(result.success).toBe(false);
    });
  });

  describe("combined cache config validation", () => {
    it("should accept valid combined config", () => {
      const result = cacheConfigSchema.safeParse({
        cacheTtlSeconds: 3600,
        cacheEnabled: true,
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        cacheTtlSeconds: 3600,
        cacheEnabled: true,
      });
    });

    it("should accept partial config (only TTL)", () => {
      const result = cacheConfigSchema.safeParse({
        cacheTtlSeconds: 1800,
      });
      expect(result.success).toBe(true);
      expect(result.data?.cacheTtlSeconds).toBe(1800);
    });

    it("should accept partial config (only enabled)", () => {
      const result = cacheConfigSchema.safeParse({
        cacheEnabled: false,
      });
      expect(result.success).toBe(true);
      expect(result.data?.cacheEnabled).toBe(false);
    });

    it("should accept empty config", () => {
      const result = cacheConfigSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe("Cache TTL Edge Cases", () => {
  describe("boundary values", () => {
    it("should accept minimum boundary (0)", () => {
      expect(cacheTtlSchema.safeParse(0).success).toBe(true);
    });

    it("should accept maximum boundary (86400)", () => {
      expect(cacheTtlSchema.safeParse(86400).success).toBe(true);
    });

    it("should reject just below minimum (-1)", () => {
      expect(cacheTtlSchema.safeParse(-1).success).toBe(false);
    });

    it("should reject just above maximum (86401)", () => {
      expect(cacheTtlSchema.safeParse(86401).success).toBe(false);
    });
  });

  describe("common preset values", () => {
    const presets = [
      { name: "5 minutes", value: 300 },
      { name: "15 minutes", value: 900 },
      { name: "30 minutes", value: 1800 },
      { name: "1 hour", value: 3600 },
      { name: "6 hours", value: 21600 },
      { name: "12 hours", value: 43200 },
      { name: "24 hours", value: 86400 },
    ];

    presets.forEach(({ name, value }) => {
      it(`should accept preset: ${name} (${value}s)`, () => {
        expect(cacheTtlSchema.safeParse(value).success).toBe(true);
      });
    });
  });
});
