/**
 * Process Router Integration Tests
 *
 * Tests the process tRPC router with a real database.
 * Verifies CRUD operations, tenant isolation, and audit logging.
 *
 * @module tests/integration/process-router.test
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
} from "../support/factories";
import { testDb } from "../support/db";

describe("process Router", () => {
  describe("list", () => {
    it("should return empty array when no processes exist", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.list({});

      expect(result).toEqual([]);
    });

    it("should return all non-deleted processes for the tenant", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      await processFactory.create({ tenantId: tenant.id, name: "Process 1" });
      await processFactory.create({ tenantId: tenant.id, name: "Process 2" });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.list({});

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.name)).toContain("Process 1");
      expect(result.map((p) => p.name)).toContain("Process 2");
    });

    it("should not return processes from other tenants (isolation)", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create({ name: "Other Tenant" });

      await processFactory.create({
        tenantId: tenant1.id,
        name: "Tenant 1 Process",
      });
      await processFactory.create({
        tenantId: tenant2.id,
        name: "Tenant 2 Process",
      });

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      const result = await caller.process.list({});

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Tenant 1 Process");
    });

    it("should not return soft-deleted processes", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      await processFactory.create({ tenantId: tenant.id, name: "Active" });
      await processFactory.create({
        tenantId: tenant.id,
        name: "Deleted",
        deletedAt: new Date(),
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.list({});

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Active");
    });

    it("should filter by status when provided", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const sandboxProcess = await processFactory.create({
        tenantId: tenant.id,
        name: "Sandbox Process",
      });
      const prodProcess = await processFactory.create({
        tenantId: tenant.id,
        name: "Prod Process",
      });

      // Create versions with different environments
      await processVersionFactory.create({
        processId: sandboxProcess.id,
        environment: "SANDBOX",
      });
      await processVersionFactory.create({
        processId: prodProcess.id,
        environment: "PRODUCTION",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const sandboxResult = await caller.process.list({ status: "SANDBOX" });
      const prodResult = await caller.process.list({ status: "PRODUCTION" });

      expect(sandboxResult).toHaveLength(1);
      expect(sandboxResult[0]?.name).toBe("Sandbox Process");
      expect(prodResult).toHaveLength(1);
      expect(prodResult[0]?.name).toBe("Prod Process");
    });

    it("should filter by search string (case-insensitive)", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      await processFactory.create({
        tenantId: tenant.id,
        name: "Product Generator",
      });
      await processFactory.create({
        tenantId: tenant.id,
        name: "Email Parser",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.list({ search: "product" });

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Product Generator");
    });

    it("should return processes ordered by updatedAt descending", async () => {
      const { user, tenant } = await userFactory.createWithTenant();

      const oldDate = new Date("2024-01-01");
      const newDate = new Date("2024-06-01");

      await processFactory.create({
        tenantId: tenant.id,
        name: "Old Process",
        updatedAt: oldDate,
      });
      await processFactory.create({
        tenantId: tenant.id,
        name: "New Process",
        updatedAt: newDate,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.list({});

      expect(result[0]?.name).toBe("New Process");
      expect(result[1]?.name).toBe("Old Process");
    });

    it("should include computed fields (versionCount, hasProductionVersion)", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "SANDBOX",
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.list({});

      expect(result[0]?.versionCount).toBe(2);
      expect(result[0]?.hasProductionVersion).toBe(true);
    });

    it("should reject unauthenticated requests", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.process.list({})).rejects.toThrow(TRPCError);
    });
  });

  describe("listWithStats", () => {
    it("should return empty array when no processes exist", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.listWithStats({});

      expect(result).toEqual([]);
    });

    it("should return processes with computed status field", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({
        tenantId: tenant.id,
        name: "Test Process",
        description: "A test process",
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "SANDBOX",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.listWithStats({});

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: process.id,
        name: "Test Process",
        description: "A test process",
        status: "SANDBOX",
      });
      expect(result[0]).toHaveProperty("createdAt");
      expect(result[0]).toHaveProperty("updatedAt");
    });

    it("should compute status as PRODUCTION when any production version exists", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "SANDBOX",
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.listWithStats({});

      expect(result[0]?.status).toBe("PRODUCTION");
    });

    it("should compute status as DRAFT when no versions exist", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      await processFactory.create({ tenantId: tenant.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.listWithStats({});

      expect(result[0]?.status).toBe("DRAFT");
    });

    it("should filter by computed status", async () => {
      const { user, tenant } = await userFactory.createWithTenant();

      // Create process with SANDBOX status
      const sandboxProcess = await processFactory.create({
        tenantId: tenant.id,
        name: "Sandbox Process",
      });
      await processVersionFactory.create({
        processId: sandboxProcess.id,
        environment: "SANDBOX",
      });

      // Create process with PRODUCTION status
      const prodProcess = await processFactory.create({
        tenantId: tenant.id,
        name: "Production Process",
      });
      await processVersionFactory.create({
        processId: prodProcess.id,
        environment: "PRODUCTION",
      });

      // Create process with DRAFT status (no versions)
      await processFactory.create({
        tenantId: tenant.id,
        name: "Draft Process",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      // Test SANDBOX filter
      const sandboxResult = await caller.process.listWithStats({ status: "SANDBOX" });
      expect(sandboxResult).toHaveLength(1);
      expect(sandboxResult[0]?.name).toBe("Sandbox Process");

      // Test PRODUCTION filter
      const prodResult = await caller.process.listWithStats({ status: "PRODUCTION" });
      expect(prodResult).toHaveLength(1);
      expect(prodResult[0]?.name).toBe("Production Process");

      // Test DRAFT filter
      const draftResult = await caller.process.listWithStats({ status: "DRAFT" });
      expect(draftResult).toHaveLength(1);
      expect(draftResult[0]?.name).toBe("Draft Process");
    });

    it("should search by name (case-insensitive)", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      await processFactory.create({ tenantId: tenant.id, name: "Product Generator" });
      await processFactory.create({ tenantId: tenant.id, name: "Email Parser" });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.listWithStats({ search: "product" });

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Product Generator");
    });

    it("should sort by name ascending", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      await processFactory.create({ tenantId: tenant.id, name: "Zebra" });
      await processFactory.create({ tenantId: tenant.id, name: "Alpha" });
      await processFactory.create({ tenantId: tenant.id, name: "Middle" });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.listWithStats({
        sortBy: "name",
        sortOrder: "asc",
      });

      expect(result[0]?.name).toBe("Alpha");
      expect(result[1]?.name).toBe("Middle");
      expect(result[2]?.name).toBe("Zebra");
    });

    it("should sort by name descending", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      await processFactory.create({ tenantId: tenant.id, name: "Zebra" });
      await processFactory.create({ tenantId: tenant.id, name: "Alpha" });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.listWithStats({
        sortBy: "name",
        sortOrder: "desc",
      });

      expect(result[0]?.name).toBe("Zebra");
      expect(result[1]?.name).toBe("Alpha");
    });

    it("should sort by createdAt descending (newest first)", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const oldDate = new Date("2024-01-01");
      const newDate = new Date("2024-06-01");

      await processFactory.create({
        tenantId: tenant.id,
        name: "Old Process",
        createdAt: oldDate,
      });
      await processFactory.create({
        tenantId: tenant.id,
        name: "New Process",
        createdAt: newDate,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.listWithStats({
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      expect(result[0]?.name).toBe("New Process");
      expect(result[1]?.name).toBe("Old Process");
    });

    it("should sort by updatedAt ascending (oldest first)", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const oldDate = new Date("2024-01-01");
      const newDate = new Date("2024-06-01");

      await processFactory.create({
        tenantId: tenant.id,
        name: "Old Process",
        updatedAt: oldDate,
      });
      await processFactory.create({
        tenantId: tenant.id,
        name: "New Process",
        updatedAt: newDate,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.listWithStats({
        sortBy: "updatedAt",
        sortOrder: "asc",
      });

      expect(result[0]?.name).toBe("Old Process");
      expect(result[1]?.name).toBe("New Process");
    });

    it("should not return processes from other tenants (isolation)", async () => {
      const { user: user1, tenant: tenant1 } = await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create({ name: "Other Tenant" });

      await processFactory.create({ tenantId: tenant1.id, name: "Tenant 1 Process" });
      await processFactory.create({ tenantId: tenant2.id, name: "Tenant 2 Process" });

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      const result = await caller.process.listWithStats({});

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Tenant 1 Process");
    });

    it("should not return soft-deleted processes", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      await processFactory.create({ tenantId: tenant.id, name: "Active" });
      await processFactory.create({
        tenantId: tenant.id,
        name: "Deleted",
        deletedAt: new Date(),
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.listWithStats({});

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Active");
    });

    it("should reject unauthenticated requests", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.process.listWithStats({})).rejects.toThrow(TRPCError);
    });

    it("should default to updatedAt desc sorting", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const oldDate = new Date("2024-01-01");
      const newDate = new Date("2024-06-01");

      await processFactory.create({
        tenantId: tenant.id,
        name: "Old Process",
        updatedAt: oldDate,
      });
      await processFactory.create({
        tenantId: tenant.id,
        name: "New Process",
        updatedAt: newDate,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      // Call without explicit sort params - should use defaults
      const result = await caller.process.listWithStats({});

      expect(result[0]?.name).toBe("New Process");
      expect(result[1]?.name).toBe("Old Process");
    });

    it("should exclude deprecated versions from status calculation", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      // Add deprecated PRODUCTION version and active SANDBOX version
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
        deprecatedAt: new Date(),
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "SANDBOX",
        deprecatedAt: null,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.listWithStats({});

      // Should be SANDBOX since PRODUCTION is deprecated
      expect(result[0]?.status).toBe("SANDBOX");
    });
  });

  describe("get", () => {
    it("should return a process with all versions", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
      });
      await processVersionFactory.create({
        processId: process.id,
        version: "2.0.0",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.get({ id: process.id });

      expect(result.id).toBe(process.id);
      expect(result.versions).toHaveLength(2);
      expect(result.versionCount).toBe(2);
    });

    it("should throw NOT_FOUND for non-existent process", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.get({ id: "proc_nonexistent" })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.process.get({ id: "proc_nonexistent" });
      } catch (error) {
        expect((error as TRPCError).code).toBe("NOT_FOUND");
      }
    });

    it("should throw NOT_FOUND for other tenant's process", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const { process: tenant2Process } = await processFactory.createWithTenant(
        { name: "Other Tenant Process" },
        { name: "Other Tenant" }
      );

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.process.get({ id: tenant2Process.id })
      ).rejects.toThrow(TRPCError);
    });

    it("should throw NOT_FOUND for deleted process", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({
        tenantId: tenant.id,
        deletedAt: new Date(),
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(caller.process.get({ id: process.id })).rejects.toThrow(
        TRPCError
      );
    });

    it("should include computed hasProductionVersion field", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.get({ id: process.id });

      expect(result.hasProductionVersion).toBe(true);
    });
  });

  describe("create", () => {
    it("should create a new process with initial SANDBOX version", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.create({
        name: "New Intelligence",
        description: "Test description",
        inputSchema: { type: "object", properties: { input: { type: "string" } } },
        outputSchema: { type: "object", properties: { output: { type: "string" } } },
      });

      expect(result.process.name).toBe("New Intelligence");
      expect(result.process.id).toMatch(/^proc_/);
      expect(result.version.id).toMatch(/^procv_/);
      expect(result.version.version).toBe("1.0.0");
      expect(result.version.environment).toBe("SANDBOX");
    });

    it("should generate proc_* and procv_* IDs", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.create({
        name: "ID Test Process",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      });

      expect(result.process.id).toMatch(/^proc_[a-f0-9]{16}$/);
      expect(result.version.id).toMatch(/^procv_[a-f0-9]{16}$/);
    });

    it("should use config defaults when not provided", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.create({
        name: "Default Config Process",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      });

      const config = result.version.config as Record<string, unknown>;
      expect(config.maxTokens).toBe(1024);
      expect(config.temperature).toBe(0.3);
      expect(config.cacheTtlSeconds).toBe(900);
      expect(config.cacheEnabled).toBe(true);
      expect(config.requestsPerMinute).toBe(60);
    });

    it("should accept custom config values", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.create({
        name: "Custom Config Process",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        config: {
          systemPrompt: "You are a helpful assistant",
          maxTokens: 2048,
          temperature: 0.7,
          goal: "Generate product descriptions",
        },
      });

      const config = result.version.config as Record<string, unknown>;
      expect(config.systemPrompt).toBe("You are a helpful assistant");
      expect(config.maxTokens).toBe(2048);
      expect(config.temperature).toBe(0.7);
      expect(config.goal).toBe("Generate product descriptions");
    });

    it("should validate JSON Schema format", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      // Invalid JSON Schema (using invalid type)
      await expect(
        caller.process.create({
          name: "Invalid Schema",
          inputSchema: { type: "invalid_type" },
          outputSchema: { type: "object" },
        })
      ).rejects.toThrow();
    });

    it("should create audit log entry", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.create({
        name: "Audited Process",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      });

      // Wait for fire-and-forget audit log
      await new Promise((r) => setTimeout(r, 100));

      const auditLogs = await testDb.auditLog.findMany({
        where: {
          tenantId: tenant.id,
          action: "process.created",
          resourceId: result.process.id,
        },
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]?.userId).toBe(user.id);
    });

    it("should reject empty name", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.create({
          name: "",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
        })
      ).rejects.toThrow();
    });

    it("should use transaction for atomicity", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.create({
        name: "Transactional Process",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      });

      // Verify both were created
      const process = await testDb.process.findUnique({
        where: { id: result.process.id },
      });
      const version = await testDb.processVersion.findUnique({
        where: { id: result.version.id },
      });

      expect(process).not.toBeNull();
      expect(version).not.toBeNull();
      expect(version?.processId).toBe(process?.id);
    });
  });

  describe("update", () => {
    it("should update process name", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({
        tenantId: tenant.id,
        name: "Original Name",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.update({
        id: process.id,
        name: "Updated Name",
      });

      expect(result.name).toBe("Updated Name");
    });

    it("should update only provided fields", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({
        tenantId: tenant.id,
        name: "Original",
        description: "Original description",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.update({
        id: process.id,
        name: "Updated",
        // Not updating description
      });

      expect(result.name).toBe("Updated");
      expect(result.description).toBe("Original description");
    });

    it("should update inputSchema and outputSchema", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const newInputSchema = {
        type: "object",
        properties: { newInput: { type: "string" } },
      };

      const result = await caller.process.update({
        id: process.id,
        inputSchema: newInputSchema,
      });

      expect(result.inputSchema).toEqual(newInputSchema);
    });

    it("should validate updated JSON schemas", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.update({
          id: process.id,
          inputSchema: { type: "invalid_type" },
        })
      ).rejects.toThrow();
    });

    it("should throw NOT_FOUND for non-existent process", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.update({
          id: "proc_nonexistent",
          name: "New Name",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should throw NOT_FOUND for other tenant's process", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const { process: tenant2Process } = await processFactory.createWithTenant(
        { name: "Other Process" }
      );

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.process.update({
          id: tenant2Process.id,
          name: "Hijacked Name",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should create audit log entry", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await caller.process.update({
        id: process.id,
        name: "Updated Name",
      });

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 100));

      const auditLog = await testDb.auditLog.findFirst({
        where: {
          tenantId: tenant.id,
          action: "process.updated",
          resourceId: process.id,
        },
      });

      expect(auditLog).not.toBeNull();
    });
  });

  describe("duplicate", () => {
    it("should create copy with (Copy) suffix", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const original = await processFactory.create({
        tenantId: tenant.id,
        name: "Original Process",
      });
      await processVersionFactory.create({
        processId: original.id,
        environment: "SANDBOX",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.duplicate({ id: original.id });

      expect(result.process.name).toBe("Original Process (Copy)");
    });

    it("should accept custom newName", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const original = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({ processId: original.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.duplicate({
        id: original.id,
        newName: "My Custom Copy",
      });

      expect(result.process.name).toBe("My Custom Copy");
    });

    it("should create new IDs (not copy original)", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const original = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({ processId: original.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.duplicate({ id: original.id });

      expect(result.process.id).not.toBe(original.id);
      expect(result.process.id).toMatch(/^proc_/);
      expect(result.version.id).toMatch(/^procv_/);
    });

    it("should copy inputSchema and outputSchema", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const customSchema = {
        type: "object",
        properties: { custom: { type: "string" } },
      };
      const original = await processFactory.create({
        tenantId: tenant.id,
        inputSchema: customSchema,
      });
      await processVersionFactory.create({ processId: original.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.duplicate({ id: original.id });

      expect(result.process.inputSchema).toEqual(customSchema);
    });

    it("should create new SANDBOX version", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const original = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: original.id,
        environment: "PRODUCTION",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.duplicate({ id: original.id });

      expect(result.version.environment).toBe("SANDBOX");
      expect(result.version.version).toBe("1.0.0");
    });

    it("should throw NOT_FOUND for non-existent process", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.duplicate({ id: "proc_nonexistent" })
      ).rejects.toThrow(TRPCError);
    });

    it("should throw NOT_FOUND for other tenant's process", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const { process: tenant2Process } = await processFactory.createWithTenant(
        { name: "Other Process" }
      );

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.process.duplicate({ id: tenant2Process.id })
      ).rejects.toThrow(TRPCError);
    });

    it("should create audit log entry", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const original = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({ processId: original.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.duplicate({ id: original.id });

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 100));

      const auditLog = await testDb.auditLog.findFirst({
        where: {
          tenantId: tenant.id,
          action: "process.duplicated",
          resourceId: result.process.id,
        },
      });

      expect(auditLog).not.toBeNull();
      expect(
        (auditLog?.metadata as { sourceProcessId?: string })?.sourceProcessId
      ).toBe(original.id);
    });
  });

  describe("delete", () => {
    it("should soft delete a process (set deletedAt)", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.delete({ id: process.id });

      expect(result.success).toBe(true);

      // Verify in database
      const deletedProcess = await testDb.process.findUnique({
        where: { id: process.id },
      });
      expect(deletedProcess?.deletedAt).not.toBeNull();
    });

    it("should exclude deleted process from list", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      // Delete it
      await caller.process.delete({ id: process.id });

      // List should not include it
      const result = await caller.process.list({});
      expect(result.find((p) => p.id === process.id)).toBeUndefined();
    });

    it("should throw NOT_FOUND for non-existent process", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.delete({ id: "proc_nonexistent" })
      ).rejects.toThrow(TRPCError);
    });

    it("should throw NOT_FOUND for already deleted process", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({
        tenantId: tenant.id,
        deletedAt: new Date(),
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(caller.process.delete({ id: process.id })).rejects.toThrow(
        TRPCError
      );
    });

    it("should throw NOT_FOUND for other tenant's process", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const { process: tenant2Process } = await processFactory.createWithTenant(
        { name: "Other Process" }
      );

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.process.delete({ id: tenant2Process.id })
      ).rejects.toThrow(TRPCError);
    });

    it("should create audit log entry", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await caller.process.delete({ id: process.id });

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 100));

      const auditLog = await testDb.auditLog.findFirst({
        where: {
          tenantId: tenant.id,
          action: "process.deleted",
          resourceId: process.id,
        },
      });

      expect(auditLog).not.toBeNull();
    });
  });

  describe("restore", () => {
    it("should restore a soft-deleted process", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({
        tenantId: tenant.id,
        deletedAt: new Date(),
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.restore({ id: process.id });

      expect(result.deletedAt).toBeNull();

      // Verify in database
      const restoredProcess = await testDb.process.findUnique({
        where: { id: process.id },
      });
      expect(restoredProcess?.deletedAt).toBeNull();
    });

    it("should make restored process appear in list", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({
        tenantId: tenant.id,
        deletedAt: new Date(),
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      // Restore it
      await caller.process.restore({ id: process.id });

      // List should include it now
      const result = await caller.process.list({});
      expect(result.find((p) => p.id === process.id)).toBeDefined();
    });

    it("should throw NOT_FOUND for non-deleted process", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({
        tenantId: tenant.id,
        deletedAt: null,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(caller.process.restore({ id: process.id })).rejects.toThrow(
        TRPCError
      );
    });

    it("should throw NOT_FOUND for other tenant's deleted process", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const { process: tenant2Process } = await processFactory.createWithTenant(
        { name: "Other Process", deletedAt: new Date() }
      );

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.process.restore({ id: tenant2Process.id })
      ).rejects.toThrow(TRPCError);
    });

    it("should create audit log entry", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({
        tenantId: tenant.id,
        deletedAt: new Date(),
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await caller.process.restore({ id: process.id });

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 100));

      const auditLog = await testDb.auditLog.findFirst({
        where: {
          tenantId: tenant.id,
          action: "process.restored",
          resourceId: process.id,
        },
      });

      expect(auditLog).not.toBeNull();
    });
  });

  describe("authentication", () => {
    it("should reject all procedures for unauthenticated users", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.process.list({})).rejects.toThrow(TRPCError);
      await expect(
        caller.process.get({ id: "proc_test" })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.process.create({
          name: "Test",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
        })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.process.update({ id: "proc_test", name: "New" })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.process.duplicate({ id: "proc_test" })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.process.delete({ id: "proc_test" })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.process.restore({ id: "proc_test" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("createDraftVersion (Story 2.4)", () => {
    it("should create a new SANDBOX draft version from existing version", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
        config: { goal: "Original goal" },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.createDraftVersion({
        processId: process.id,
      });

      expect(result.environment).toBe("SANDBOX");
      expect(result.processId).toBe(process.id);
      expect(result.id).toMatch(/^procv_/);
    });

    it("should return existing draft if one already exists", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const existingDraft = await processVersionFactory.create({
        processId: process.id,
        environment: "SANDBOX",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.createDraftVersion({
        processId: process.id,
      });

      expect(result.id).toBe(existingDraft.id);
    });

    it("should copy config from latest version", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
        config: {
          goal: "Test goal",
          maxTokens: 2048,
          components: [{ name: "TestComponent", type: "Test" }],
        },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.createDraftVersion({
        processId: process.id,
      });

      const config = result.config as Record<string, unknown>;
      expect(config.goal).toBe("Test goal");
      expect(config.maxTokens).toBe(2048);
      expect(config.components).toHaveLength(1);
    });

    it("should throw NOT_FOUND for non-existent process", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.createDraftVersion({ processId: "proc_nonexistent" })
      ).rejects.toThrow(TRPCError);
    });

    it("should throw NOT_FOUND for other tenant's process", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const { process: tenant2Process } = await processFactory.createWithTenant(
        { name: "Other Process" }
      );
      await processVersionFactory.create({
        processId: tenant2Process.id,
        environment: "PRODUCTION",
      });

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.process.createDraftVersion({ processId: tenant2Process.id })
      ).rejects.toThrow(TRPCError);
    });

    it("should create audit log entry", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.createDraftVersion({
        processId: process.id,
      });

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 100));

      const auditLog = await testDb.auditLog.findFirst({
        where: {
          tenantId: tenant.id,
          action: "processVersion.draftCreated",
          resourceId: result.id,
        },
      });

      expect(auditLog).not.toBeNull();
      expect(
        (auditLog?.metadata as { processId?: string })?.processId
      ).toBe(process.id);
    });

    it("should reject unauthenticated requests", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.process.createDraftVersion({ processId: "proc_test" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("input validation", () => {
    it("should reject invalid input with ZodError details", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      // Name too long (>255 chars)
      await expect(
        caller.process.create({
          name: "a".repeat(256),
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
        })
      ).rejects.toThrow();
    });

    it("should accept valid JSON Schema Draft 7", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const validSchema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
          name: { type: "string", minLength: 1 },
          age: { type: "integer", minimum: 0 },
        },
        required: ["name"],
      };

      const result = await caller.process.create({
        name: "Valid Schema Process",
        inputSchema: validSchema,
        outputSchema: validSchema,
      });

      expect(result.process.inputSchema).toEqual(validSchema);
    });
  });

  describe("components (Story 2.3)", () => {
    it("should create process with components in config", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.create({
        name: "Process with Components",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        config: {
          goal: "Test components",
          components: [
            {
              name: "ProductVariant",
              type: "Variant",
              attributes: [
                { name: "sku", type: "string", required: true },
                { name: "price", type: "number", required: true },
              ],
            },
          ],
        },
      });

      const config = result.version.config as Record<string, unknown>;
      expect(config.components).toBeDefined();
      expect(Array.isArray(config.components)).toBe(true);

      const components = config.components as Array<{
        name: string;
        type: string;
        attributes: Array<{ name: string; type: string; required: boolean }>;
      }>;
      expect(components).toHaveLength(1);
      expect(components[0]?.name).toBe("ProductVariant");
      expect(components[0]?.attributes).toHaveLength(2);
    });

    it("should create process with nested components (3 levels)", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.create({
        name: "Process with Nested Components",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        config: {
          goal: "Test nested components",
          components: [
            {
              name: "Level1",
              type: "L1",
              subcomponents: [
                {
                  name: "Level2",
                  type: "L2",
                  subcomponents: [
                    {
                      name: "Level3",
                      type: "L3",
                      attributes: [
                        { name: "value", type: "string", required: false },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      const config = result.version.config as Record<string, unknown>;
      const components = config.components as Array<{
        name: string;
        subcomponents?: Array<{
          name: string;
          subcomponents?: Array<{ name: string }>;
        }>;
      }>;

      expect(components[0]?.name).toBe("Level1");
      expect(components[0]?.subcomponents?.[0]?.name).toBe("Level2");
      expect(components[0]?.subcomponents?.[0]?.subcomponents?.[0]?.name).toBe("Level3");
    });

    it("should reject components nested more than 3 levels deep", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.create({
          name: "Process with Too Deep Components",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
          config: {
            goal: "Test depth validation",
            components: [
              {
                name: "Level1",
                type: "L1",
                subcomponents: [
                  {
                    name: "Level2",
                    type: "L2",
                    subcomponents: [
                      {
                        name: "Level3",
                        type: "L3",
                        subcomponents: [
                          {
                            name: "Level4", // This is too deep!
                            type: "L4",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        })
      ).rejects.toThrow(/cannot be nested more than 3 levels/i);
    });

    it("should retrieve process with components intact", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const createResult = await caller.process.create({
        name: "Process with Components to Retrieve",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        config: {
          goal: "Test retrieval",
          components: [
            {
              name: "TestComponent",
              type: "Test",
              attributes: [
                { name: "field1", type: "string", description: "Test field", required: true },
              ],
            },
          ],
        },
      });

      const getResult = await caller.process.get({ id: createResult.process.id });

      // The process.get returns process with versions
      expect(getResult.versions).toHaveLength(1);
      const config = getResult.versions[0]?.config as Record<string, unknown>;
      const components = config.components as Array<{
        name: string;
        attributes: Array<{ name: string; description?: string }>;
      }>;

      expect(components[0]?.name).toBe("TestComponent");
      expect(components[0]?.attributes[0]?.description).toBe("Test field");
    });

    it("should validate component attribute types", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      // Valid attribute types: string, number, boolean, array, object
      const result = await caller.process.create({
        name: "Process with All Attribute Types",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        config: {
          goal: "Test attribute types",
          components: [
            {
              name: "AllTypes",
              type: "Test",
              attributes: [
                { name: "stringField", type: "string", required: false },
                { name: "numberField", type: "number", required: false },
                { name: "booleanField", type: "boolean", required: false },
                { name: "arrayField", type: "array", required: false },
                { name: "objectField", type: "object", required: false },
              ],
            },
          ],
        },
      });

      const config = result.version.config as Record<string, unknown>;
      const components = config.components as Array<{
        attributes: Array<{ type: string }>;
      }>;

      expect(components[0]?.attributes).toHaveLength(5);
    });
  });

  /**
   * Story 4.6: Configurable Cache TTL
   *
   * Tests for the updateVersionConfig mutation that updates
   * cache settings (cacheTtlSeconds, cacheEnabled) in ProcessVersion.config
   */
  describe("updateVersionConfig (Story 4.6)", () => {
    it("should update cacheTtlSeconds in version config", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "SANDBOX",
        config: {
          systemPrompt: "Test",
          maxTokens: 100,
          temperature: 0.3,
          inputSchemaDescription: "",
          outputSchemaDescription: "",
          goal: "Test",
          cacheTtlSeconds: 900,
          cacheEnabled: true,
          requestsPerMinute: 60,
        },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.updateVersionConfig({
        processId: process.id,
        config: {
          cacheTtlSeconds: 3600, // Update to 1 hour
        },
      });

      const config = result.config as Record<string, unknown>;
      expect(config.cacheTtlSeconds).toBe(3600);
      // Other config values should be preserved
      expect(config.cacheEnabled).toBe(true);
      expect(config.systemPrompt).toBe("Test");
    });

    it("should update cacheEnabled in version config", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "SANDBOX",
        config: {
          systemPrompt: "Test",
          maxTokens: 100,
          temperature: 0.3,
          inputSchemaDescription: "",
          outputSchemaDescription: "",
          goal: "Test",
          cacheTtlSeconds: 900,
          cacheEnabled: true,
          requestsPerMinute: 60,
        },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.updateVersionConfig({
        processId: process.id,
        config: {
          cacheEnabled: false, // Disable caching
        },
      });

      const config = result.config as Record<string, unknown>;
      expect(config.cacheEnabled).toBe(false);
      // Other config values should be preserved
      expect(config.cacheTtlSeconds).toBe(900);
    });

    it("should reject cacheTtlSeconds below 0", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "SANDBOX",
        config: { systemPrompt: "Test", cacheTtlSeconds: 900 },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.updateVersionConfig({
          processId: process.id,
          config: {
            cacheTtlSeconds: -1,
          },
        })
      ).rejects.toThrow();
    });

    it("should reject cacheTtlSeconds above 86400", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "SANDBOX",
        config: { systemPrompt: "Test", cacheTtlSeconds: 900 },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.updateVersionConfig({
          processId: process.id,
          config: {
            cacheTtlSeconds: 86401, // Just over 24 hours
          },
        })
      ).rejects.toThrow();
    });

    it("should accept cacheTtlSeconds=0 (disabled)", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "SANDBOX",
        config: { systemPrompt: "Test", cacheTtlSeconds: 900 },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.updateVersionConfig({
        processId: process.id,
        config: {
          cacheTtlSeconds: 0,
        },
      });

      const config = result.config as Record<string, unknown>;
      expect(config.cacheTtlSeconds).toBe(0);
    });

    it("should return NOT_FOUND for non-existent process", async () => {
      const { user, tenant } = await userFactory.createWithTenant();

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.updateVersionConfig({
          processId: "proc_nonexistent",
          config: { cacheTtlSeconds: 3600 },
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should return BAD_REQUEST when no sandbox version exists", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      // Create PRODUCTION version only, no SANDBOX
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
        config: { systemPrompt: "Test", cacheTtlSeconds: 900 },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.updateVersionConfig({
          processId: process.id,
          config: { cacheTtlSeconds: 3600 },
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should not update processes from other tenants (isolation)", async () => {
      const { user: user1, tenant: tenant1 } = await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create({ name: "Other Tenant" });
      const process = await processFactory.create({ tenantId: tenant2.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "SANDBOX",
        config: { systemPrompt: "Test", cacheTtlSeconds: 900 },
      });

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.process.updateVersionConfig({
          processId: process.id,
          config: { cacheTtlSeconds: 3600 },
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  /**
   * Story 5.3: Promote to Production
   *
   * Tests for promoting sandbox versions to production.
   */
  describe("getPromotionPreview (Story 5.3)", () => {
    it("should return preview for valid sandbox version", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const sandboxVersion = await processVersionFactory.createActiveSandbox({
        processId: process.id,
        config: { systemPrompt: "Test prompt", temperature: 0.7 },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.getPromotionPreview({
        processId: process.id,
        versionId: sandboxVersion.id,
      });

      expect(result.sourceVersion.id).toBe(sandboxVersion.id);
      expect(result.sourceVersion.environment).toBe("SANDBOX");
      expect(result.currentProductionVersion).toBeNull();
      expect(result.diff.summary).toBe("First deployment to production");
      expect(result.cacheEntryCount).toBe(0);
    });

    it("should include current production version in preview", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      // Create existing production version
      const productionVersion = await processVersionFactory.createProduction({
        processId: process.id,
        version: "1.0.0",
        config: { systemPrompt: "Original prompt", temperature: 0.7 },
      });

      // Create sandbox version with changes
      const sandboxVersion = await processVersionFactory.createActiveSandbox({
        processId: process.id,
        version: "1.0.1",
        config: { systemPrompt: "Updated prompt", temperature: 0.9 },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.getPromotionPreview({
        processId: process.id,
        versionId: sandboxVersion.id,
      });

      expect(result.currentProductionVersion).not.toBeNull();
      expect(result.currentProductionVersion?.id).toBe(productionVersion.id);
      expect(result.diff.hasChanges).toBe(true);
      expect(result.diff.changeCount.modified).toBeGreaterThan(0);
    });

    it("should include cache entry count in preview", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const sandboxVersion = await processVersionFactory.createActiveSandbox({
        processId: process.id,
      });

      // Create some cache entries
      await testDb.responseCache.createMany({
        data: [
          {
            tenantId: tenant.id,
            processId: process.id,
            inputHash: "hash1",
            response: { test: true },
            version: "1.0.0",
            cachedAt: new Date(),
            expiresAt: new Date(Date.now() + 3600000),
          },
          {
            tenantId: tenant.id,
            processId: process.id,
            inputHash: "hash2",
            response: { test: true },
            version: "1.0.0",
            cachedAt: new Date(),
            expiresAt: new Date(Date.now() + 3600000),
          },
        ],
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.getPromotionPreview({
        processId: process.id,
        versionId: sandboxVersion.id,
      });

      expect(result.cacheEntryCount).toBe(2);
    });

    it("should reject non-sandbox versions", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const productionVersion = await processVersionFactory.createProduction({
        processId: process.id,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.getPromotionPreview({
          processId: process.id,
          versionId: productionVersion.id,
        })
      ).rejects.toThrow("Can only promote SANDBOX versions");
    });

    it("should reject non-active versions", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const draftVersion = await processVersionFactory.create({
        processId: process.id,
        environment: "SANDBOX",
        status: "DRAFT",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.getPromotionPreview({
          processId: process.id,
          versionId: draftVersion.id,
        })
      ).rejects.toThrow("Can only promote ACTIVE versions");
    });

    it("should reject unauthenticated requests", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.process.getPromotionPreview({
          processId: "proc_test",
          versionId: "procv_test",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should not return preview for other tenant's process (isolation)", async () => {
      const { user: user1, tenant: tenant1 } = await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create({ name: "Other Tenant" });
      const process = await processFactory.create({ tenantId: tenant2.id });
      const sandboxVersion = await processVersionFactory.createActiveSandbox({
        processId: process.id,
      });

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.process.getPromotionPreview({
          processId: process.id,
          versionId: sandboxVersion.id,
        })
      ).rejects.toThrow("Version not found");
    });
  });

  describe("promoteToProduction (Story 5.3)", () => {
    it("should create new production version from sandbox", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const sandboxVersion = await processVersionFactory.createActiveSandbox({
        processId: process.id,
        version: "0.1.0",
        config: { systemPrompt: "Promote me!", temperature: 0.8 },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.promoteToProduction({
        processId: process.id,
        versionId: sandboxVersion.id,
      });

      expect(result.promotedVersion.environment).toBe("PRODUCTION");
      expect(result.promotedVersion.status).toBe("ACTIVE");
      expect(result.promotedVersion.version).toBe("1.0.0"); // First production version
      expect(result.deprecatedVersion).toBeNull();
    });

    it("should copy config from sandbox to production version", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const sandboxConfig = {
        systemPrompt: "Test prompt",
        temperature: 0.9,
        maxTokens: 1024,
      };
      const sandboxVersion = await processVersionFactory.createActiveSandbox({
        processId: process.id,
        config: sandboxConfig,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await caller.process.promoteToProduction({
        processId: process.id,
        versionId: sandboxVersion.id,
      });

      // Verify config was copied
      const productionVersion = await testDb.processVersion.findFirst({
        where: {
          processId: process.id,
          environment: "PRODUCTION",
          status: "ACTIVE",
        },
      });

      expect(productionVersion?.config).toEqual(sandboxConfig);
    });

    it("should deprecate existing production version", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      // Create existing production version
      const existingProduction = await processVersionFactory.createProduction({
        processId: process.id,
        version: "1.0.0",
      });

      // Create sandbox version
      const sandboxVersion = await processVersionFactory.createActiveSandbox({
        processId: process.id,
        version: "0.2.0",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.promoteToProduction({
        processId: process.id,
        versionId: sandboxVersion.id,
      });

      expect(result.deprecatedVersion).not.toBeNull();
      expect(result.deprecatedVersion?.id).toBe(existingProduction.id);
      expect(result.deprecatedVersion?.status).toBe("DEPRECATED");

      // Verify in database
      const deprecated = await testDb.processVersion.findUnique({
        where: { id: existingProduction.id },
      });
      expect(deprecated?.status).toBe("DEPRECATED");
      expect(deprecated?.deprecatedAt).not.toBeNull();
    });

    it("should increment version number correctly", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      // Create some existing versions
      await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
      });
      await processVersionFactory.create({
        processId: process.id,
        version: "2.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
      });

      const sandboxVersion = await processVersionFactory.createActiveSandbox({
        processId: process.id,
        version: "0.3.0",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.promoteToProduction({
        processId: process.id,
        versionId: sandboxVersion.id,
      });

      // Should be 3.0.0 (max was 2.0.0)
      expect(result.promotedVersion.version).toBe("3.0.0");
    });

    it("should invalidate cache entries", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const sandboxVersion = await processVersionFactory.createActiveSandbox({
        processId: process.id,
      });

      // Create cache entries
      await testDb.responseCache.createMany({
        data: [
          {
            tenantId: tenant.id,
            processId: process.id,
            inputHash: "hash1",
            response: { test: true },
            version: "1.0.0",
            cachedAt: new Date(),
            expiresAt: new Date(Date.now() + 3600000),
          },
          {
            tenantId: tenant.id,
            processId: process.id,
            inputHash: "hash2",
            response: { test: true },
            version: "1.0.0",
            cachedAt: new Date(),
            expiresAt: new Date(Date.now() + 3600000),
          },
        ],
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.promoteToProduction({
        processId: process.id,
        versionId: sandboxVersion.id,
      });

      expect(result.cacheInvalidated).toBe(2);

      // Verify cache is empty
      const cacheCount = await testDb.responseCache.count({
        where: { processId: process.id },
      });
      expect(cacheCount).toBe(0);
    });

    it("should store change notes", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const sandboxVersion = await processVersionFactory.createActiveSandbox({
        processId: process.id,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await caller.process.promoteToProduction({
        processId: process.id,
        versionId: sandboxVersion.id,
        changeNotes: "Initial production release with improved prompts",
      });

      const productionVersion = await testDb.processVersion.findFirst({
        where: {
          processId: process.id,
          environment: "PRODUCTION",
          status: "ACTIVE",
        },
      });

      expect(productionVersion?.changeNotes).toBe(
        "Initial production release with improved prompts"
      );
    });

    it("should create audit log entry", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const sandboxVersion = await processVersionFactory.createActiveSandbox({
        processId: process.id,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.promoteToProduction({
        processId: process.id,
        versionId: sandboxVersion.id,
      });

      // Wait briefly for transaction to complete
      await new Promise((r) => setTimeout(r, 100));

      const auditLog = await testDb.auditLog.findFirst({
        where: {
          tenantId: tenant.id,
          action: "processVersion.promoted",
          resourceId: result.promotedVersion.id,
        },
      });

      expect(auditLog).not.toBeNull();
      expect((auditLog?.metadata as Record<string, unknown>)?.processId).toBe(
        process.id
      );
      expect((auditLog?.metadata as Record<string, unknown>)?.fromVersionId).toBe(
        sandboxVersion.id
      );
    });

    it("should reject non-sandbox versions", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const productionVersion = await processVersionFactory.createProduction({
        processId: process.id,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.promoteToProduction({
          processId: process.id,
          versionId: productionVersion.id,
        })
      ).rejects.toThrow("Can only promote SANDBOX versions");
    });

    it("should reject non-active versions", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const draftVersion = await processVersionFactory.create({
        processId: process.id,
        environment: "SANDBOX",
        status: "DRAFT",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.promoteToProduction({
          processId: process.id,
          versionId: draftVersion.id,
        })
      ).rejects.toThrow("Can only promote ACTIVE versions");
    });

    it("should reject unauthenticated requests", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.process.promoteToProduction({
          processId: "proc_test",
          versionId: "procv_test",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should not promote other tenant's process (isolation)", async () => {
      const { user: user1, tenant: tenant1 } = await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create({ name: "Other Tenant" });
      const process = await processFactory.create({ tenantId: tenant2.id });
      const sandboxVersion = await processVersionFactory.createActiveSandbox({
        processId: process.id,
      });

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.process.promoteToProduction({
          processId: process.id,
          versionId: sandboxVersion.id,
        })
      ).rejects.toThrow("Version not found");
    });
  });

  /**
   * Story 5.4: Version History and Rollback
   *
   * Tests for viewing version history, comparing versions, and rolling back.
   */
  describe("getHistory (Story 5.4)", () => {
    it("should return all versions for a process ordered by createdAt desc", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      // Create multiple versions with different timestamps
      await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "SANDBOX",
        createdAt: new Date("2024-01-01"),
      });
      await processVersionFactory.create({
        processId: process.id,
        version: "2.0.0",
        environment: "PRODUCTION",
        createdAt: new Date("2024-02-01"),
      });
      await processVersionFactory.create({
        processId: process.id,
        version: "3.0.0",
        environment: "SANDBOX",
        createdAt: new Date("2024-03-01"),
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.getHistory({ processId: process.id });

      expect(result.versions).toHaveLength(3);
      expect(result.versions[0]?.version).toBe("3.0.0"); // Newest first
      expect(result.versions[2]?.version).toBe("1.0.0"); // Oldest last
      expect(result.totalCount).toBe(3);
    });

    it("should include computed fields (isCurrent, canPromote, canRollback)", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const activeSandbox = await processVersionFactory.createActiveSandbox({
        processId: process.id,
        version: "2.0.0",
      });
      const activeProduction = await processVersionFactory.createProduction({
        processId: process.id,
        version: "1.0.0",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.getHistory({ processId: process.id });

      const sandboxEntry = result.versions.find((v) => v.id === activeSandbox.id);
      const productionEntry = result.versions.find((v) => v.id === activeProduction.id);

      // Active sandbox should be marked as current and promotable
      expect(sandboxEntry?.isCurrent).toBe(true);
      expect(sandboxEntry?.canPromote).toBe(true);
      expect(sandboxEntry?.canRollback).toBe(false); // Can't rollback to current sandbox

      // Active production should be marked as current but not promotable
      expect(productionEntry?.isCurrent).toBe(true);
      expect(productionEntry?.canPromote).toBe(false);
      expect(productionEntry?.canRollback).toBe(true); // Can rollback to production
    });

    it("should support pagination with offset and limit", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      // Create 5 versions
      for (let i = 1; i <= 5; i++) {
        await processVersionFactory.create({
          processId: process.id,
          version: `${i}.0.0`,
          createdAt: new Date(`2024-0${i}-01`),
        });
      }

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.getHistory({
        processId: process.id,
        limit: 2,
        offset: 1,
      });

      expect(result.versions).toHaveLength(2);
      expect(result.totalCount).toBe(5);
      expect(result.hasMore).toBe(true);
    });

    it("should throw NOT_FOUND for non-existent process", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.getHistory({ processId: "proc_nonexistent" })
      ).rejects.toThrow("Process not found");
    });

    it("should not return history for other tenant's process (isolation)", async () => {
      const { user: user1, tenant: tenant1 } = await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create({ name: "Other Tenant" });
      const process = await processFactory.create({ tenantId: tenant2.id });
      await processVersionFactory.create({ processId: process.id });

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.process.getHistory({ processId: process.id })
      ).rejects.toThrow("Process not found");
    });

    it("should reject unauthenticated requests", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.process.getHistory({ processId: "proc_test" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("getVersionDetails (Story 5.4)", () => {
    it("should return full version details with config", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const version = await processVersionFactory.create({
        processId: process.id,
        config: {
          systemPrompt: "Test prompt",
          temperature: 0.8,
          maxTokens: 2048,
        },
        changeNotes: "Test version",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.getVersionDetails({
        processId: process.id,
        versionId: version.id,
      });

      expect(result.id).toBe(version.id);
      expect(result.config).toEqual({
        systemPrompt: "Test prompt",
        temperature: 0.8,
        maxTokens: 2048,
      });
      expect(result.changeNotes).toBe("Test version");
      expect(result.process.id).toBe(process.id);
    });

    it("should include process schemas in version details", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const inputSchema = { type: "object", properties: { input: { type: "string" } } };
      const outputSchema = { type: "object", properties: { output: { type: "string" } } };
      const process = await processFactory.create({
        tenantId: tenant.id,
        inputSchema,
        outputSchema,
      });
      const version = await processVersionFactory.create({ processId: process.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.getVersionDetails({
        processId: process.id,
        versionId: version.id,
      });

      expect(result.process.inputSchema).toEqual(inputSchema);
      expect(result.process.outputSchema).toEqual(outputSchema);
    });

    it("should throw NOT_FOUND for non-existent version", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.getVersionDetails({
          processId: process.id,
          versionId: "procv_nonexistent",
        })
      ).rejects.toThrow("Version not found");
    });

    it("should throw NOT_FOUND for other tenant's version", async () => {
      const { user: user1, tenant: tenant1 } = await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create({ name: "Other Tenant" });
      const process = await processFactory.create({ tenantId: tenant2.id });
      const version = await processVersionFactory.create({ processId: process.id });

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.process.getVersionDetails({
          processId: process.id,
          versionId: version.id,
        })
      ).rejects.toThrow("Version not found");
    });
  });

  describe("diff (Story 5.4)", () => {
    it("should return diff between two versions", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const version1 = await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        config: { systemPrompt: "Original prompt", temperature: 0.7 },
      });
      const version2 = await processVersionFactory.create({
        processId: process.id,
        version: "2.0.0",
        config: { systemPrompt: "Updated prompt", temperature: 0.9 },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.diff({
        processId: process.id,
        version1Id: version1.id,
        version2Id: version2.id,
      });

      expect(result.hasChanges).toBe(true);
      expect(result.changeCount.modified).toBeGreaterThan(0);
      expect(result.version1.version).toBe("1.0.0");
      expect(result.version2.version).toBe("2.0.0");
    });

    it("should return no changes for identical configs", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const config = { systemPrompt: "Same prompt", temperature: 0.7 };
      const version1 = await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        config,
      });
      const version2 = await processVersionFactory.create({
        processId: process.id,
        version: "2.0.0",
        config,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.diff({
        processId: process.id,
        version1Id: version1.id,
        version2Id: version2.id,
      });

      expect(result.hasChanges).toBe(false);
      expect(result.summary).toBe("No changes detected");
    });

    it("should throw NOT_FOUND when version1 doesn't exist", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const version2 = await processVersionFactory.create({ processId: process.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.diff({
          processId: process.id,
          version1Id: "procv_nonexistent",
          version2Id: version2.id,
        })
      ).rejects.toThrow("Version 1 not found");
    });

    it("should throw NOT_FOUND when version2 doesn't exist", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });
      const version1 = await processVersionFactory.create({ processId: process.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.diff({
          processId: process.id,
          version1Id: version1.id,
          version2Id: "procv_nonexistent",
        })
      ).rejects.toThrow("Version 2 not found");
    });
  });

  describe("rollback (Story 5.4)", () => {
    it("should create new sandbox version from target version", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      // Create initial production version
      const targetVersion = await processVersionFactory.createProduction({
        processId: process.id,
        version: "1.0.0",
        config: { systemPrompt: "Production prompt", temperature: 0.7 },
      });

      // Create current sandbox
      await processVersionFactory.createActiveSandbox({
        processId: process.id,
        version: "2.0.0",
        config: { systemPrompt: "Sandbox prompt", temperature: 0.9 },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.rollback({
        processId: process.id,
        targetVersionId: targetVersion.id,
      });

      // New version should be SANDBOX with copied config
      expect(result.newVersion.environment).toBe("SANDBOX");
      expect(result.newVersion.status).toBe("ACTIVE");
      expect(result.sourceVersion.id).toBe(targetVersion.id);
      expect(result.deprecatedVersion).not.toBeNull();

      // Verify new version has next version number
      const newVersionNumber = parseInt(result.newVersion.version.split(".")[0] ?? "0", 10);
      expect(newVersionNumber).toBe(3); // max was 2, so new is 3
    });

    it("should copy config from target version to new version", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const targetConfig = {
        systemPrompt: "Restore this prompt",
        temperature: 0.5,
        maxTokens: 512,
      };

      const targetVersion = await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
        config: targetConfig,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.rollback({
        processId: process.id,
        targetVersionId: targetVersion.id,
      });

      // Verify config was copied
      const newVersion = await testDb.processVersion.findUnique({
        where: { id: result.newVersion.id },
      });
      expect(newVersion?.config).toEqual(targetConfig);
    });

    it("should deprecate current active sandbox version", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const targetVersion = await processVersionFactory.createProduction({
        processId: process.id,
        version: "1.0.0",
      });

      const currentSandbox = await processVersionFactory.createActiveSandbox({
        processId: process.id,
        version: "2.0.0",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.rollback({
        processId: process.id,
        targetVersionId: targetVersion.id,
      });

      expect(result.deprecatedVersion?.id).toBe(currentSandbox.id);
      expect(result.deprecatedVersion?.status).toBe("DEPRECATED");

      // Verify in database
      const deprecated = await testDb.processVersion.findUnique({
        where: { id: currentSandbox.id },
      });
      expect(deprecated?.status).toBe("DEPRECATED");
      expect(deprecated?.deprecatedAt).not.toBeNull();
    });

    it("should store custom change notes", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const targetVersion = await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "PRODUCTION",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.rollback({
        processId: process.id,
        targetVersionId: targetVersion.id,
        changeNotes: "Rolling back due to bug in v2",
      });

      expect(result.newVersion.changeNotes).toBe("Rolling back due to bug in v2");
    });

    it("should use default change notes when not provided", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const targetVersion = await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "PRODUCTION",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.rollback({
        processId: process.id,
        targetVersionId: targetVersion.id,
      });

      expect(result.newVersion.changeNotes).toBe("Restored from version 1.0.0");
    });

    it("should reject rollback to current active sandbox", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const currentSandbox = await processVersionFactory.createActiveSandbox({
        processId: process.id,
        version: "1.0.0",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.rollback({
          processId: process.id,
          targetVersionId: currentSandbox.id,
        })
      ).rejects.toThrow("Cannot rollback to the current active sandbox version");
    });

    it("should create audit log entry", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const targetVersion = await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "PRODUCTION",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.rollback({
        processId: process.id,
        targetVersionId: targetVersion.id,
      });

      // Wait for transaction to complete
      await new Promise((r) => setTimeout(r, 100));

      const auditLog = await testDb.auditLog.findFirst({
        where: {
          tenantId: tenant.id,
          action: "processVersion.rollback",
          resourceId: result.newVersion.id,
        },
      });

      expect(auditLog).not.toBeNull();
      expect((auditLog?.metadata as Record<string, unknown>)?.sourceVersionId).toBe(
        targetVersion.id
      );
    });

    it("should throw NOT_FOUND for non-existent version", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const process = await processFactory.create({ tenantId: tenant.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.rollback({
          processId: process.id,
          targetVersionId: "procv_nonexistent",
        })
      ).rejects.toThrow("Version not found");
    });

    it("should not rollback other tenant's process (isolation)", async () => {
      const { user: user1, tenant: tenant1 } = await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create({ name: "Other Tenant" });
      const process = await processFactory.create({ tenantId: tenant2.id });
      const targetVersion = await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
      });

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.process.rollback({
          processId: process.id,
          targetVersionId: targetVersion.id,
        })
      ).rejects.toThrow("Version not found");
    });

    it("should reject unauthenticated requests", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.process.rollback({
          processId: "proc_test",
          targetVersionId: "procv_test",
        })
      ).rejects.toThrow(TRPCError);
    });
  });
});
