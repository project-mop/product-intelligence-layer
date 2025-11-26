/**
 * AuditLog Test Factory
 *
 * Generates test data for AuditLog entities.
 * Provides both in-memory (build) and persisted (create) methods.
 *
 * @module tests/support/factories/audit-log.factory
 */

import { Prisma, type AuditLog } from "../../../generated/prisma";
import { generateAuditId, generateTenantId } from "~/lib/id";
import { testDb } from "../db";

let counter = 0;

/** Common audit actions for testing */
export const AUDIT_ACTIONS = {
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",
  USER_LOGIN: "user.login",
  USER_LOGOUT: "user.logout",
  API_KEY_CREATED: "apiKey.created",
  API_KEY_REVOKED: "apiKey.revoked",
  API_KEY_ROTATED: "apiKey.rotated",
  TENANT_CREATED: "tenant.created",
  PROCESS_CREATED: "process.created",
} as const;

/** Common audit resources for testing */
export const AUDIT_RESOURCES = {
  USER: "user",
  API_KEY: "apiKey",
  TENANT: "tenant",
  PROCESS: "process",
} as const;

/**
 * Default audit log data for testing.
 */
const defaultAuditLog = (): Omit<AuditLog, "id" | "tenantId" | "metadata"> & {
  metadata: Prisma.InputJsonValue | null;
} => ({
  userId: null,
  action: `test.action.${++counter}`,
  resource: "test",
  resourceId: null,
  metadata: null,
  ipAddress: null,
  userAgent: null,
  createdAt: new Date(),
});

/** Options for building/creating an audit log */
interface AuditLogFactoryOptions extends Partial<Omit<AuditLog, "metadata">> {
  /** If provided, uses this tenantId. If not, generates a new one. */
  tenantId?: string;
  /** Metadata for the audit log */
  metadata?: Prisma.InputJsonValue | null;
}

/**
 * Builds an audit log object in memory without persisting to database.
 * Useful for unit tests that don't need database interaction.
 *
 * @param overrides - Partial AuditLog fields to override defaults
 * @returns Complete AuditLog object
 *
 * @example
 * ```typescript
 * const auditLog = auditLogFactory.build({
 *   action: "user.created",
 *   resource: "user",
 * });
 * ```
 */
function build(overrides: AuditLogFactoryOptions = {}): AuditLog {
  const defaults = defaultAuditLog();
  return {
    id: overrides.id ?? generateAuditId(),
    tenantId: overrides.tenantId ?? generateTenantId(),
    userId: overrides.userId ?? defaults.userId,
    action: overrides.action ?? defaults.action,
    resource: overrides.resource ?? defaults.resource,
    resourceId: overrides.resourceId ?? defaults.resourceId,
    metadata: (overrides.metadata ?? defaults.metadata) as AuditLog["metadata"],
    ipAddress: overrides.ipAddress ?? defaults.ipAddress,
    userAgent: overrides.userAgent ?? defaults.userAgent,
    createdAt: overrides.createdAt ?? defaults.createdAt,
  };
}

/**
 * Creates an audit log and persists it to the test database.
 * If tenantId is not provided, also creates a tenant.
 *
 * @param overrides - Partial AuditLog fields to override defaults
 * @returns Promise resolving to the created AuditLog
 *
 * @example
 * ```typescript
 * const auditLog = await auditLogFactory.create({
 *   tenantId: tenant.id,
 *   action: "apiKey.created",
 *   resource: "apiKey",
 *   resourceId: apiKey.id,
 * });
 * ```
 */
async function create(overrides: AuditLogFactoryOptions = {}): Promise<AuditLog> {
  // If no tenantId provided, create a tenant first
  let tenantId = overrides.tenantId;
  if (!tenantId) {
    const tenant = await testDb.tenant.create({
      data: {
        id: generateTenantId(),
        name: `Tenant for Audit ${counter + 1}`,
      },
    });
    tenantId = tenant.id;
  }

  const defaults = defaultAuditLog();
  const metadataValue = overrides.metadata ?? defaults.metadata;
  const data: Prisma.AuditLogUncheckedCreateInput = {
    id: overrides.id ?? generateAuditId(),
    tenantId,
    userId: overrides.userId ?? defaults.userId,
    action: overrides.action ?? defaults.action,
    resource: overrides.resource ?? defaults.resource,
    resourceId: overrides.resourceId ?? defaults.resourceId,
    // Prisma requires special handling for null JSON values
    metadata: metadataValue === null ? Prisma.JsonNull : metadataValue,
    ipAddress: overrides.ipAddress ?? defaults.ipAddress,
    userAgent: overrides.userAgent ?? defaults.userAgent,
    createdAt: overrides.createdAt ?? defaults.createdAt,
  };

  return testDb.auditLog.create({ data });
}

/**
 * Creates a user action audit log.
 * Convenience method for common user-related audit entries.
 *
 * @param tenantId - Tenant ID
 * @param userId - User performing the action
 * @param action - Action being performed
 * @param targetUserId - Optional target user ID
 * @returns Promise resolving to the created AuditLog
 */
async function createUserAction(
  tenantId: string,
  userId: string,
  action: string,
  targetUserId?: string
): Promise<AuditLog> {
  return create({
    tenantId,
    userId,
    action,
    resource: AUDIT_RESOURCES.USER,
    resourceId: targetUserId ?? userId,
  });
}

/**
 * Creates an API key audit log.
 * Convenience method for API key-related audit entries.
 *
 * @param tenantId - Tenant ID
 * @param userId - User performing the action
 * @param action - Action being performed
 * @param apiKeyId - API key ID
 * @param metadata - Optional additional metadata
 * @returns Promise resolving to the created AuditLog
 */
async function createApiKeyAction(
  tenantId: string,
  userId: string,
  action: string,
  apiKeyId: string,
  metadata?: Prisma.InputJsonValue
): Promise<AuditLog> {
  return create({
    tenantId,
    userId,
    action,
    resource: AUDIT_RESOURCES.API_KEY,
    resourceId: apiKeyId,
    metadata: metadata ?? null,
  });
}

/**
 * Creates multiple audit logs for the same tenant.
 *
 * @param count - Number of audit logs to create
 * @param tenantId - Tenant ID (creates new tenant if not provided)
 * @returns Promise resolving to array of created AuditLogs
 */
async function createMany(
  count: number,
  tenantId?: string
): Promise<AuditLog[]> {
  // Create tenant if not provided
  let tid = tenantId;
  if (!tid) {
    const tenant = await testDb.tenant.create({
      data: {
        id: generateTenantId(),
        name: `Tenant for ${count} audit logs`,
      },
    });
    tid = tenant.id;
  }

  const logs: AuditLog[] = [];
  for (let i = 0; i < count; i++) {
    logs.push(await create({ tenantId: tid }));
  }
  return logs;
}

/**
 * Resets the internal counter (for test isolation).
 */
function resetCounter(): void {
  counter = 0;
}

export const auditLogFactory = {
  build,
  create,
  createUserAction,
  createApiKeyAction,
  createMany,
  resetCounter,
  ACTIONS: AUDIT_ACTIONS,
  RESOURCES: AUDIT_RESOURCES,
};
