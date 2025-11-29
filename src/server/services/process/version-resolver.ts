/**
 * Version Resolver Service
 *
 * Resolves the appropriate ProcessVersion for a given process and environment.
 * Supports version pinning via X-Version header (Story 5.5).
 *
 * @see docs/stories/5-1-sandbox-and-production-modes.md
 * @see docs/stories/5-5-version-pinning-and-deprecation.md
 */

import type { ProcessVersion, Environment, VersionStatus } from "../../../../generated/prisma";
import { db } from "~/server/db";
import { ApiError, ErrorCode, ERROR_HTTP_STATUS } from "~/lib/errors";
import { calculateSunsetDate } from "./sunset";
import { extractVersionNumber } from "./version-utils";

// Re-export for backwards compatibility
export { extractVersionNumber } from "./version-utils";

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
  isPinned: boolean;
  isDeprecated: boolean;
  sunsetDate: Date | null;
  latestVersionNumber: number;
}

/**
 * Error thrown when version pinning fails
 */
export class VersionResolutionError extends ApiError {
  constructor(
    code: ErrorCode,
    message: string,
    availableVersions?: number[],
    extraDetails?: Record<string, unknown>
  ) {
    super(
      code,
      message,
      ERROR_HTTP_STATUS[code],
      availableVersions ? { availableVersions, ...extraDetails } : extraDetails
    );
    this.name = "VersionResolutionError";
  }
}


/**
 * Get available version numbers for a process in a specific environment.
 *
 * @param processId - Process ID
 * @param tenantId - Tenant ID for isolation
 * @param environment - Target environment
 * @returns Array of available version numbers
 */
export async function getAvailableVersions(
  processId: string,
  tenantId: string,
  environment?: "SANDBOX" | "PRODUCTION"
): Promise<{ sandbox: number[]; production: number[] }> {
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
    return { sandbox: [], production: [] };
  }

  const where = environment
    ? { processId, environment: environment as Environment }
    : { processId };

  const versions = await db.processVersion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { version: true, environment: true },
  });

  const sandboxVersions: number[] = [];
  const productionVersions: number[] = [];

  for (const v of versions) {
    const num = extractVersionNumber(v.version);
    if (v.environment === "SANDBOX") {
      sandboxVersions.push(num);
    } else {
      productionVersions.push(num);
    }
  }

  return {
    sandbox: [...new Set(sandboxVersions)].sort((a, b) => b - a),
    production: [...new Set(productionVersions)].sort((a, b) => b - a),
  };
}

/**
 * Resolves the active version for a process in a specific environment.
 *
 * Resolution logic:
 * 1. If pinnedVersion is specified, find that specific version
 *    - Verify version exists (throws VERSION_NOT_FOUND if not)
 *    - Verify version environment matches request (throws VERSION_ENVIRONMENT_MISMATCH if not)
 * 2. Otherwise, find the active (non-deprecated) version for the environment
 * 3. Calculate deprecation status and sunset date
 *
 * @param params - Resolution parameters
 * @returns ResolvedVersion
 * @throws VersionResolutionError if version not found or environment mismatch
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

  // Get all versions for this process
  const allVersions = await db.processVersion.findMany({
    where: { processId },
    orderBy: { createdAt: "desc" },
  });

  if (allVersions.length === 0) {
    return null;
  }

  // Calculate latest version number
  const latestVersionNumber = Math.max(
    ...allVersions.map((v) => extractVersionNumber(v.version))
  );

  // If pinned version is requested (Story 5.5 AC: 1, 7, 8)
  if (pinnedVersion !== undefined) {
    // Find version by integer version number
    const pinnedVersionStr = `${pinnedVersion}.0.0`;
    const pinned = allVersions.find((v) => v.version === pinnedVersionStr);

    if (!pinned) {
      // AC: 7 - Pinning to non-existent version returns 404 with available versions
      const available = await getAvailableVersions(processId, tenantId, environment);
      const availableForEnv = environment === "SANDBOX" ? available.sandbox : available.production;

      throw new VersionResolutionError(
        ErrorCode.VERSION_NOT_FOUND,
        `Version ${pinnedVersion} not found for this process`,
        availableForEnv,
        { requestedVersion: pinnedVersion }
      );
    }

    // AC: 8 - Verify environment matches
    if (pinned.environment !== environment) {
      const available = await getAvailableVersions(processId, tenantId, environment);
      const availableForEnv = environment === "SANDBOX" ? available.sandbox : available.production;

      throw new VersionResolutionError(
        ErrorCode.VERSION_ENVIRONMENT_MISMATCH,
        `Version ${pinnedVersion} is only available in ${pinned.environment.toLowerCase()} environment`,
        availableForEnv,
        {
          requestedVersion: pinnedVersion,
          versionEnvironment: pinned.environment,
          requestEnvironment: environment,
        }
      );
    }

    // AC: 3 - Pinned requests to deprecated versions succeed but include warning headers
    const isDeprecated = pinned.deprecatedAt !== null;
    const sunsetDate = isDeprecated && pinned.deprecatedAt
      ? calculateSunsetDate(pinned.deprecatedAt)
      : null;

    return {
      version: pinned,
      isPinned: true,
      isDeprecated,
      sunsetDate,
      latestVersionNumber,
    };
  }

  // Get versions for the requested environment
  const environmentVersions = allVersions.filter(
    (v) => v.environment === (environment as Environment)
  );

  if (environmentVersions.length === 0) {
    return null;
  }

  // AC: 2 - Without X-Version header, latest ACTIVE version for environment is used
  // Find active (non-deprecated) version
  // Priority: ACTIVE status, then most recently created
  const activeVersion = environmentVersions.find(
    (v) => v.status === ("ACTIVE" as VersionStatus) && v.deprecatedAt === null
  );

  if (activeVersion) {
    return {
      version: activeVersion,
      isPinned: false,
      isDeprecated: false,
      sunsetDate: null,
      latestVersionNumber,
    };
  }

  // Fall back to DRAFT status if no ACTIVE version (for sandbox development)
  if (environment === "SANDBOX") {
    const draftVersion = environmentVersions.find(
      (v) => v.status === ("DRAFT" as VersionStatus) && v.deprecatedAt === null
    );

    if (draftVersion) {
      return {
        version: draftVersion,
        isPinned: false,
        isDeprecated: false,
        sunsetDate: null,
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
