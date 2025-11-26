/**
 * API Key Router Integration Tests
 *
 * Tests the apiKey tRPC router with a real database.
 * Verifies CRUD operations, tenant isolation, and audit logging.
 *
 * @module tests/integration/api-key-router.test
 */

import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  createAuthenticatedCaller,
  createUnauthenticatedCaller,
} from "../support/trpc";
import { tenantFactory, userFactory, apiKeyFactory } from "../support/factories";
import { testDb } from "../support/db";

describe("apiKey Router", () => {
  describe("list", () => {
    it("should return empty array when no keys exist", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.apiKey.list();

      expect(result).toEqual([]);
    });

    it("should return all keys for the tenant", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      await apiKeyFactory.createForTenant(tenant.id, { name: "Key 1" });
      await apiKeyFactory.createForTenant(tenant.id, { name: "Key 2" });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.apiKey.list();

      expect(result).toHaveLength(2);
      expect(result.map((k) => k.name)).toContain("Key 1");
      expect(result.map((k) => k.name)).toContain("Key 2");
    });

    it("should not return keys from other tenants (isolation)", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create({ name: "Other Tenant" });

      // Create keys for both tenants
      await apiKeyFactory.createForTenant(tenant1.id, { name: "Tenant 1 Key" });
      await apiKeyFactory.createForTenant(tenant2.id, { name: "Tenant 2 Key" });

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      const result = await caller.apiKey.list();

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Tenant 1 Key");
    });

    it("should reject unauthenticated requests", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.apiKey.list()).rejects.toThrow(TRPCError);
    });

    it("should return keys ordered by createdAt descending", async () => {
      const { user, tenant } = await userFactory.createWithTenant();

      // Create keys with specific timestamps
      const oldDate = new Date("2024-01-01");
      const newDate = new Date("2024-06-01");

      await apiKeyFactory.createForTenant(tenant.id, {
        name: "Old Key",
        createdAt: oldDate,
      });
      await apiKeyFactory.createForTenant(tenant.id, {
        name: "New Key",
        createdAt: newDate,
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.apiKey.list();

      expect(result[0]?.name).toBe("New Key");
      expect(result[1]?.name).toBe("Old Key");
    });
  });

  describe("create", () => {
    it("should create a new API key", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.apiKey.create({
        name: "My New Key",
        environment: "PRODUCTION",
      });

      expect(result.apiKey.name).toBe("My New Key");
      expect(result.apiKey.environment).toBe("PRODUCTION");
      expect(result.plainTextKey).toMatch(/^pil_live_[a-f0-9]{64}$/);
    });

    it("should create sandbox key with correct prefix", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.apiKey.create({
        name: "Sandbox Key",
        environment: "SANDBOX",
      });

      expect(result.apiKey.environment).toBe("SANDBOX");
      expect(result.plainTextKey).toMatch(/^pil_test_[a-f0-9]{64}$/);
    });

    it("should set default scopes", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.apiKey.create({
        name: "Default Scopes Key",
        environment: "PRODUCTION",
      });

      expect(result.apiKey.scopes).toContain("process:*");
    });

    it("should accept custom scopes", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.apiKey.create({
        name: "Custom Scopes Key",
        environment: "PRODUCTION",
        scopes: ["read:only", "webhook:trigger"],
      });

      expect(result.apiKey.scopes).toEqual(["read:only", "webhook:trigger"]);
    });

    it("should set expiration date when provided", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const expiresAt = new Date("2025-12-31");
      const result = await caller.apiKey.create({
        name: "Expiring Key",
        environment: "PRODUCTION",
        expiresAt,
      });

      expect(result.apiKey.expiresAt?.toISOString()).toBe(
        expiresAt.toISOString()
      );
    });

    it("should create audit log entry", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.apiKey.create({
        name: "Audited Key",
        environment: "PRODUCTION",
      });

      // Wait briefly for fire-and-forget audit log
      await new Promise((r) => setTimeout(r, 100));

      const auditLogs = await testDb.auditLog.findMany({
        where: {
          tenantId: tenant.id,
          action: "apiKey.created",
          resourceId: result.apiKey.id,
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
        caller.apiKey.create({
          name: "",
          environment: "PRODUCTION",
        })
      ).rejects.toThrow();
    });
  });

  describe("rotate", () => {
    it("should rotate an existing key", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { apiKey: originalKey } = await apiKeyFactory.createForTenant(
        tenant.id,
        { name: "Rotatable Key" }
      );

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.apiKey.rotate({ id: originalKey.id });

      // New key should have same name but different ID
      expect(result.apiKey.id).not.toBe(originalKey.id);
      expect(result.apiKey.name).toBe("Rotatable Key");
      expect(result.plainTextKey).toMatch(/^pil_live_[a-f0-9]{64}$/);
    });

    it("should revoke old key after rotation", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { apiKey: originalKey } = await apiKeyFactory.createForTenant(
        tenant.id
      );

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await caller.apiKey.rotate({ id: originalKey.id });

      // Check old key is revoked
      const oldKey = await testDb.apiKey.findUnique({
        where: { id: originalKey.id },
      });

      expect(oldKey?.revokedAt).not.toBeNull();
    });

    it("should preserve environment on rotation", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { apiKey: sandboxKey } = await apiKeyFactory.createForTenant(
        tenant.id,
        { environment: "SANDBOX" }
      );

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.apiKey.rotate({ id: sandboxKey.id });

      expect(result.apiKey.environment).toBe("SANDBOX");
      expect(result.plainTextKey).toMatch(/^pil_test_/);
    });

    it("should reject rotation of non-existent key", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.apiKey.rotate({ id: "key_nonexistent" })
      ).rejects.toThrow(TRPCError);
    });

    it("should reject rotation of already revoked key", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { apiKey } = await apiKeyFactory.createForTenant(tenant.id, {
        revokedAt: new Date(),
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(caller.apiKey.rotate({ id: apiKey.id })).rejects.toThrow(
        TRPCError
      );
    });

    it("should reject rotation of another tenant's key", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create();
      const { apiKey: tenant2Key } = await apiKeyFactory.createForTenant(
        tenant2.id
      );

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.apiKey.rotate({ id: tenant2Key.id })
      ).rejects.toThrow(TRPCError);
    });

    it("should create audit log for rotation", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { apiKey: originalKey } = await apiKeyFactory.createForTenant(
        tenant.id
      );

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.apiKey.rotate({ id: originalKey.id });

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 100));

      const auditLog = await testDb.auditLog.findFirst({
        where: {
          tenantId: tenant.id,
          action: "apiKey.rotated",
          resourceId: result.apiKey.id,
        },
      });

      expect(auditLog).not.toBeNull();
      expect((auditLog?.metadata as { oldKeyId?: string })?.oldKeyId).toBe(
        originalKey.id
      );
    });
  });

  describe("revoke", () => {
    it("should revoke an existing key", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { apiKey } = await apiKeyFactory.createForTenant(tenant.id);

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.apiKey.revoke({ id: apiKey.id });

      expect(result.success).toBe(true);

      // Verify in database
      const revokedKey = await testDb.apiKey.findUnique({
        where: { id: apiKey.id },
      });
      expect(revokedKey?.revokedAt).not.toBeNull();
    });

    it("should reject revoking non-existent key", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.apiKey.revoke({ id: "key_nonexistent" })
      ).rejects.toThrow(TRPCError);
    });

    it("should reject revoking already revoked key", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { apiKey } = await apiKeyFactory.createForTenant(tenant.id, {
        revokedAt: new Date(),
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(caller.apiKey.revoke({ id: apiKey.id })).rejects.toThrow(
        TRPCError
      );
    });

    it("should reject revoking another tenant's key", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create();
      const { apiKey: tenant2Key } = await apiKeyFactory.createForTenant(
        tenant2.id
      );

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.apiKey.revoke({ id: tenant2Key.id })
      ).rejects.toThrow(TRPCError);
    });

    it("should create audit log for revocation", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { apiKey } = await apiKeyFactory.createForTenant(tenant.id);

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await caller.apiKey.revoke({ id: apiKey.id });

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 100));

      const auditLog = await testDb.auditLog.findFirst({
        where: {
          tenantId: tenant.id,
          action: "apiKey.revoked",
          resourceId: apiKey.id,
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.userId).toBe(user.id);
    });
  });

  describe("update", () => {
    it("should update key name", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { apiKey } = await apiKeyFactory.createForTenant(tenant.id, {
        name: "Original Name",
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.apiKey.update({
        id: apiKey.id,
        name: "Updated Name",
      });

      expect(result.apiKey.name).toBe("Updated Name");
    });

    it("should reject update for non-existent key", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.apiKey.update({
          id: "key_nonexistent",
          name: "New Name",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should reject update for another tenant's key", async () => {
      const { user: user1, tenant: tenant1 } =
        await userFactory.createWithTenant();
      const tenant2 = await tenantFactory.create();
      const { apiKey: tenant2Key } = await apiKeyFactory.createForTenant(
        tenant2.id
      );

      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.apiKey.update({
          id: tenant2Key.id,
          name: "Hijacked Name",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should reject empty name", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { apiKey } = await apiKeyFactory.createForTenant(tenant.id);

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.apiKey.update({
          id: apiKey.id,
          name: "",
        })
      ).rejects.toThrow();
    });

    it("should allow updating revoked key name", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { apiKey } = await apiKeyFactory.createForTenant(tenant.id, {
        name: "Revoked Key",
        revokedAt: new Date(),
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.apiKey.update({
        id: apiKey.id,
        name: "Renamed Revoked Key",
      });

      expect(result.apiKey.name).toBe("Renamed Revoked Key");
    });
  });
});
