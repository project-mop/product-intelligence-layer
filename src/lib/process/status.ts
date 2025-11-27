/**
 * Process Status Computation Utility
 *
 * Computes the aggregate status of a process based on its versions.
 * Status hierarchy: PRODUCTION > SANDBOX > DRAFT
 *
 * @see docs/stories/3-4-intelligence-list-dashboard.md
 */

/**
 * Process status type derived from version environments.
 */
export type ProcessStatus = "DRAFT" | "SANDBOX" | "PRODUCTION";

/**
 * Minimal version interface for status computation.
 */
export interface VersionForStatus {
  environment: string;
  deprecatedAt?: Date | null;
}

/**
 * Computes the aggregate status of a process from its versions.
 *
 * Logic:
 * - If any non-deprecated version is PRODUCTION → PRODUCTION
 * - Else if any non-deprecated version is SANDBOX → SANDBOX
 * - Else → DRAFT
 *
 * @param versions - Array of process versions with environment and deprecatedAt
 * @returns The computed process status
 */
export function computeProcessStatus(versions: VersionForStatus[]): ProcessStatus {
  // Filter out deprecated versions
  const activeVersions = versions.filter((v) => !v.deprecatedAt);

  // Check for PRODUCTION first (highest priority)
  const hasProduction = activeVersions.some(
    (v) => v.environment === "PRODUCTION"
  );
  if (hasProduction) {
    return "PRODUCTION";
  }

  // Check for SANDBOX second
  const hasSandbox = activeVersions.some((v) => v.environment === "SANDBOX");
  if (hasSandbox) {
    return "SANDBOX";
  }

  // Default to DRAFT
  return "DRAFT";
}
