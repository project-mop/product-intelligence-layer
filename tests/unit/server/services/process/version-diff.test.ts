/**
 * Version Diff Service Unit Tests
 *
 * Tests the version comparison logic for promotion confirmation.
 *
 * Story 5.3 AC: 3 - Confirmation dialog shows diff from current production version
 *
 * @module tests/unit/server/services/process/version-diff.test
 */

import { describe, expect, it } from "vitest";
import {
  compareVersions,
  formatFieldPath,
  formatValueForDisplay,
} from "~/server/services/process/version-diff";
import type { ProcessVersion } from "../../../../../generated/prisma";

// Helper to create a mock ProcessVersion
function createMockVersion(
  overrides: Partial<ProcessVersion> = {}
): ProcessVersion {
  return {
    id: "procv_test123",
    processId: "proc_test123",
    version: "1.0.0",
    config: {
      systemPrompt: "Test prompt",
      temperature: 0.7,
      maxTokens: 512,
    },
    environment: "SANDBOX",
    status: "ACTIVE",
    publishedAt: null,
    deprecatedAt: null,
    changeNotes: null,
    promotedBy: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("compareVersions", () => {
  describe("first promotion (no production version)", () => {
    it("should return empty diff with 'First deployment' summary when version2 is null", () => {
      const version1 = createMockVersion();

      const result = compareVersions(version1, null);

      expect(result.hasChanges).toBe(false);
      expect(result.changes).toEqual([]);
      expect(result.summary).toBe("First deployment to production");
      expect(result.changeCount).toEqual({ added: 0, removed: 0, modified: 0 });
    });
  });

  describe("detecting changes", () => {
    it("should detect added fields", () => {
      const version1 = createMockVersion({
        config: {
          systemPrompt: "Test prompt",
          temperature: 0.7,
          newField: "added value",
        },
      });
      const version2 = createMockVersion({
        config: {
          systemPrompt: "Test prompt",
          temperature: 0.7,
        },
      });

      const result = compareVersions(version1, version2);

      expect(result.hasChanges).toBe(true);
      expect(result.changeCount.added).toBe(1);

      const addedChange = result.changes.find((c) => c.type === "added");
      expect(addedChange).toBeDefined();
      expect(addedChange?.path).toBe("config.newField");
      expect(addedChange?.oldValue).toBeNull();
      expect(addedChange?.newValue).toBe("added value");
    });

    it("should detect removed fields", () => {
      const version1 = createMockVersion({
        config: {
          systemPrompt: "Test prompt",
        },
      });
      const version2 = createMockVersion({
        config: {
          systemPrompt: "Test prompt",
          removedField: "old value",
        },
      });

      const result = compareVersions(version1, version2);

      expect(result.hasChanges).toBe(true);
      expect(result.changeCount.removed).toBe(1);

      const removedChange = result.changes.find((c) => c.type === "removed");
      expect(removedChange).toBeDefined();
      expect(removedChange?.path).toBe("config.removedField");
      expect(removedChange?.oldValue).toBe("old value");
      expect(removedChange?.newValue).toBeNull();
    });

    it("should detect modified fields", () => {
      const version1 = createMockVersion({
        config: {
          systemPrompt: "Updated prompt",
          temperature: 0.7,
        },
      });
      const version2 = createMockVersion({
        config: {
          systemPrompt: "Original prompt",
          temperature: 0.7,
        },
      });

      const result = compareVersions(version1, version2);

      expect(result.hasChanges).toBe(true);
      expect(result.changeCount.modified).toBe(1);

      const modifiedChange = result.changes.find((c) => c.type === "modified");
      expect(modifiedChange).toBeDefined();
      expect(modifiedChange?.path).toBe("config.systemPrompt");
      expect(modifiedChange?.oldValue).toBe("Original prompt");
      expect(modifiedChange?.newValue).toBe("Updated prompt");
    });

    it("should handle nested object changes", () => {
      const version1 = createMockVersion({
        config: {
          nested: {
            inner: "new value",
          },
        },
      });
      const version2 = createMockVersion({
        config: {
          nested: {
            inner: "old value",
          },
        },
      });

      const result = compareVersions(version1, version2);

      expect(result.hasChanges).toBe(true);
      const change = result.changes.find(
        (c) => c.path === "config.nested.inner"
      );
      expect(change).toBeDefined();
      expect(change?.type).toBe("modified");
    });

    it("should handle null/undefined values", () => {
      const version1 = createMockVersion({
        config: {
          field: null,
        },
      });
      const version2 = createMockVersion({
        config: {
          field: "had value",
        },
      });

      const result = compareVersions(version1, version2);

      expect(result.hasChanges).toBe(true);
      const change = result.changes.find((c) => c.path === "config.field");
      expect(change?.type).toBe("modified");
      expect(change?.oldValue).toBe("had value");
      expect(change?.newValue).toBeNull();
    });

    it("should handle array changes", () => {
      const version1 = createMockVersion({
        config: {
          items: ["a", "b", "c"],
        },
      });
      const version2 = createMockVersion({
        config: {
          items: ["a", "b"],
        },
      });

      const result = compareVersions(version1, version2);

      expect(result.hasChanges).toBe(true);
      const change = result.changes.find((c) => c.path === "config.items");
      expect(change?.type).toBe("modified");
    });
  });

  describe("no changes", () => {
    it("should return empty diff when configs are identical", () => {
      const config = {
        systemPrompt: "Same prompt",
        temperature: 0.7,
        maxTokens: 512,
      };
      const version1 = createMockVersion({ config });
      const version2 = createMockVersion({ config });

      const result = compareVersions(version1, version2);

      expect(result.hasChanges).toBe(false);
      expect(result.changes).toEqual([]);
      expect(result.summary).toBe("No changes detected");
    });
  });

  describe("summary generation", () => {
    it("should generate correct summary for single modification", () => {
      const version1 = createMockVersion({
        config: { field: "new" },
      });
      const version2 = createMockVersion({
        config: { field: "old" },
      });

      const result = compareVersions(version1, version2);

      expect(result.summary).toBe("1 field modified");
    });

    it("should generate correct summary for multiple changes", () => {
      const version1 = createMockVersion({
        config: {
          existing: "modified",
          newField: "added",
        },
      });
      const version2 = createMockVersion({
        config: {
          existing: "original",
          removedField: "removed",
        },
      });

      const result = compareVersions(version1, version2);

      expect(result.summary).toContain("modified");
      expect(result.summary).toContain("added");
      expect(result.summary).toContain("removed");
    });

    it("should use plural form for multiple changes of same type", () => {
      const version1 = createMockVersion({
        config: {
          field1: "modified1",
          field2: "modified2",
        },
      });
      const version2 = createMockVersion({
        config: {
          field1: "original1",
          field2: "original2",
        },
      });

      const result = compareVersions(version1, version2);

      expect(result.summary).toBe("2 fields modified");
    });
  });
});

describe("formatFieldPath", () => {
  it("should remove config prefix", () => {
    expect(formatFieldPath("config.systemPrompt")).toBe("System Prompt");
  });

  it("should convert camelCase to Title Case", () => {
    expect(formatFieldPath("config.maxTokens")).toBe("Max Tokens");
  });

  it("should handle nested paths", () => {
    expect(formatFieldPath("config.nested.innerField")).toBe(
      "Nested → Inner Field"
    );
  });

  it("should handle paths without config prefix", () => {
    expect(formatFieldPath("someField")).toBe("Some Field");
  });
});

describe("formatValueForDisplay", () => {
  it("should format null values", () => {
    expect(formatValueForDisplay(null)).toBe("null");
  });

  it("should format undefined values", () => {
    expect(formatValueForDisplay(undefined)).toBe("undefined");
  });

  it("should quote string values", () => {
    expect(formatValueForDisplay("hello")).toBe('"hello"');
  });

  it("should truncate long strings", () => {
    const longString = "a".repeat(150);
    const result = formatValueForDisplay(longString, 100);
    expect(result).toBe(`"${"a".repeat(100)}..."`);
  });

  it("should format numbers", () => {
    expect(formatValueForDisplay(42)).toBe("42");
    expect(formatValueForDisplay(3.14)).toBe("3.14");
  });

  it("should format booleans", () => {
    expect(formatValueForDisplay(true)).toBe("true");
    expect(formatValueForDisplay(false)).toBe("false");
  });

  it("should format arrays with count", () => {
    expect(formatValueForDisplay([1, 2, 3])).toBe("[3 items]");
  });

  it("should format objects with field count", () => {
    expect(formatValueForDisplay({ a: 1, b: 2 })).toBe("{2 fields}");
  });
});
