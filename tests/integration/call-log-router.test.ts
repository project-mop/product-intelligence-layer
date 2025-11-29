/**
 * CallLog Router Integration Tests
 *
 * Story 6.1: Call Logging Infrastructure
 *
 * Tests the callLog tRPC router with a real database.
 * Verifies filtering, pagination, tenant isolation, and statistics.
 *
 * @module tests/integration/call-log-router.test
 * @see docs/stories/6-1-call-logging-infrastructure.md
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
  processFactory,
  processVersionFactory,
  callLogFactory,
} from "../support/factories";

describe("Story 6.1: Call Log Router Integration Tests", () => {
  describe("callLog.list", () => {
    it("AC 13, 14: should return empty result when no call logs exist", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.callLog.list({});

      expect(result.logs).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });

    it("AC 1-14: should return call logs for the tenant", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const version = await processVersionFactory.create({
        processId: process.id,
      });

      await callLogFactory.create({
        tenantId: tenant.id,
        processId: process.id,
        processVersionId: version.id,
      });
      await callLogFactory.create({
        tenantId: tenant.id,
        processId: process.id,
        processVersionId: version.id,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.callLog.list({});

      expect(result.logs).toHaveLength(2);
    });

    it("AC 3: should not return call logs from other tenants (tenant isolation)", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create();

      const process1 = await processFactory.create({ tenantId: tenant1.id });
      const version1 = await processVersionFactory.create({
        processId: process1.id,
      });
      const process2 = await processFactory.create({ tenantId: tenant2.id });
      const version2 = await processVersionFactory.create({
        processId: process2.id,
      });

      await callLogFactory.create({
        tenantId: tenant1.id,
        processId: process1.id,
        processVersionId: version1.id,
        statusCode: 200,
      });
      await callLogFactory.create({
        tenantId: tenant2.id,
        processId: process2.id,
        processVersionId: version2.id,
        statusCode: 201,
      });

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      const result = await caller.callLog.list({});

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]?.statusCode).toBe(200);
    });

    it("should reject unauthenticated requests", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.callLog.list({})).rejects.toThrow(TRPCError);
    });

    describe("filtering", () => {
      it("AC 4, 13: should filter by processId", async () => {
        const { user, tenant } = await userFactory.createWithTenant();
        const process1 = await processFactory.create({ tenantId: tenant.id });
        const process2 = await processFactory.create({ tenantId: tenant.id });
        const version1 = await processVersionFactory.create({
          processId: process1.id,
        });
        const version2 = await processVersionFactory.create({
          processId: process2.id,
        });

        await callLogFactory.create({
          tenantId: tenant.id,
          processId: process1.id,
          processVersionId: version1.id,
        });
        await callLogFactory.create({
          tenantId: tenant.id,
          processId: process2.id,
          processVersionId: version2.id,
        });

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.callLog.list({
          processId: process1.id,
        });

        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]?.processId).toBe(process1.id);
      });

      it("AC 8: should filter by statusCode", async () => {
        const { user, tenant } = await userFactory.createWithTenant();
        const process = await processFactory.create({ tenantId: tenant.id });
        const version = await processVersionFactory.create({
          processId: process.id,
        });

        await callLogFactory.create({
          tenantId: tenant.id,
          processId: process.id,
          processVersionId: version.id,
          statusCode: 200,
        });
        await callLogFactory.create({
          tenantId: tenant.id,
          processId: process.id,
          processVersionId: version.id,
          statusCode: 400,
        });
        await callLogFactory.create({
          tenantId: tenant.id,
          processId: process.id,
          processVersionId: version.id,
          statusCode: 200,
        });

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.callLog.list({
          statusCode: 200,
        });

        expect(result.logs).toHaveLength(2);
        result.logs.forEach((log) => {
          expect(log.statusCode).toBe(200);
        });
      });

      it("AC 2, 13: should filter by date range", async () => {
        const { user, tenant } = await userFactory.createWithTenant();
        const process = await processFactory.create({ tenantId: tenant.id });
        const version = await processVersionFactory.create({
          processId: process.id,
        });

        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

        await callLogFactory.create({
          tenantId: tenant.id,
          processId: process.id,
          processVersionId: version.id,
          createdAt: twoDaysAgo,
        });
        await callLogFactory.create({
          tenantId: tenant.id,
          processId: process.id,
          processVersionId: version.id,
          createdAt: now,
        });

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.callLog.list({
          startDate: yesterday,
        });

        expect(result.logs).toHaveLength(1);
      });
    });

    describe("pagination", () => {
      it("AC 13, 14: should support cursor-based pagination", async () => {
        const { user, tenant } = await userFactory.createWithTenant();
        const process = await processFactory.create({ tenantId: tenant.id });
        const version = await processVersionFactory.create({
          processId: process.id,
        });

        // Create 5 logs
        await callLogFactory.createMany(
          {
            tenantId: tenant.id,
            processId: process.id,
            processVersionId: version.id,
          },
          5
        );

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        // First page with limit 2
        const page1 = await caller.callLog.list({ limit: 2 });
        expect(page1.logs).toHaveLength(2);
        expect(page1.nextCursor).toBeDefined();

        // Second page
        const page2 = await caller.callLog.list({
          limit: 2,
          cursor: page1.nextCursor,
        });
        expect(page2.logs).toHaveLength(2);
        expect(page2.nextCursor).toBeDefined();

        // Third page (should have 1 item left)
        const page3 = await caller.callLog.list({
          limit: 2,
          cursor: page2.nextCursor,
        });
        expect(page3.logs).toHaveLength(1);
        expect(page3.nextCursor).toBeUndefined();
      });

      it("should return logs in descending order by createdAt", async () => {
        const { user, tenant } = await userFactory.createWithTenant();
        const process = await processFactory.create({ tenantId: tenant.id });
        const version = await processVersionFactory.create({
          processId: process.id,
        });

        const older = new Date("2025-01-01");
        const newer = new Date("2025-01-02");

        await callLogFactory.create({
          tenantId: tenant.id,
          processId: process.id,
          processVersionId: version.id,
          createdAt: older,
        });
        await callLogFactory.create({
          tenantId: tenant.id,
          processId: process.id,
          processVersionId: version.id,
          createdAt: newer,
        });

        const caller = createAuthenticatedCaller({
          userId: user.id,
          tenantId: tenant.id,
        });

        const result = await caller.callLog.list({});

        expect(result.logs[0]?.createdAt.getTime()).toBeGreaterThan(
          result.logs[1]!.createdAt.getTime()
        );
      });
    });
  });

  describe("callLog.get", () => {
    it("AC 14: should return single log with all fields", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const version = await processVersionFactory.create({
        processId: process.id,
      });

      const log = await callLogFactory.create({
        tenantId: tenant.id,
        processId: process.id,
        processVersionId: version.id,
        input: { query: "test" },
        output: { result: "success" },
        statusCode: 200,
        latencyMs: 150,
        modelUsed: "claude-3-haiku-20240307",
        cached: false,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.callLog.get({ id: log.id });

      expect(result.id).toBe(log.id);
      expect(result.tenantId).toBe(tenant.id);
      expect(result.processId).toBe(process.id);
      expect(result.processVersionId).toBe(version.id);
      expect(result.input).toEqual({ query: "test" });
      expect(result.output).toEqual({ result: "success" });
      expect(result.statusCode).toBe(200);
      expect(result.latencyMs).toBe(150);
      expect(result.modelUsed).toBe("claude-3-haiku-20240307");
      expect(result.cached).toBe(false);
    });

    it("AC 3: should return NOT_FOUND for other tenant's logs", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create();

      const process2 = await processFactory.create({ tenantId: tenant2.id });
      const version2 = await processVersionFactory.create({
        processId: process2.id,
      });

      const log = await callLogFactory.create({
        tenantId: tenant2.id,
        processId: process2.id,
        processVersionId: version2.id,
      });

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(caller.callLog.get({ id: log.id })).rejects.toThrow(
        "Call log not found"
      );
    });

    it("should return NOT_FOUND for non-existent log", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.callLog.get({ id: "req_nonexistent1234" })
      ).rejects.toThrow("Call log not found");
    });
  });

  describe("callLog.stats", () => {
    it("AC 13, 14: should return aggregated statistics by status code", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const version = await processVersionFactory.create({
        processId: process.id,
      });

      // Create logs with different status codes
      await callLogFactory.create({
        tenantId: tenant.id,
        processId: process.id,
        processVersionId: version.id,
        statusCode: 200,
        latencyMs: 100,
      });
      await callLogFactory.create({
        tenantId: tenant.id,
        processId: process.id,
        processVersionId: version.id,
        statusCode: 200,
        latencyMs: 200,
      });
      await callLogFactory.createError({
        tenantId: tenant.id,
        processId: process.id,
        processVersionId: version.id,
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        latencyMs: 50,
      });
      await callLogFactory.createError({
        tenantId: tenant.id,
        processId: process.id,
        processVersionId: version.id,
        statusCode: 500,
        errorCode: "INTERNAL_ERROR",
        latencyMs: 10,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.callLog.stats({
        processId: process.id,
        days: 7,
      });

      // Check byStatusCode
      expect(result.byStatusCode).toHaveLength(3);

      const status200 = result.byStatusCode.find((s) => s.statusCode === 200);
      expect(status200?.count).toBe(2);
      expect(status200?.avgLatencyMs).toBe(150); // (100 + 200) / 2

      const status400 = result.byStatusCode.find((s) => s.statusCode === 400);
      expect(status400?.count).toBe(1);

      // Check totals
      expect(result.totals.total).toBe(4);
      expect(result.totals.success).toBe(2);
      expect(result.totals.error).toBe(2);
      expect(result.totals.successRate).toBe(50);
    });

    it("AC 3: should only include logs from the specified tenant", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create();

      const process1 = await processFactory.create({ tenantId: tenant1.id });
      const version1 = await processVersionFactory.create({
        processId: process1.id,
      });
      const process2 = await processFactory.create({ tenantId: tenant2.id });
      const version2 = await processVersionFactory.create({
        processId: process2.id,
      });

      // Create logs for both tenants
      await callLogFactory.create({
        tenantId: tenant1.id,
        processId: process1.id,
        processVersionId: version1.id,
        statusCode: 200,
      });
      await callLogFactory.createMany(
        {
          tenantId: tenant2.id,
          processId: process2.id,
          processVersionId: version2.id,
          statusCode: 200,
        },
        10
      );

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      const result = await caller.callLog.stats({
        processId: process1.id,
        days: 7,
      });

      // Should only count tenant1's log
      expect(result.totals.total).toBe(1);
    });

    it("should return empty stats when no logs exist", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.callLog.stats({
        processId: process.id,
        days: 7,
      });

      expect(result.byStatusCode).toEqual([]);
      expect(result.totals.total).toBe(0);
      expect(result.totals.success).toBe(0);
      expect(result.totals.error).toBe(0);
      expect(result.totals.successRate).toBe(0);
    });
  });
});
