/**
 * Integration Test Setup
 *
 * Setup file for integration tests that require a real database connection.
 * Provides database cleanup and connection management.
 *
 * @module tests/setup.integration
 */

import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import {
  testDb,
  resetDatabase,
  disconnectTestDb,
  isDatabaseAccessible,
} from "./support/db";

// Mock NextAuth before any imports that use it
// This prevents the "Cannot find module 'next/server'" error
vi.mock("~/server/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock the audit service to use testDb instead of production db
// This prevents FK constraint errors from fire-and-forget audit logging
vi.mock("~/server/services/audit", async (importOriginal) => {
  const { testDb } = await import("./support/db");
  const { generateAuditId } = await import("~/lib/id");

  return {
    createAuditLog: vi.fn().mockImplementation(async (params) => {
      // Use testDb for audit logs in integration tests
      return testDb.auditLog.create({
        data: {
          id: generateAuditId(),
          tenantId: params.tenantId,
          userId: params.userId,
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId,
          metadata: params.metadata ?? null,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    }),
  };
});

// Clear mock call history after each test (but preserve mock implementations)
afterEach(() => {
  vi.clearAllMocks();
});

// Verify database is accessible before running tests
beforeAll(async () => {
  const accessible = await isDatabaseAccessible();
  if (!accessible) {
    throw new Error(
      "Test database is not accessible. Ensure PostgreSQL is running and TEST_DATABASE_URL or DATABASE_URL is set correctly.\n" +
        "See docs/database-debt.md for setup instructions."
    );
  }
});

// Reset database before each test for isolation
beforeEach(async () => {
  await resetDatabase();
});

// Clean up connections after all tests
afterAll(async () => {
  await disconnectTestDb();
});

// Export testDb for use in tests
export { testDb };
