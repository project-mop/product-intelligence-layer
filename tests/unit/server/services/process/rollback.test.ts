/**
 * Rollback Service Unit Tests
 *
 * Tests the rollback functionality for process versions.
 * Uses mocked database for fast execution.
 *
 * Story 5.4 AC: 7, 8, 9, 10 - Restore creates new sandbox version
 *
 * @module tests/unit/server/services/process/rollback.test
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// Mock the database
vi.mock("~/server/db", () => ({
  db: {
    $transaction: vi.fn(),
  },
}));

// Mock the ID generators
vi.mock("~/lib/id", () => ({
  generateProcessVersionId: vi.fn(() => "procv_newrollback123"),
  generateAuditId: vi.fn(() => "audit_rollback123"),
}));

import { rollbackToVersion } from "~/server/services/process/rollback";
import { db } from "~/server/db";

// Helper to create mock transaction functions
function createMockTransaction() {
  const mockProcessVersion = {
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  };
  const mockAuditLog = {
    create: vi.fn(),
  };

  const tx = {
    processVersion: mockProcessVersion,
    auditLog: mockAuditLog,
  };

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: tx as any,
    mockProcessVersion,
    mockAuditLog,
  };
}

describe("rollbackToVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("should throw NOT_FOUND when target version does not exist", async () => {
      const { tx, mockProcessVersion } = createMockTransaction();
      mockProcessVersion.findFirst.mockResolvedValue(null);

      vi.mocked(db.$transaction).mockImplementation(async (callback) => {
        return callback(tx);
      });

      await expect(
        rollbackToVersion(
          {
            processId: "proc_test123",
            targetVersionId: "procv_nonexistent",
          },
          {
            tenantId: "tenant_test123",
            userId: "user_test123",
          }
        )
      ).rejects.toThrow(TRPCError);

      await expect(
        rollbackToVersion(
          {
            processId: "proc_test123",
            targetVersionId: "procv_nonexistent",
          },
          {
            tenantId: "tenant_test123",
            userId: "user_test123",
          }
        )
      ).rejects.toThrow("Version not found");
    });

    it("should throw BAD_REQUEST when rolling back to current active sandbox", async () => {
      const targetVersion = {
        id: "procv_current123",
        processId: "proc_test123",
        version: "2.0.0",
        environment: "SANDBOX",
        status: "ACTIVE",
        config: { systemPrompt: "Test" },
      };

      const { tx, mockProcessVersion } = createMockTransaction();

      // Target version lookup
      mockProcessVersion.findFirst.mockImplementation(async (query) => {
        if (query?.where?.id === "procv_current123") {
          return targetVersion;
        }
        // Current sandbox lookup - same as target
        if (query?.where?.environment === "SANDBOX") {
          return targetVersion;
        }
        return null;
      });

      vi.mocked(db.$transaction).mockImplementation(async (callback) => {
        return callback(tx);
      });

      await expect(
        rollbackToVersion(
          {
            processId: "proc_test123",
            targetVersionId: "procv_current123",
          },
          {
            tenantId: "tenant_test123",
            userId: "user_test123",
          }
        )
      ).rejects.toThrow("Cannot rollback to the current active sandbox version");
    });
  });

  describe("successful rollback", () => {
    it("should create new sandbox version with copied config", async () => {
      const targetVersion = {
        id: "procv_target123",
        processId: "proc_test123",
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
        config: { systemPrompt: "Original prompt", temperature: 0.7 },
      };

      const currentSandbox = {
        id: "procv_current123",
        processId: "proc_test123",
        version: "2.0.0",
        environment: "SANDBOX",
        status: "ACTIVE",
      };

      const newVersion = {
        id: "procv_newrollback123",
        processId: "proc_test123",
        version: "3.0.0",
        environment: "SANDBOX",
        status: "ACTIVE",
        config: targetVersion.config,
        publishedAt: expect.any(Date),
        changeNotes: "Restored from version 1.0.0",
        promotedBy: "user_test123",
      };

      const { tx, mockProcessVersion, mockAuditLog } = createMockTransaction();

      let findFirstCallCount = 0;
      mockProcessVersion.findFirst.mockImplementation(async () => {
        findFirstCallCount++;
        if (findFirstCallCount === 1) return targetVersion;
        if (findFirstCallCount === 2) return currentSandbox;
        return null;
      });

      mockProcessVersion.findMany.mockResolvedValue([
        { version: "1.0.0" },
        { version: "2.0.0" },
      ]);

      mockProcessVersion.update.mockResolvedValue({
        ...currentSandbox,
        status: "DEPRECATED",
        deprecatedAt: new Date(),
      });

      mockProcessVersion.create.mockResolvedValue(newVersion);
      mockAuditLog.create.mockResolvedValue({ id: "audit_rollback123" });

      vi.mocked(db.$transaction).mockImplementation(async (callback) => {
        return callback(tx);
      });

      const result = await rollbackToVersion(
        {
          processId: "proc_test123",
          targetVersionId: "procv_target123",
        },
        {
          tenantId: "tenant_test123",
          userId: "user_test123",
        }
      );

      // Verify new version was created
      expect(mockProcessVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "procv_newrollback123",
          processId: "proc_test123",
          version: "3.0.0",
          config: targetVersion.config,
          environment: "SANDBOX",
          status: "ACTIVE",
          changeNotes: "Restored from version 1.0.0",
          promotedBy: "user_test123",
        }),
      });

      expect(result.newVersion).toBeDefined();
      expect(result.sourceVersion).toEqual(targetVersion);
    });

    it("should deprecate current sandbox version if exists", async () => {
      const targetVersion = {
        id: "procv_target123",
        processId: "proc_test123",
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
        config: { systemPrompt: "Test" },
      };

      const currentSandbox = {
        id: "procv_current123",
        processId: "proc_test123",
        version: "2.0.0",
        environment: "SANDBOX",
        status: "ACTIVE",
      };

      const { tx, mockProcessVersion, mockAuditLog } = createMockTransaction();

      let findFirstCallCount = 0;
      mockProcessVersion.findFirst.mockImplementation(async () => {
        findFirstCallCount++;
        if (findFirstCallCount === 1) return targetVersion;
        if (findFirstCallCount === 2) return currentSandbox;
        return null;
      });

      mockProcessVersion.findMany.mockResolvedValue([
        { version: "1.0.0" },
        { version: "2.0.0" },
      ]);

      mockProcessVersion.update.mockResolvedValue({
        ...currentSandbox,
        status: "DEPRECATED",
        deprecatedAt: new Date(),
      });

      mockProcessVersion.create.mockResolvedValue({
        id: "procv_newrollback123",
        version: "3.0.0",
        environment: "SANDBOX",
        status: "ACTIVE",
      });

      mockAuditLog.create.mockResolvedValue({ id: "audit_rollback123" });

      vi.mocked(db.$transaction).mockImplementation(async (callback) => {
        return callback(tx);
      });

      const result = await rollbackToVersion(
        {
          processId: "proc_test123",
          targetVersionId: "procv_target123",
        },
        {
          tenantId: "tenant_test123",
          userId: "user_test123",
        }
      );

      // Verify current sandbox was deprecated
      expect(mockProcessVersion.update).toHaveBeenCalledWith({
        where: { id: "procv_current123" },
        data: {
          status: "DEPRECATED",
          deprecatedAt: expect.any(Date),
        },
      });

      expect(result.deprecatedVersion).toBeDefined();
      expect(result.deprecatedVersion?.status).toBe("DEPRECATED");
    });

    it("should allow rollback when no current sandbox exists", async () => {
      const targetVersion = {
        id: "procv_target123",
        processId: "proc_test123",
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "ACTIVE",
        config: { systemPrompt: "Test" },
      };

      const { tx, mockProcessVersion, mockAuditLog } = createMockTransaction();

      let findFirstCallCount = 0;
      mockProcessVersion.findFirst.mockImplementation(async () => {
        findFirstCallCount++;
        if (findFirstCallCount === 1) return targetVersion;
        return null; // No current sandbox
      });

      mockProcessVersion.findMany.mockResolvedValue([{ version: "1.0.0" }]);

      mockProcessVersion.create.mockResolvedValue({
        id: "procv_newrollback123",
        version: "2.0.0",
        environment: "SANDBOX",
        status: "ACTIVE",
      });

      mockAuditLog.create.mockResolvedValue({ id: "audit_rollback123" });

      vi.mocked(db.$transaction).mockImplementation(async (callback) => {
        return callback(tx);
      });

      const result = await rollbackToVersion(
        {
          processId: "proc_test123",
          targetVersionId: "procv_target123",
        },
        {
          tenantId: "tenant_test123",
          userId: "user_test123",
        }
      );

      // Should not try to deprecate anything
      expect(mockProcessVersion.update).not.toHaveBeenCalled();
      expect(result.deprecatedVersion).toBeNull();
    });

    it("should use custom change notes when provided", async () => {
      const targetVersion = {
        id: "procv_target123",
        processId: "proc_test123",
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
        config: { systemPrompt: "Test" },
      };

      const { tx, mockProcessVersion, mockAuditLog } = createMockTransaction();

      let findFirstCallCount = 0;
      mockProcessVersion.findFirst.mockImplementation(async () => {
        findFirstCallCount++;
        if (findFirstCallCount === 1) return targetVersion;
        return null;
      });

      mockProcessVersion.findMany.mockResolvedValue([{ version: "1.0.0" }]);

      mockProcessVersion.create.mockResolvedValue({
        id: "procv_newrollback123",
        version: "2.0.0",
        changeNotes: "Custom rollback reason",
      });

      mockAuditLog.create.mockResolvedValue({ id: "audit_rollback123" });

      vi.mocked(db.$transaction).mockImplementation(async (callback) => {
        return callback(tx);
      });

      await rollbackToVersion(
        {
          processId: "proc_test123",
          targetVersionId: "procv_target123",
          changeNotes: "Custom rollback reason",
        },
        {
          tenantId: "tenant_test123",
          userId: "user_test123",
        }
      );

      expect(mockProcessVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changeNotes: "Custom rollback reason",
        }),
      });
    });
  });

  describe("version numbering", () => {
    it("should calculate next version as max+1", async () => {
      const targetVersion = {
        id: "procv_target123",
        processId: "proc_test123",
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
        config: { systemPrompt: "Test" },
      };

      const { tx, mockProcessVersion, mockAuditLog } = createMockTransaction();

      let findFirstCallCount = 0;
      mockProcessVersion.findFirst.mockImplementation(async () => {
        findFirstCallCount++;
        if (findFirstCallCount === 1) return targetVersion;
        return null;
      });

      // Existing versions: 1.0.0, 2.0.0, 5.0.0
      mockProcessVersion.findMany.mockResolvedValue([
        { version: "1.0.0" },
        { version: "2.0.0" },
        { version: "5.0.0" },
      ]);

      mockProcessVersion.create.mockResolvedValue({
        id: "procv_newrollback123",
        version: "6.0.0",
      });

      mockAuditLog.create.mockResolvedValue({ id: "audit_rollback123" });

      vi.mocked(db.$transaction).mockImplementation(async (callback) => {
        return callback(tx);
      });

      await rollbackToVersion(
        {
          processId: "proc_test123",
          targetVersionId: "procv_target123",
        },
        {
          tenantId: "tenant_test123",
          userId: "user_test123",
        }
      );

      // Should be 6.0.0 (max 5 + 1)
      expect(mockProcessVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          version: "6.0.0",
        }),
      });
    });

    it("should handle versions with non-standard formats", async () => {
      const targetVersion = {
        id: "procv_target123",
        processId: "proc_test123",
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
        config: { systemPrompt: "Test" },
      };

      const { tx, mockProcessVersion, mockAuditLog } = createMockTransaction();

      let findFirstCallCount = 0;
      mockProcessVersion.findFirst.mockImplementation(async () => {
        findFirstCallCount++;
        if (findFirstCallCount === 1) return targetVersion;
        return null;
      });

      // Mix of version formats
      mockProcessVersion.findMany.mockResolvedValue([
        { version: "1.0.0" },
        { version: "2.1.3" },
        { version: "10.0.0" },
      ]);

      mockProcessVersion.create.mockResolvedValue({
        id: "procv_newrollback123",
        version: "11.0.0",
      });

      mockAuditLog.create.mockResolvedValue({ id: "audit_rollback123" });

      vi.mocked(db.$transaction).mockImplementation(async (callback) => {
        return callback(tx);
      });

      await rollbackToVersion(
        {
          processId: "proc_test123",
          targetVersionId: "procv_target123",
        },
        {
          tenantId: "tenant_test123",
          userId: "user_test123",
        }
      );

      // Should be 11.0.0 (max major version is 10)
      expect(mockProcessVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          version: "11.0.0",
        }),
      });
    });
  });

  describe("audit logging", () => {
    it("should create audit log entry with correct metadata", async () => {
      const targetVersion = {
        id: "procv_target123",
        processId: "proc_test123",
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
        config: { systemPrompt: "Test" },
      };

      const currentSandbox = {
        id: "procv_current123",
        processId: "proc_test123",
        version: "2.0.0",
        environment: "SANDBOX",
        status: "ACTIVE",
      };

      const { tx, mockProcessVersion, mockAuditLog } = createMockTransaction();

      let findFirstCallCount = 0;
      mockProcessVersion.findFirst.mockImplementation(async () => {
        findFirstCallCount++;
        if (findFirstCallCount === 1) return targetVersion;
        if (findFirstCallCount === 2) return currentSandbox;
        return null;
      });

      mockProcessVersion.findMany.mockResolvedValue([
        { version: "1.0.0" },
        { version: "2.0.0" },
      ]);

      mockProcessVersion.update.mockResolvedValue({
        ...currentSandbox,
        status: "DEPRECATED",
        deprecatedAt: new Date(),
      });

      mockProcessVersion.create.mockResolvedValue({
        id: "procv_newrollback123",
        version: "3.0.0",
        changeNotes: "Restored from version 1.0.0",
      });

      mockAuditLog.create.mockResolvedValue({ id: "audit_rollback123" });

      vi.mocked(db.$transaction).mockImplementation(async (callback) => {
        return callback(tx);
      });

      await rollbackToVersion(
        {
          processId: "proc_test123",
          targetVersionId: "procv_target123",
        },
        {
          tenantId: "tenant_test123",
          userId: "user_test123",
        }
      );

      expect(mockAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "audit_rollback123",
          tenantId: "tenant_test123",
          userId: "user_test123",
          action: "processVersion.rollback",
          resource: "processVersion",
          resourceId: "procv_newrollback123",
          metadata: expect.objectContaining({
            processId: "proc_test123",
            sourceVersionId: "procv_target123",
            sourceVersion: "1.0.0",
            newVersion: "3.0.0",
            deprecatedVersionId: "procv_current123",
          }),
        }),
      });
    });
  });
});
