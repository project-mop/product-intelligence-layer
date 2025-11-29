/**
 * Sunset Date Calculation Utilities
 *
 * Calculates sunset dates for deprecated versions.
 * Sunset date is 90 days from deprecation.
 *
 * @see docs/stories/5-5-version-pinning-and-deprecation.md AC: 6
 */

/**
 * Number of days after deprecation before sunset.
 * Versions beyond sunset still work in MVP (warning only).
 */
export const SUNSET_DAYS = 90;

/**
 * Calculate the sunset date for a deprecated version.
 *
 * @param deprecatedAt - The date the version was deprecated
 * @returns The sunset date (90 days from deprecation)
 */
export function calculateSunsetDate(deprecatedAt: Date): Date {
  const sunset = new Date(deprecatedAt);
  sunset.setDate(sunset.getDate() + SUNSET_DAYS);
  return sunset;
}

/**
 * Check if a deprecated version is beyond its sunset date.
 *
 * Note: In MVP, versions beyond sunset still work (warning only).
 * Future: May enforce hard sunset in Growth phase.
 *
 * @param deprecatedAt - The date the version was deprecated
 * @returns true if current time is past the sunset date
 */
export function isBeyondSunset(deprecatedAt: Date): boolean {
  const sunsetDate = calculateSunsetDate(deprecatedAt);
  return new Date() > sunsetDate;
}

/**
 * Calculate days until sunset for a deprecated version.
 *
 * @param deprecatedAt - The date the version was deprecated
 * @returns Number of days until sunset (negative if past sunset)
 */
export function daysUntilSunset(deprecatedAt: Date): number {
  const sunsetDate = calculateSunsetDate(deprecatedAt);
  const now = new Date();
  const diffMs = sunsetDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
