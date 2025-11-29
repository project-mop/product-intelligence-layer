/**
 * Rollback Service
 *
 * Handles rolling back to previous process versions.
 * Creates a NEW sandbox version with config copied from target version.
 * Version history is immutable - rollback never modifies existing versions.
 *
 * @see docs/stories/5-4-version-history-and-rollback.md
 */

import { TRPCError } from "@trpc/server";
import type { ProcessVersion, Prisma } from "../../../../generated/prisma";
import { db } from "~/server/db";
import { generateProcessVersionId, generateAuditId } from "~/lib/id";

/**
 * Input for rolling back to a previous version
 */
export interface RollbackInput {
  processId: string;
  targetVersionId: string;
  changeNotes?: string;
}

/**
 * Context for rollback operation
 */
export interface RollbackContext {
  tenantId: string;
  userId: string;
}

/**
 * Result of a successful rollback
 */
export interface RollbackResult {
  newVersion: ProcessVersion;
  sourceVersion: ProcessVersion;
  deprecatedVersion: ProcessVersion | null;
}

/**
 * Rolls back to a previous version by creating a new sandbox version.
 *
 * This operation:
 * 1. Validates the target version exists and belongs to tenant
 * 2. Deprecates any existing active sandbox version
 * 3. Creates a new sandbox version with config copied from target
 * 4. Creates an audit log entry
 *
 * All operations are performed atomically in a single transaction.
 *
 * Key invariants:
 * - Version numbers are monotonically increasing (never reused)
 * - Target version is NOT modified (immutable history)
 * - New version always goes to SANDBOX environment
 *
 * @param input - Rollback input containing processId, targetVersionId, and optional changeNotes
 * @param ctx - Context containing tenantId and userId
 * @returns RollbackResult with new version, source version, and deprecated version
 * @throws TRPCError if validation fails
 */
export async function rollbackToVersion(
  input: RollbackInput,
  ctx: RollbackContext
): Promise<RollbackResult> {
  const { processId, targetVersionId, changeNotes } = input;

  return db.$transaction(async (tx) => {
    // 1. Validate target version exists and belongs to tenant
    const targetVersion = await tx.processVersion.findFirst({
      where: {
        id: targetVersionId,
        processId,
        process: { tenantId: ctx.tenantId, deletedAt: null },
      },
    });

    if (!targetVersion) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Version not found",
      });
    }

    // 2. Find and deprecate current active sandbox version (if any)
    const currentSandbox = await tx.processVersion.findFirst({
      where: {
        processId,
        environment: "SANDBOX",
        status: "ACTIVE",
      },
    });

    let deprecatedVersion: ProcessVersion | null = null;

    // Don't deprecate if we're rolling back to the current sandbox version
    if (currentSandbox && currentSandbox.id === targetVersionId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot rollback to the current active sandbox version",
      });
    }

    if (currentSandbox) {
      deprecatedVersion = await tx.processVersion.update({
        where: { id: currentSandbox.id },
        data: {
          status: "DEPRECATED",
          deprecatedAt: new Date(),
        },
      });
    }

    // 3. Calculate next version number (semantic versioning)
    // Extract major version numbers and find the max
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

    // 4. Create new sandbox version from target
    const newVersionId = generateProcessVersionId();
    const defaultChangeNotes = `Restored from version ${targetVersion.version}`;

    const newVersion = await tx.processVersion.create({
      data: {
        id: newVersionId,
        processId,
        version: nextVersionString,
        config: targetVersion.config as Prisma.InputJsonValue,
        environment: "SANDBOX",
        status: "ACTIVE",
        publishedAt: new Date(),
        changeNotes: changeNotes ?? defaultChangeNotes,
        promotedBy: ctx.userId,
      },
    });

    // 5. Create audit log entry
    await tx.auditLog.create({
      data: {
        id: generateAuditId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: "processVersion.rollback",
        resource: "processVersion",
        resourceId: newVersion.id,
        metadata: {
          processId,
          sourceVersionId: targetVersion.id,
          sourceVersion: targetVersion.version,
          newVersion: nextVersionString,
          deprecatedVersionId: deprecatedVersion?.id ?? null,
          changeNotes: newVersion.changeNotes,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      newVersion,
      sourceVersion: targetVersion,
      deprecatedVersion,
    };
  });
}
