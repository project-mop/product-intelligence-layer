/**
 * Database Isolation Integration Test
 *
 * POC test demonstrating that the test database infrastructure provides
 * proper isolation between tests. This verifies:
 * 1. Database is reset before each test (no state leakage)
 * 2. Multiple tests don't interfere with each other
 * 3. Factory-created data persists within a test
 * 4. Truncation works correctly for all tables
 *
 * @module tests/integration/database-isolation.test
 */

import { describe, expect, it } from "vitest";
import { testDb, getTableRowCount } from "../support/db";
import {
  generateTenantId,
  generateUserId,
  generateAuditId,
} from "~/lib/id";

describe("Database Isolation", () => {
  describe("Table Cleanup", () => {
    it("should start with empty Tenant table", async () => {
      const count = await getTableRowCount("Tenant");
      expect(count).toBe(0);
    });

    it("should start with empty User table", async () => {
      const count = await getTableRowCount("User");
      expect(count).toBe(0);
    });

    it("should start with empty AuditLog table", async () => {
      const count = await getTableRowCount("AuditLog");
      expect(count).toBe(0);
    });
  });

  describe("Test Isolation Between Tests", () => {
    it("should create a tenant that persists within the test", async () => {
      const tenantId = generateTenantId();
      const tenant = await testDb.tenant.create({
        data: {
          id: tenantId,
          name: "Test Tenant 1",
        },
      });

      expect(tenant.id).toBe(tenantId);
      expect(tenant.name).toBe("Test Tenant 1");

      // Verify it's in the database
      const found = await testDb.tenant.findUnique({
        where: { id: tenantId },
      });
      expect(found).not.toBeNull();
      expect(found?.name).toBe("Test Tenant 1");

      // Count should be 1
      const count = await getTableRowCount("Tenant");
      expect(count).toBe(1);
    });

    it("should NOT see data from previous test (isolation verification)", async () => {
      // This test runs AFTER the previous one that created "Test Tenant 1"
      // The database should be reset, so we should have 0 tenants
      const count = await getTableRowCount("Tenant");
      expect(count).toBe(0);

      // Create a different tenant
      const tenantId = generateTenantId();
      await testDb.tenant.create({
        data: {
          id: tenantId,
          name: "Test Tenant 2",
        },
      });

      // Now count should be 1, not 2
      const newCount = await getTableRowCount("Tenant");
      expect(newCount).toBe(1);

      // Verify the tenant name is from THIS test, not the previous
      const tenants = await testDb.tenant.findMany();
      expect(tenants).toHaveLength(1);
      expect(tenants[0]?.name).toBe("Test Tenant 2");
    });

    it("third test also starts fresh", async () => {
      // Triple-check isolation with a third test
      const count = await getTableRowCount("Tenant");
      expect(count).toBe(0);
    });
  });

  describe("Related Entity Creation", () => {
    it("should create tenant with user relationship", async () => {
      const tenantId = generateTenantId();
      const userId = generateUserId();

      // Create tenant first
      await testDb.tenant.create({
        data: {
          id: tenantId,
          name: "Tenant With User",
        },
      });

      // Create user linked to tenant
      const user = await testDb.user.create({
        data: {
          id: userId,
          tenantId: tenantId,
          email: "test@example.com",
          name: "Test User",
        },
      });

      expect(user.tenantId).toBe(tenantId);

      // Verify relationship works
      const tenantWithUsers = await testDb.tenant.findUnique({
        where: { id: tenantId },
        include: { users: true },
      });

      expect(tenantWithUsers?.users).toHaveLength(1);
      expect(tenantWithUsers?.users[0]?.email).toBe("test@example.com");
    });

    it("should create audit log for tenant", async () => {
      const tenantId = generateTenantId();
      const auditId = generateAuditId();

      // Create tenant first
      await testDb.tenant.create({
        data: {
          id: tenantId,
          name: "Tenant For Audit",
        },
      });

      // Create audit log
      const auditLog = await testDb.auditLog.create({
        data: {
          id: auditId,
          tenantId: tenantId,
          action: "tenant.created",
          resource: "tenant",
          resourceId: tenantId,
          metadata: { test: true },
        },
      });

      expect(auditLog.action).toBe("tenant.created");
      expect(auditLog.tenantId).toBe(tenantId);

      // Verify count
      const count = await getTableRowCount("AuditLog");
      expect(count).toBe(1);
    });
  });

  describe("Cascade Truncation", () => {
    it("should handle cascade relationships correctly", async () => {
      const tenantId = generateTenantId();
      const userId = generateUserId();
      const auditId = generateAuditId();

      // Create a full entity graph
      await testDb.tenant.create({
        data: {
          id: tenantId,
          name: "Cascade Test Tenant",
          users: {
            create: {
              id: userId,
              email: "cascade@test.com",
              name: "Cascade User",
            },
          },
          auditLogs: {
            create: {
              id: auditId,
              action: "test.cascade",
              resource: "test",
            },
          },
        },
      });

      // Verify everything was created
      expect(await getTableRowCount("Tenant")).toBe(1);
      expect(await getTableRowCount("User")).toBe(1);
      expect(await getTableRowCount("AuditLog")).toBe(1);

      // The next test should verify these are all cleaned up
    });

    it("should have all related tables empty after cleanup", async () => {
      // After the cascade test, everything should be cleaned
      expect(await getTableRowCount("Tenant")).toBe(0);
      expect(await getTableRowCount("User")).toBe(0);
      expect(await getTableRowCount("AuditLog")).toBe(0);
    });
  });
});

describe("Database Query Operations", () => {
  it("should support Prisma query operations", async () => {
    const tenantId = generateTenantId();

    // Create
    const created = await testDb.tenant.create({
      data: { id: tenantId, name: "Query Test" },
    });
    expect(created.id).toBe(tenantId);

    // Read
    const found = await testDb.tenant.findUnique({
      where: { id: tenantId },
    });
    expect(found?.name).toBe("Query Test");

    // Update
    const updated = await testDb.tenant.update({
      where: { id: tenantId },
      data: { name: "Updated Query Test" },
    });
    expect(updated.name).toBe("Updated Query Test");

    // Delete
    await testDb.tenant.delete({
      where: { id: tenantId },
    });

    const deleted = await testDb.tenant.findUnique({
      where: { id: tenantId },
    });
    expect(deleted).toBeNull();
  });

  it("should support findMany with filters", async () => {
    // Create multiple tenants
    await testDb.tenant.createMany({
      data: [
        { id: generateTenantId(), name: "Alpha Corp" },
        { id: generateTenantId(), name: "Beta Inc" },
        { id: generateTenantId(), name: "Alpha Labs" },
      ],
    });

    // Filter by name pattern
    const alphaCompanies = await testDb.tenant.findMany({
      where: { name: { startsWith: "Alpha" } },
      orderBy: { name: "asc" },
    });

    expect(alphaCompanies).toHaveLength(2);
    expect(alphaCompanies[0]?.name).toBe("Alpha Corp");
    expect(alphaCompanies[1]?.name).toBe("Alpha Labs");
  });
});
