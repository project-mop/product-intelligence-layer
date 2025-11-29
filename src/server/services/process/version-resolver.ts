/**
 * Version Resolver Service
 *
 * Resolves the appropriate ProcessVersion for a given process and environment.
 * Supports version pinning for future Story 5.5.
 *
 * @see docs/stories/5-1-sandbox-and-production-modes.md
 */

import type { ProcessVersion, Environment, VersionStatus } from "../../../../generated/prisma";
import { db } from "~/server/db";

/**
 * Parameters for resolving a process version
 */
export interface ResolveVersionParams {
  processId: string;
  tenantId: string;
  environment: "SANDBOX" | "PRODUCTION";
  pinnedVersion?: number;
}

/**
 * Result of version resolution
 */
export interface ResolvedVersion {
  version: ProcessVersion;
  isDeprecated: boolean;
  latestVersionNumber: number;
}

/**
 * Resolves the active version for a process in a specific environment.
 *
 * Resolution logic:
 * 1. If pinnedVersion is specified, find that specific version (for future Story 5.5)
 * 2. Otherwise, find the active (non-deprecated) version for the environment
 * 3. Return null if no version exists or all versions are deprecated
 *
 * @param params - Resolution parameters
 * @returns ResolvedVersion or null if no version found
 */
export async function resolveVersion(
  params: ResolveVersionParams
): Promise<ResolvedVersion | null> {
  const { processId, tenantId, environment, pinnedVersion } = params;

  // First, verify the process exists and belongs to tenant
  const process = await db.process.findFirst({
    where: {
      id: processId,
      tenantId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!process) {
    return null;
  }

  // Get all versions for this process in the specified environment
  const versions = await db.processVersion.findMany({
    where: {
      processId,
      environment: environment as Environment,
    },
    orderBy: { createdAt: "desc" },
  });

  if (versions.length === 0) {
    return null;
  }

  // Calculate latest version number (for informational purposes)
  // Version strings are semantic versions like "1.0.0", extract major
  const latestVersionNumber = versions.length;

  // If pinned version is requested (future Story 5.5)
  if (pinnedVersion !== undefined) {
    const pinnedVersionStr = `${pinnedVersion}.0.0`;
    const pinned = versions.find((v) => v.version === pinnedVersionStr);
    if (pinned) {
      return {
        version: pinned,
        isDeprecated: pinned.deprecatedAt !== null,
        latestVersionNumber,
      };
    }
    // Pinned version not found
    return null;
  }

  // Find active (non-deprecated) version
  // Priority: ACTIVE status, then most recently created
  const activeVersion = versions.find(
    (v) => v.status === ("ACTIVE" as VersionStatus) && v.deprecatedAt === null
  );

  if (activeVersion) {
    return {
      version: activeVersion,
      isDeprecated: false,
      latestVersionNumber,
    };
  }

  // Fall back to DRAFT status if no ACTIVE version (for sandbox development)
  if (environment === "SANDBOX") {
    const draftVersion = versions.find(
      (v) => v.status === ("DRAFT" as VersionStatus) && v.deprecatedAt === null
    );

    if (draftVersion) {
      return {
        version: draftVersion,
        isDeprecated: false,
        latestVersionNumber,
      };
    }
  }

  // No active or draft version found
  return null;
}

/**
 * Get all versions for a process with environment information
 *
 * @param processId - Process ID
 * @param tenantId - Tenant ID for isolation
 * @returns Array of ProcessVersion with environment details
 */
export async function getVersionsByEnvironment(
  processId: string,
  tenantId: string
): Promise<{
  sandbox: ProcessVersion | null;
  production: ProcessVersion | null;
  allVersions: ProcessVersion[];
}> {
  // Verify process belongs to tenant
  const process = await db.process.findFirst({
    where: {
      id: processId,
      tenantId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!process) {
    return { sandbox: null, production: null, allVersions: [] };
  }

  const allVersions = await db.processVersion.findMany({
    where: { processId },
    orderBy: { createdAt: "desc" },
  });

  // Find active version for each environment
  const sandboxVersion = allVersions.find(
    (v) =>
      v.environment === ("SANDBOX" as Environment) &&
      v.deprecatedAt === null &&
      (v.status === ("ACTIVE" as VersionStatus) || v.status === ("DRAFT" as VersionStatus))
  );

  const productionVersion = allVersions.find(
    (v) =>
      v.environment === ("PRODUCTION" as Environment) &&
      v.deprecatedAt === null &&
      v.status === ("ACTIVE" as VersionStatus)
  );

  return {
    sandbox: sandboxVersion ?? null,
    production: productionVersion ?? null,
    allVersions,
  };
}
