/**
 * Version Response Headers Utility
 *
 * Builds HTTP headers for version pinning responses.
 * All responses include version metadata headers.
 * Deprecated versions include additional warning headers.
 *
 * @see docs/stories/5-5-version-pinning-and-deprecation.md AC: 4, 5, 6, 9, 10
 */

import type { ResolvedVersion } from "./version-resolver";
import { extractVersionNumber } from "./version-resolver";
import { daysUntilSunset } from "./sunset";

/**
 * Version response headers structure.
 * Always includes X-Version, X-Version-Status, X-Environment.
 * Deprecated versions add X-Deprecated, X-Deprecated-Message, X-Sunset-Date.
 */
export interface VersionHeaders {
  "X-Version": string;
  "X-Version-Status": "active" | "deprecated";
  "X-Environment": "sandbox" | "production";
  "X-Deprecated"?: "true";
  "X-Deprecated-Message"?: string;
  "X-Sunset-Date"?: string;
}

/**
 * Build version response headers from a resolved version.
 *
 * @param result - The resolved version result
 * @returns VersionHeaders to add to the response
 *
 * @example
 * ```typescript
 * const headers = buildVersionHeaders(resolvedVersion);
 * response.headers.set("X-Version", headers["X-Version"]);
 * // ... set other headers
 * ```
 */
export function buildVersionHeaders(result: ResolvedVersion): VersionHeaders {
  const versionNumber = extractVersionNumber(result.version.version);

  const headers: VersionHeaders = {
    "X-Version": String(versionNumber),
    "X-Version-Status": result.isDeprecated ? "deprecated" : "active",
    "X-Environment": result.version.environment.toLowerCase() as "sandbox" | "production",
  };

  // AC: 4, 5, 6 - Add deprecation headers for deprecated versions
  if (result.isDeprecated) {
    headers["X-Deprecated"] = "true";
    headers["X-Deprecated-Message"] = buildDeprecationMessage(result);

    if (result.sunsetDate) {
      // AC: 6 - X-Sunset-Date header in ISO 8601 format
      headers["X-Sunset-Date"] = result.sunsetDate.toISOString();
    }
  }

  return headers;
}

/**
 * Build deprecation warning message.
 *
 * Message format:
 * - If before sunset: "Version X is deprecated. Latest is version Y. Sunset in Z days."
 * - If after sunset: "Version X is deprecated and past its sunset date. Please upgrade to version Y."
 *
 * @param result - The resolved version result
 * @returns Deprecation warning message
 */
export function buildDeprecationMessage(result: ResolvedVersion): string {
  const versionNumber = extractVersionNumber(result.version.version);
  const latestVersion = result.latestVersionNumber;

  if (result.version.deprecatedAt) {
    const days = daysUntilSunset(result.version.deprecatedAt);

    if (days > 0) {
      return `Version ${versionNumber} is deprecated. Latest is version ${latestVersion}. Sunset in ${days} days.`;
    } else {
      return `Version ${versionNumber} is deprecated and past its sunset date. Please upgrade to version ${latestVersion}.`;
    }
  }

  // Fallback if deprecatedAt is null (shouldn't happen for deprecated versions)
  return `Version ${versionNumber} is deprecated. Latest is version ${latestVersion}.`;
}

/**
 * Apply version headers to a NextResponse or Headers object.
 *
 * @param headers - Headers object or NextResponse headers
 * @param versionHeaders - Version headers to apply
 */
export function applyVersionHeaders(
  headers: Headers,
  versionHeaders: VersionHeaders
): void {
  headers.set("X-Version", versionHeaders["X-Version"]);
  headers.set("X-Version-Status", versionHeaders["X-Version-Status"]);
  headers.set("X-Environment", versionHeaders["X-Environment"]);

  if (versionHeaders["X-Deprecated"]) {
    headers.set("X-Deprecated", versionHeaders["X-Deprecated"]);
  }
  if (versionHeaders["X-Deprecated-Message"]) {
    headers.set("X-Deprecated-Message", versionHeaders["X-Deprecated-Message"]);
  }
  if (versionHeaders["X-Sunset-Date"]) {
    headers.set("X-Sunset-Date", versionHeaders["X-Sunset-Date"]);
  }
}
