/**
 * Promotion Service
 *
 * Handles promotion of process versions from sandbox to production.
 * Implements atomic transaction for version promotion with cache invalidation.
 *
 * @see docs/stories/5-3-promote-to-production.md
 */

import { TRPCError } from "@trpc/server";
import type { ProcessVersion, Prisma } from "../../../../generated/prisma";
import { db } from "~/server/db";
import { generateProcessVersionId, generateAuditId } from "~/lib/id";

/**
 * Input for promoting a version to production
 */
export interface PromoteToProductionInput {
  processId: string;
  versionId: string;
  changeNotes?: string;
}

/**
 * Context for promotion operation
 */
export interface PromotionContext {
  tenantId: string;
  userId: string;
}

/**
 * Result of a successful promotion
 */
export interface PromoteToProductionResult {
  promotedVersion: ProcessVersion;
  deprecatedVersion: ProcessVersion | null;
  cacheInvalidated: number;
}

/**
 * Preview information for promotion confirmation dialog
 */
export interface PromotionPreview {
  sourceVersion: ProcessVersion;
  currentProductionVersion: ProcessVersion | null;
  cacheEntryCount: number;
}

/**
 * Promotes a sandbox version to production.
 *
 * This operation:
 * 1. Validates the source version is SANDBOX and ACTIVE
 * 2. Deprecates any existing production version
 * 3. Creates a new production version with config copied from source
 * 4. Invalidates all cache entries for the process
 * 5. Creates an audit log entry
 *
 * All operations are performed atomically in a single transaction.
 *
 * @param input - Promotion input containing processId, versionId, and optional changeNotes
 * @param ctx - Context containing tenantId and userId
 * @returns PromoteToProductionResult with promoted version, deprecated version, and cache count
 * @throws TRPCError if validation fails
 */
export async function promoteToProduction(
  input: PromoteToProductionInput,
  ctx: PromotionContext
): Promise<PromoteToProductionResult> {
  const { processId, versionId, changeNotes } = input;

  return db.$transaction(async (tx) => {
    // 1. Validate source version exists and belongs to tenant
    const sourceVersion = await tx.processVersion.findFirst({
      where: {
        id: versionId,
        processId,
        process: { tenantId: ctx.tenantId, deletedAt: null },
      },
      include: {
        process: {
          select: { tenantId: true },
        },
      },
    });

    if (!sourceVersion) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Version not found",
      });
    }

    // 2. Validate source is SANDBOX environment
    if (sourceVersion.environment !== "SANDBOX") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Can only promote SANDBOX versions",
      });
    }

    // 3. Validate source has ACTIVE status
    if (sourceVersion.status !== "ACTIVE") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Can only promote ACTIVE versions",
      });
    }

    // 4. Find and deprecate current production version (if exists)
    const currentProduction = await tx.processVersion.findFirst({
      where: {
        processId,
        environment: "PRODUCTION",
        status: "ACTIVE",
      },
    });

    let deprecatedVersion: ProcessVersion | null = null;
    if (currentProduction) {
      deprecatedVersion = await tx.processVersion.update({
        where: { id: currentProduction.id },
        data: {
          status: "DEPRECATED",
          deprecatedAt: new Date(),
        },
      });
    }

    // 5. Calculate next version number
    // Version strings are semantic versions like "1.0.0"
    // Extract major version and increment
    const allVersions = await tx.processVersion.findMany({
      where: { processId },
      select: { version: true },
    });

    const maxMajorVersion = allVersions.reduce((max, v) => {
      const major = parseInt(v.version.split(".")[0] ?? "0", 10);
      return Math.max(max, isNaN(major) ? 0 : major);
    }, 0);

    const nextVersionNumber = maxMajorVersion + 1;
    const nextVersionString = `${nextVersionNumber}.0.0`;

    // 6. Create new production version
    const promotedVersion = await tx.processVersion.create({
      data: {
        id: generateProcessVersionId(),
        processId,
        version: nextVersionString,
        config: sourceVersion.config as Prisma.InputJsonValue,
        environment: "PRODUCTION",
        status: "ACTIVE",
        publishedAt: new Date(),
        changeNotes,
        promotedBy: ctx.userId,
      },
    });

    // 7. Invalidate cache entries for this process
    const cacheResult = await tx.responseCache.deleteMany({
      where: { processId },
    });

    // 8. Create audit log entry
    await tx.auditLog.create({
      data: {
        id: generateAuditId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: "processVersion.promoted",
        resource: "processVersion",
        resourceId: promotedVersion.id,
        metadata: {
          processId,
          fromVersionId: sourceVersion.id,
          fromVersion: sourceVersion.version,
          toVersion: nextVersionString,
          deprecatedVersionId: deprecatedVersion?.id ?? null,
          changeNotes: changeNotes ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      promotedVersion,
      deprecatedVersion,
      cacheInvalidated: cacheResult.count,
    };
  });
}

/**
 * Gets a preview of what promotion will do.
 *
 * Used by the confirmation dialog to show:
 * - Source version details
 * - Current production version (if any)
 * - Number of cache entries that will be invalidated
 *
 * @param processId - The process ID
 * @param versionId - The source version ID to promote
 * @param ctx - Context containing tenantId
 * @returns PromotionPreview with source, current production, and cache count
 * @throws TRPCError if validation fails
 */
export async function getPromotionPreview(
  processId: string,
  versionId: string,
  ctx: { tenantId: string }
): Promise<PromotionPreview> {
  // Get source version with tenant validation
  const sourceVersion = await db.processVersion.findFirst({
    where: {
      id: versionId,
      processId,
      process: { tenantId: ctx.tenantId, deletedAt: null },
    },
  });

  if (!sourceVersion) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Version not found",
    });
  }

  if (sourceVersion.environment !== "SANDBOX") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Can only promote SANDBOX versions",
    });
  }

  if (sourceVersion.status !== "ACTIVE") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Can only promote ACTIVE versions",
    });
  }

  // Get current production version (if any)
  const currentProductionVersion = await db.processVersion.findFirst({
    where: {
      processId,
      environment: "PRODUCTION",
      status: "ACTIVE",
    },
  });

  // Count cache entries that will be invalidated
  const cacheEntryCount = await db.responseCache.count({
    where: { processId },
  });

  return {
    sourceVersion,
    currentProductionVersion,
    cacheEntryCount,
  };
}
