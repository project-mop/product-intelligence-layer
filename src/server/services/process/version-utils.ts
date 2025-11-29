/**
 * Version Utilities
 *
 * Pure utility functions for version string manipulation.
 * These functions have no database dependencies and can be safely
 * imported in unit tests.
 *
 * @see docs/stories/5-5-version-pinning-and-deprecation.md
 */

/**
 * Extract integer version number from semver string.
 * Versions are stored as "1.0.0", "2.0.0", etc. We extract the major number.
 *
 * @param semverString - Version string like "1.0.0"
 * @returns Integer version number (e.g., 1)
 */
export function extractVersionNumber(semverString: string): number {
  const match = semverString.match(/^(\d+)/);
  return match && match[1] ? parseInt(match[1], 10) : 0;
}
