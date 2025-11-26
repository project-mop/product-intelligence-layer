/**
 * AuditLog Router Integration Tests
 *
 * Tests the auditLog tRPC router with a real database.
 * Verifies filtering, pagination, and tenant isolation.
 *
 * @module tests/integration/audit-log-router.test
 */

import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  createAuthenticatedCaller,
  createUnauthenticatedCaller,
} from "../support/trpc";
import {
  tenantFactory,
  userFactory,
  auditLogFactory,
  AUDIT_ACTIONS,
} from "../support/factories";

describe("auditLog Router", () => {
  describe("list", () => {
    it("should return empty result when no audit logs exist", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.auditLog.list({});

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should return audit logs for the tenant", async () => {
      const { user, tenant } = await userFactory.createWithTenant();

      await auditLogFactory.create({
        tenantId: tenant.id,
        action: AUDIT_ACTIONS.USER_CREATED,
        resource: "user",
      });
      await auditLogFactory.create({
        tenantId: tenant.id,
        action: AUDIT_ACTIONS.API_KEY_CREATED,
        resource: "apiKey",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.auditLog.list({});

      expect(result.items).toHaveLength(2);
    });

    it("should not return audit logs from other tenants (isolation)", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create();

      await auditLogFactory.create({
        tenantId: tenant1.id,
        action: "tenant1.action",
      });
      await auditLogFactory.create({
        tenantId: tenant2.id,
        action: "tenant2.action",
      });

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      const result = await caller.auditLog.list({});

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.action).toBe("tenant1.action");
    });

    it("should reject unauthenticated requests", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.auditLog.list({})).rejects.toThrow(TRPCError);
    });

    describe("filtering", () => {
      it("should filter by action", async () => {
        const { user, tenant } = await userFactory.createWithTenant();

        await auditLogFactory.create({
          tenantId: tenant.id,
          action: AUDIT_ACTIONS.USER_CREATED,
        });
        await auditLogFactory.create({
          tenantId: tenant.id,
          action: AUDIT_ACTIONS.API_KEY_CREATED,
        });
        await auditLogFactory.create({
          tenantId: tenant.id,
          action: AUDIT_ACTIONS.USER_CREATED,
        });

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.auditLog.list({
          action: AUDIT_ACTIONS.USER_CREATED,
        });

        expect(result.items).toHaveLength(2);
        result.items.forEach((item) => {
          expect(item.action).toBe(AUDIT_ACTIONS.USER_CREATED);
        });
      });

      it("should filter by dateFrom", async () => {
        const { user, tenant } = await userFactory.createWithTenant();

        const oldDate = new Date("2024-01-01");
        const recentDate = new Date("2024-06-15");

        await auditLogFactory.create({
          tenantId: tenant.id,
          action: "old.action",
          createdAt: oldDate,
        });
        await auditLogFactory.create({
          tenantId: tenant.id,
          action: "recent.action",
          createdAt: recentDate,
        });

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.auditLog.list({
          dateFrom: new Date("2024-06-01"),
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.action).toBe("recent.action");
      });

      it("should filter by dateTo", async () => {
        const { user, tenant } = await userFactory.createWithTenant();

        const oldDate = new Date("2024-01-15");
        const recentDate = new Date("2024-06-15");

        await auditLogFactory.create({
          tenantId: tenant.id,
          action: "old.action",
          createdAt: oldDate,
        });
        await auditLogFactory.create({
          tenantId: tenant.id,
          action: "recent.action",
          createdAt: recentDate,
        });

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.auditLog.list({
          dateTo: new Date("2024-03-01"),
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.action).toBe("old.action");
      });

      it("should filter by date range", async () => {
        const { user, tenant } = await userFactory.createWithTenant();

        await auditLogFactory.create({
          tenantId: tenant.id,
          action: "jan.action",
          createdAt: new Date("2024-01-15"),
        });
        await auditLogFactory.create({
          tenantId: tenant.id,
          action: "march.action",
          createdAt: new Date("2024-03-15"),
        });
        await auditLogFactory.create({
          tenantId: tenant.id,
          action: "june.action",
          createdAt: new Date("2024-06-15"),
        });

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.auditLog.list({
          dateFrom: new Date("2024-02-01"),
          dateTo: new Date("2024-05-01"),
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.action).toBe("march.action");
      });

      it("should combine action and date filters", async () => {
        const { user, tenant } = await userFactory.createWithTenant();

        await auditLogFactory.create({
          tenantId: tenant.id,
          action: AUDIT_ACTIONS.USER_CREATED,
          createdAt: new Date("2024-01-15"),
        });
        await auditLogFactory.create({
          tenantId: tenant.id,
          action: AUDIT_ACTIONS.USER_CREATED,
          createdAt: new Date("2024-06-15"),
        });
        await auditLogFactory.create({
          tenantId: tenant.id,
          action: AUDIT_ACTIONS.API_KEY_CREATED,
          createdAt: new Date("2024-06-15"),
        });

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.auditLog.list({
          action: AUDIT_ACTIONS.USER_CREATED,
          dateFrom: new Date("2024-06-01"),
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.action).toBe(AUDIT_ACTIONS.USER_CREATED);
      });
    });

    describe("pagination", () => {
      it("should respect limit parameter", async () => {
        const { user, tenant } = await userFactory.createWithTenant();

        // Create 5 audit logs
        for (let i = 0; i < 5; i++) {
          await auditLogFactory.create({
            tenantId: tenant.id,
            action: `action.${i}`,
          });
        }

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.auditLog.list({ limit: 3 });

        expect(result.items).toHaveLength(3);
        expect(result.nextCursor).toBeDefined();
      });

      it("should use default limit of 50", async () => {
        const { user, tenant } = await userFactory.createWithTenant();

        // Create 60 audit logs
        for (let i = 0; i < 60; i++) {
          await auditLogFactory.create({
            tenantId: tenant.id,
            action: `action.${i}`,
          });
        }

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.auditLog.list({});

        expect(result.items).toHaveLength(50);
        expect(result.nextCursor).toBeDefined();
      });

      it("should return nextCursor when more results exist", async () => {
        const { user, tenant } = await userFactory.createWithTenant();

        for (let i = 0; i < 10; i++) {
          await auditLogFactory.create({
            tenantId: tenant.id,
            action: `action.${i}`,
          });
        }

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.auditLog.list({ limit: 5 });

        expect(result.items).toHaveLength(5);
        expect(result.nextCursor).toBeDefined();
      });

      it("should not return nextCursor when no more results", async () => {
        const { user, tenant } = await userFactory.createWithTenant();

        for (let i = 0; i < 3; i++) {
          await auditLogFactory.create({
            tenantId: tenant.id,
            action: `action.${i}`,
          });
        }

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.auditLog.list({ limit: 10 });

        expect(result.items).toHaveLength(3);
        expect(result.nextCursor).toBeUndefined();
      });

      it("should paginate using cursor", async () => {
        const { user, tenant } = await userFactory.createWithTenant();

        // Create 10 logs with different timestamps to ensure order
        for (let i = 9; i >= 0; i--) {
          await auditLogFactory.create({
            tenantId: tenant.id,
            action: `action.${i}`,
            createdAt: new Date(Date.now() - i * 1000), // Most recent first
          });
        }

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        // First page
        const page1 = await caller.auditLog.list({ limit: 4 });
        expect(page1.items).toHaveLength(4);
        expect(page1.nextCursor).toBeDefined();

        // Second page
        const page2 = await caller.auditLog.list({
          limit: 4,
          cursor: page1.nextCursor,
        });
        expect(page2.items).toHaveLength(4);
        expect(page2.nextCursor).toBeDefined();

        // Third page (should have remaining 2)
        const page3 = await caller.auditLog.list({
          limit: 4,
          cursor: page2.nextCursor,
        });
        expect(page3.items).toHaveLength(2);
        expect(page3.nextCursor).toBeUndefined();

        // Verify no duplicates across pages
        const allIds = [
          ...page1.items.map((i) => i.id),
          ...page2.items.map((i) => i.id),
          ...page3.items.map((i) => i.id),
        ];
        const uniqueIds = new Set(allIds);
        expect(uniqueIds.size).toBe(10);
      });

      it("should enforce maximum limit of 100", async () => {
        const { user, tenant } = await userFactory.createWithTenant();
        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        // Should throw validation error for limit > 100
        await expect(
          caller.auditLog.list({ limit: 150 })
        ).rejects.toThrow();
      });

      it("should enforce minimum limit of 1", async () => {
        const { user, tenant } = await userFactory.createWithTenant();
        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        // Should throw validation error for limit < 1
        await expect(caller.auditLog.list({ limit: 0 })).rejects.toThrow();
      });
    });

    describe("ordering", () => {
      it("should order by createdAt descending (newest first)", async () => {
        const { user, tenant } = await userFactory.createWithTenant();

        const dates = [
          new Date("2024-01-01"),
          new Date("2024-03-01"),
          new Date("2024-02-01"),
        ];

        for (const date of dates) {
          await auditLogFactory.create({
            tenantId: tenant.id,
            action: `action.${date.toISOString()}`,
            createdAt: date,
          });
        }

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.auditLog.list({});

        expect(result.items).toHaveLength(3);
        // Should be ordered newest to oldest
        expect(result.items[0]?.action).toContain("2024-03-01");
        expect(result.items[1]?.action).toContain("2024-02-01");
        expect(result.items[2]?.action).toContain("2024-01-01");
      });
    });

    describe("returned fields", () => {
      it("should return expected fields", async () => {
        const { user, tenant } = await userFactory.createWithTenant();

        await auditLogFactory.create({
          tenantId: tenant.id,
          userId: user.id,
          action: AUDIT_ACTIONS.USER_CREATED,
          resource: "user",
          resourceId: user.id,
          metadata: { key: "value" },
          ipAddress: "192.168.1.1",
          userAgent: "Test Agent",
        });

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.auditLog.list({});

        expect(result.items).toHaveLength(1);
        const item = result.items[0]!;

        expect(item.id).toBeDefined();
        expect(item.userId).toBe(user.id);
        expect(item.action).toBe(AUDIT_ACTIONS.USER_CREATED);
        expect(item.resource).toBe("user");
        expect(item.resourceId).toBe(user.id);
        expect(item.metadata).toEqual({ key: "value" });
        expect(item.ipAddress).toBe("192.168.1.1");
        expect(item.userAgent).toBe("Test Agent");
        expect(item.createdAt).toBeInstanceOf(Date);
      });

      it("should handle null optional fields", async () => {
        const { user, tenant } = await userFactory.createWithTenant();

        await auditLogFactory.create({
          tenantId: tenant.id,
          action: "test.action",
          resource: "test",
          // userId, resourceId, metadata, ipAddress, userAgent all null
        });

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.auditLog.list({});

        expect(result.items).toHaveLength(1);
        const item = result.items[0]!;

        expect(item.userId).toBeNull();
        expect(item.resourceId).toBeNull();
        expect(item.ipAddress).toBeNull();
        expect(item.userAgent).toBeNull();
      });
    });
  });
});
