/**
 * Audit Logging Service
 *
 * Provides append-only audit logging for significant tenant actions.
 * Immutable by design: only createAuditLog is exposed, no update/delete.
 *
 * @see docs/stories/1-5-audit-logging-foundation.md
 */

import { db } from "~/server/db";
import { generateAuditId } from "~/lib/id";
import type { AuditLog, Prisma } from "../../../../generated/prisma";

/**
 * Parameters for creating an audit log entry
 */
export interface CreateAuditLogParams {
  tenantId: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Creates an immutable audit log entry.
 *
 * This is the ONLY method exposed by the audit service to enforce
 * append-only semantics. No update or delete operations are available.
 *
 * @param params - Audit log parameters
 * @returns The created audit log entry
 *
 * @example
 * await createAuditLog({
 *   tenantId: "ten_abc123",
 *   userId: "usr_xyz789",
 *   action: "user.created",
 *   resource: "user",
 *   resourceId: "usr_xyz789",
 *   ipAddress: "192.168.1.1",
 *   userAgent: "Mozilla/5.0..."
 * });
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<AuditLog> {
  const auditLog = await db.auditLog.create({
    data: {
      id: generateAuditId(),
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  return auditLog;
}
