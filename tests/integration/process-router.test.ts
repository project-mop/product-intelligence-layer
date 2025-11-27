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
});
