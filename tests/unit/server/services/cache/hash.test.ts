/**
 * Cache Hash Utility Unit Tests
 *
 * Tests for the computeInputHash function that generates
 * deterministic cache keys.
 *
 * @see docs/stories/4-5-response-caching.md
 * @see docs/testing-strategy-mvp.md
 */

import { describe, expect, it } from "vitest";
import { computeInputHash } from "~/server/services/cache/hash";

describe("computeInputHash", () => {
  const tenantId = "ten_test123";
  const processId = "proc_test456";

  describe("deterministic output", () => {
    it("should produce identical hash for same inputs", () => {
      const input = { productName: "Test", price: 100 };

      const hash1 = computeInputHash(tenantId, processId, input);
      const hash2 = computeInputHash(tenantId, processId, input);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(32);
    });

    it("should produce identical hash regardless of key order", () => {
      const input1 = { b: 2, a: 1, c: 3 };
      const input2 = { a: 1, b: 2, c: 3 };
      const input3 = { c: 3, b: 2, a: 1 };

      const hash1 = computeInputHash(tenantId, processId, input1);
      const hash2 = computeInputHash(tenantId, processId, input2);
      const hash3 = computeInputHash(tenantId, processId, input3);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it("should produce 32-character hex string", () => {
      const input = { test: "data" };

      const hash = computeInputHash(tenantId, processId, input);

      expect(hash).toHaveLength(32);
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe("different outputs for different inputs", () => {
    it("should produce different hash for different tenantId", () => {
      const input = { test: "data" };

      const hash1 = computeInputHash("ten_a", processId, input);
      const hash2 = computeInputHash("ten_b", processId, input);

      expect(hash1).not.toBe(hash2);
    });

    it("should produce different hash for different processId", () => {
      const input = { test: "data" };

      const hash1 = computeInputHash(tenantId, "proc_a", input);
      const hash2 = computeInputHash(tenantId, "proc_b", input);

      expect(hash1).not.toBe(hash2);
    });

    it("should produce different hash for different input values", () => {
      const input1 = { value: 1 };
      const input2 = { value: 2 };

      const hash1 = computeInputHash(tenantId, processId, input1);
      const hash2 = computeInputHash(tenantId, processId, input2);

      expect(hash1).not.toBe(hash2);
    });

    it("should produce different hash for different input keys", () => {
      const input1 = { keyA: 1 };
      const input2 = { keyB: 1 };

      const hash1 = computeInputHash(tenantId, processId, input1);
      const hash2 = computeInputHash(tenantId, processId, input2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("nested objects", () => {
    it("should handle nested objects with sorted keys", () => {
      const input1 = {
        outer: { b: 2, a: 1 },
        name: "test",
      };
      const input2 = {
        name: "test",
        outer: { a: 1, b: 2 },
      };

      const hash1 = computeInputHash(tenantId, processId, input1);
      const hash2 = computeInputHash(tenantId, processId, input2);

      expect(hash1).toBe(hash2);
    });

    it("should handle deeply nested objects", () => {
      const input = {
        level1: {
          level2: {
            level3: {
              value: "deep",
            },
          },
        },
      };

      const hash = computeInputHash(tenantId, processId, input);

      expect(hash).toHaveLength(32);
    });

    it("should produce different hash for different nested values", () => {
      const input1 = { outer: { inner: 1 } };
      const input2 = { outer: { inner: 2 } };

      const hash1 = computeInputHash(tenantId, processId, input1);
      const hash2 = computeInputHash(tenantId, processId, input2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("arrays", () => {
    it("should handle arrays (order matters)", () => {
      const input1 = { items: [1, 2, 3] };
      const input2 = { items: [3, 2, 1] };

      const hash1 = computeInputHash(tenantId, processId, input1);
      const hash2 = computeInputHash(tenantId, processId, input2);

      // Array order matters, so hashes should be different
      expect(hash1).not.toBe(hash2);
    });

    it("should produce identical hash for identical arrays", () => {
      const input1 = { items: [1, 2, 3] };
      const input2 = { items: [1, 2, 3] };

      const hash1 = computeInputHash(tenantId, processId, input1);
      const hash2 = computeInputHash(tenantId, processId, input2);

      expect(hash1).toBe(hash2);
    });

    it("should handle arrays of objects with sorted keys", () => {
      const input1 = {
        items: [
          { b: 2, a: 1 },
          { d: 4, c: 3 },
        ],
      };
      const input2 = {
        items: [
          { a: 1, b: 2 },
          { c: 3, d: 4 },
        ],
      };

      const hash1 = computeInputHash(tenantId, processId, input1);
      const hash2 = computeInputHash(tenantId, processId, input2);

      expect(hash1).toBe(hash2);
    });
  });

  describe("special characters", () => {
    it("should handle unicode characters", () => {
      const input = { name: "日本語テスト", emoji: "🚀" };

      const hash = computeInputHash(tenantId, processId, input);

      expect(hash).toHaveLength(32);
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });

    it("should handle special JSON characters", () => {
      const input = {
        quote: 'He said "hello"',
        backslash: "path\\to\\file",
        newline: "line1\nline2",
        tab: "col1\tcol2",
      };

      const hash = computeInputHash(tenantId, processId, input);

      expect(hash).toHaveLength(32);
    });

    it("should produce identical hash for special chars regardless of key order", () => {
      const input1 = { b: "hello\nworld", a: "test\ttab" };
      const input2 = { a: "test\ttab", b: "hello\nworld" };

      const hash1 = computeInputHash(tenantId, processId, input1);
      const hash2 = computeInputHash(tenantId, processId, input2);

      expect(hash1).toBe(hash2);
    });
  });

  describe("edge cases", () => {
    it("should handle empty object", () => {
      const input = {};

      const hash = computeInputHash(tenantId, processId, input);

      expect(hash).toHaveLength(32);
    });

    it("should handle null values in object", () => {
      const input = { value: null };

      const hash = computeInputHash(tenantId, processId, input);

      expect(hash).toHaveLength(32);
    });

    it("should handle boolean values", () => {
      const input = { enabled: true, disabled: false };

      const hash = computeInputHash(tenantId, processId, input);

      expect(hash).toHaveLength(32);
    });

    it("should handle numeric values", () => {
      const input = { int: 42, float: 3.14, negative: -10, zero: 0 };

      const hash = computeInputHash(tenantId, processId, input);

      expect(hash).toHaveLength(32);
    });

    it("should handle empty strings", () => {
      const input = { empty: "", name: "test" };

      const hash = computeInputHash(tenantId, processId, input);

      expect(hash).toHaveLength(32);
    });
  });
});
