/**
 * Version Diff Service
 *
 * Compares two process versions to generate a diff for promotion confirmation.
 * Shows what changed between sandbox and production versions.
 *
 * @see docs/stories/5-3-promote-to-production.md
 */

import type { ProcessVersion } from "../../../../generated/prisma";

/**
 * Type of change detected between versions
 */
export type DiffChangeType = "added" | "removed" | "modified";

/**
 * A single change between versions
 */
export interface VersionChange {
  /** Dot-notation path to the changed field (e.g., "config.systemPrompt") */
  path: string;
  /** Type of change */
  type: DiffChangeType;
  /** Previous value (null for added fields) */
  oldValue: unknown;
  /** New value (null for removed fields) */
  newValue: unknown;
}

/**
 * Complete diff between two versions
 */
export interface VersionDiff {
  /** List of individual changes */
  changes: VersionChange[];
  /** Human-readable summary of the diff */
  summary: string;
  /** Whether there are any changes */
  hasChanges: boolean;
  /** Count of changes by type */
  changeCount: {
    added: number;
    removed: number;
    modified: number;
  };
}

/**
 * Compares two process versions and returns a diff.
 *
 * If version2 is null (first promotion), returns an empty diff with
 * a summary indicating this is the first production deployment.
 *
 * @param version1 - The new version (source for promotion)
 * @param version2 - The current production version (null if first promotion)
 * @returns VersionDiff containing all changes
 */
export function compareVersions(
  version1: ProcessVersion,
  version2: ProcessVersion | null
): VersionDiff {
  // First promotion case - no existing production version
  if (!version2) {
    return {
      changes: [],
      summary: "First deployment to production",
      hasChanges: false,
      changeCount: { added: 0, removed: 0, modified: 0 },
    };
  }

  const changes: VersionChange[] = [];

  // Compare config objects
  const config1 = (version1.config ?? {}) as Record<string, unknown>;
  const config2 = (version2.config ?? {}) as Record<string, unknown>;

  // Deep compare configs
  compareObjects(config1, config2, "config", changes);

  // Count changes by type
  const changeCount = {
    added: changes.filter((c) => c.type === "added").length,
    removed: changes.filter((c) => c.type === "removed").length,
    modified: changes.filter((c) => c.type === "modified").length,
  };

  // Generate summary
  const summary = generateSummary(changes, changeCount);

  return {
    changes,
    summary,
    hasChanges: changes.length > 0,
    changeCount,
  };
}

/**
 * Recursively compares two objects and records changes.
 *
 * @param obj1 - New object
 * @param obj2 - Old object
 * @param basePath - Current path in the object tree
 * @param changes - Array to collect changes
 */
function compareObjects(
  obj1: Record<string, unknown>,
  obj2: Record<string, unknown>,
  basePath: string,
  changes: VersionChange[]
): void {
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  for (const key of allKeys) {
    const path = `${basePath}.${key}`;
    const val1 = obj1[key];
    const val2 = obj2[key];

    // Key exists in new but not old (added)
    if (!(key in obj2)) {
      changes.push({
        path,
        type: "added",
        oldValue: null,
        newValue: val1,
      });
      continue;
    }

    // Key exists in old but not new (removed)
    if (!(key in obj1)) {
      changes.push({
        path,
        type: "removed",
        oldValue: val2,
        newValue: null,
      });
      continue;
    }

    // Both exist - compare values
    if (isObject(val1) && isObject(val2)) {
      // Recurse into nested objects
      compareObjects(
        val1 as Record<string, unknown>,
        val2 as Record<string, unknown>,
        path,
        changes
      );
    } else if (Array.isArray(val1) && Array.isArray(val2)) {
      // Compare arrays
      if (!arraysEqual(val1, val2)) {
        changes.push({
          path,
          type: "modified",
          oldValue: val2,
          newValue: val1,
        });
      }
    } else if (!valuesEqual(val1, val2)) {
      // Primitive values differ
      changes.push({
        path,
        type: "modified",
        oldValue: val2,
        newValue: val1,
      });
    }
  }
}

/**
 * Checks if a value is a plain object (not array, null, etc.)
 */
function isObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

/**
 * Compares two arrays for equality (deep comparison)
 */
function arraysEqual(arr1: unknown[], arr2: unknown[]): boolean {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((val, idx) => valuesEqual(val, arr2[idx]));
}

/**
 * Compares two values for equality (handles nested objects/arrays)
 */
function valuesEqual(val1: unknown, val2: unknown): boolean {
  if (val1 === val2) return true;
  if (val1 === null || val2 === null) return false;
  if (typeof val1 !== typeof val2) return false;

  if (Array.isArray(val1) && Array.isArray(val2)) {
    return arraysEqual(val1, val2);
  }

  if (isObject(val1) && isObject(val2)) {
    const keys1 = Object.keys(val1);
    const keys2 = Object.keys(val2);
    if (keys1.length !== keys2.length) return false;
    return keys1.every((key) => valuesEqual(val1[key], val2[key]));
  }

  return false;
}

/**
 * Generates a human-readable summary of the changes.
 */
function generateSummary(
  changes: VersionChange[],
  changeCount: { added: number; removed: number; modified: number }
): string {
  if (changes.length === 0) {
    return "No changes detected";
  }

  const parts: string[] = [];

  if (changeCount.modified > 0) {
    parts.push(
      `${changeCount.modified} field${changeCount.modified > 1 ? "s" : ""} modified`
    );
  }

  if (changeCount.added > 0) {
    parts.push(
      `${changeCount.added} field${changeCount.added > 1 ? "s" : ""} added`
    );
  }

  if (changeCount.removed > 0) {
    parts.push(
      `${changeCount.removed} field${changeCount.removed > 1 ? "s" : ""} removed`
    );
  }

  return parts.join(", ");
}

/**
 * Formats a field path for display by removing the "config." prefix
 * and converting camelCase to Title Case.
 *
 * @param path - The full dot-notation path
 * @returns Formatted display name
 */
export function formatFieldPath(path: string): string {
  // Remove "config." prefix if present
  const cleanPath = path.replace(/^config\./, "");

  // Split by dots for nested paths
  const parts = cleanPath.split(".");

  // Format each part: camelCase to Title Case
  const formattedParts = parts.map((part) => {
    return part
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  });

  return formattedParts.join(" → ");
}

/**
 * Formats a value for display in the diff view.
 * Handles truncation of long strings and formatting of objects.
 *
 * @param value - The value to format
 * @param maxLength - Maximum length for string display
 * @returns Formatted display string
 */
export function formatValueForDisplay(
  value: unknown,
  maxLength: number = 100
): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  if (typeof value === "string") {
    if (value.length > maxLength) {
      return `"${value.substring(0, maxLength)}..."`;
    }
    return `"${value}"`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    return `{${keys.length} fields}`;
  }

  return String(value);
}
