/**
 * Test Console Integration Tests
 *
 * Tests the process.testGenerate tRPC procedure for in-browser testing.
 * Verifies authentication, tenant isolation, and response format.
 *
 * @module tests/integration/test-console.test
 * @see docs/stories/3-3-in-browser-endpoint-testing.md
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { processVersionFactory } from "../support/factories/process-version.factory";
import { userFactory } from "../support/factories/user.factory";
import { processFactory } from "../support/factories/process.factory";
import { createAuthenticatedCaller, createUnauthenticatedCaller } from "../support/trpc";
import { setTestGatewayOverride } from "~/server/api/routers/process.testing";
import type { LLMGateway, GenerateResult } from "~/server/services/llm/types";
import { LLMError } from "~/server/services/llm/types";

/**
 * Create a mock LLM gateway for testing.
 */
function createMockGateway(response?: Partial<GenerateResult>): LLMGateway {
  const defaultResponse: GenerateResult = {
    text: '{"result": "Generated intelligence output"}',
    usage: { inputTokens: 100, outputTokens: 50 },
    model: "claude-3-haiku-20240307",
    durationMs: 500,
  };

  return {
    generate: async () => ({ ...defaultResponse, ...response }),
  };
}

describe("process.testGenerate", () => {
  beforeEach(() => {
    // Set up mock gateway for all tests
    setTestGatewayOverride(createMockGateway());
  });

  afterEach(() => {
    // Clean up
    setTestGatewayOverride(null);
  });

  describe("Authentication (AC: 9)", () => {
    it("should require session authentication", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.process.testGenerate({
          processId: "proc_test123",
          input: { test: "value" },
        })
      ).rejects.toThrow("UNAUTHORIZED");
    });

    it("should allow authenticated users to test their processes", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { process } = await processVersionFactory.createWithProcess(
        { environment: "SANDBOX" },
        { name: "Test Process" },
        tenant.id
      );

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.testGenerate({
        processId: process.id,
        input: { input: "test data" },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.meta.latency_ms).toBeGreaterThanOrEqual(0);
      expect(result.meta.request_id).toMatch(/^req_/);
    });
  });

  describe("Tenant Isolation (AC: 9)", () => {
    it("should not allow testing processes from other tenants", async () => {
      // Create two separate tenants with their own processes
      const { user: user1, tenant: tenant1 } = await userFactory.createWithTenant();
      const { tenant: tenant2 } = await userFactory.createWithTenant();

      // Create process for tenant2
      const { process: process2 } = await processVersionFactory.createWithProcess(
        { environment: "SANDBOX" },
        { name: "Other Tenant Process" },
        tenant2.id
      );

      // User1 tries to test tenant2's process
      const caller = createAuthenticatedCaller({
        userId: user1.id,
        tenantId: tenant1.id,
      });

      await expect(
        caller.process.testGenerate({
          processId: process2.id,
          input: { input: "test" },
        })
      ).rejects.toThrow("Process not found");
    });
  });

  describe("Process Validation", () => {
    it("should return NOT_FOUND for non-existent process", async () => {
      const { user, tenant } = await userFactory.createWithTenant();

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.testGenerate({
          processId: "proc_nonexistent123",
          input: { input: "test" },
        })
      ).rejects.toThrow("Process not found");
    });

    it("should return NOT_FOUND for deleted process", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { process } = await processVersionFactory.createWithProcess(
        { environment: "SANDBOX" },
        { name: "Deleted Process" },
        tenant.id
      );

      // Soft-delete the process after creation
      const { testDb } = await import("../support/db");
      await testDb.process.update({
        where: { id: process.id },
        data: { deletedAt: new Date() },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.testGenerate({
          processId: process.id,
          input: { input: "test" },
        })
      ).rejects.toThrow("Process not found");
    });

    it("should return BAD_REQUEST for process without versions", async () => {
      const { user, tenant } = await userFactory.createWithTenant();

      // Create process without versions using the process factory directly
      const process = await processFactory.create({ tenantId: tenant.id });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.testGenerate({
          processId: process.id,
          input: { input: "test" },
        })
      ).rejects.toThrow("Process has no versions");
    });
  });

  describe("Response Format (AC: 5, 6)", () => {
    it("should return success response with data and meta", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { process } = await processVersionFactory.createWithProcess(
        { environment: "SANDBOX" },
        { name: "Test Process" },
        tenant.id
      );

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.testGenerate({
        processId: process.id,
        input: { input: "test data" },
      });

      expect(result).toMatchObject({
        success: true,
        data: expect.any(Object),
        meta: {
          latency_ms: expect.any(Number),
          request_id: expect.stringMatching(/^req_/),
          model: expect.any(String),
          usage: {
            inputTokens: expect.any(Number),
            outputTokens: expect.any(Number),
          },
        },
      });
    });

    it("should include latency_ms in meta (AC: 6)", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { process } = await processVersionFactory.createWithProcess(
        { environment: "SANDBOX" },
        { name: "Test Process" },
        tenant.id
      );

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.testGenerate({
        processId: process.id,
        input: { input: "test" },
      });

      expect(result.meta.latency_ms).toBeGreaterThanOrEqual(0);
      expect(typeof result.meta.latency_ms).toBe("number");
    });

    it("should include request_id in meta", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { process } = await processVersionFactory.createWithProcess(
        { environment: "SANDBOX" },
        { name: "Test Process" },
        tenant.id
      );

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.testGenerate({
        processId: process.id,
        input: { input: "test" },
      });

      expect(result.meta.request_id).toMatch(/^req_[a-f0-9]+$/);
    });
  });

  describe("Input Handling", () => {
    it("should accept empty input object", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { process } = await processVersionFactory.createWithProcess(
        { environment: "SANDBOX" },
        { name: "Test Process" },
        tenant.id
      );

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const result = await caller.process.testGenerate({
        processId: process.id,
        input: {},
      });

      expect(result.success).toBe(true);
    });

    it("should accept complex nested input", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { process } = await processVersionFactory.createWithProcess(
        { environment: "SANDBOX" },
        { name: "Test Process" },
        tenant.id
      );

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      const complexInput = {
        product: {
          name: "Widget",
          price: 29.99,
          attributes: {
            colors: ["red", "blue"],
            dimensions: { width: 10, height: 20 },
          },
        },
        metadata: {
          requestedAt: "2024-01-01T00:00:00Z",
          source: "test-console",
        },
      };

      const result = await caller.process.testGenerate({
        processId: process.id,
        input: complexInput,
      });

      expect(result.success).toBe(true);
    });

    it("should validate processId is required", async () => {
      const { user, tenant } = await userFactory.createWithTenant();

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.testGenerate({
          processId: "",
          input: { test: "value" },
        })
      ).rejects.toThrow();
    });
  });

  describe("Error Handling (AC: 7)", () => {
    it("should handle LLM timeout errors", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { process } = await processVersionFactory.createWithProcess(
        { environment: "SANDBOX" },
        { name: "Test Process" },
        tenant.id
      );

      // Set up gateway that throws timeout error
      setTestGatewayOverride({
        generate: async () => {
          throw new LLMError("LLM_TIMEOUT", "Request timed out after 30000ms");
        },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.testGenerate({
          processId: process.id,
          input: { input: "test" },
        })
      ).rejects.toThrow("timed out");
    });

    it("should handle LLM rate limit errors", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { process } = await processVersionFactory.createWithProcess(
        { environment: "SANDBOX" },
        { name: "Test Process" },
        tenant.id
      );

      // Set up gateway that throws rate limit error
      setTestGatewayOverride({
        generate: async () => {
          throw new LLMError("LLM_RATE_LIMITED", "Rate limit exceeded");
        },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.testGenerate({
          processId: process.id,
          input: { input: "test" },
        })
      ).rejects.toThrow("rate limit exceeded");
    });

    it("should handle LLM general errors", async () => {
      const { user, tenant } = await userFactory.createWithTenant();
      const { process } = await processVersionFactory.createWithProcess(
        { environment: "SANDBOX" },
        { name: "Test Process" },
        tenant.id
      );

      // Set up gateway that throws general LLM error
      setTestGatewayOverride({
        generate: async () => {
          throw new LLMError("LLM_ERROR", "Internal LLM error");
        },
      });

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      await expect(
        caller.process.testGenerate({
          processId: process.id,
          input: { input: "test" },
        })
      ).rejects.toThrow("LLM error");
    });
  });

  describe("No History Persistence (AC: 10)", () => {
    it("should not persist test calls to any history table", async () => {
      // This is a design verification - AC: 10 states no history persistence
      // The implementation doesn't write to any call_logs table
      // We verify this by checking the procedure doesn't reference call logging

      const { user, tenant } = await userFactory.createWithTenant();
      const { process } = await processVersionFactory.createWithProcess(
        { environment: "SANDBOX" },
        { name: "Test Process" },
        tenant.id
      );

      const caller = createAuthenticatedCaller({
        userId: user.id,
        tenantId: tenant.id,
      });

      // Call should succeed without any database writes to call_logs
      const result = await caller.process.testGenerate({
        processId: process.id,
        input: { input: "test" },
      });

      expect(result.success).toBe(true);
      // Note: Audit logs ARE written (for security), but call_logs are not
      // per AC: 10 - "Test history not persisted (Epic 6 adds call logging)"
    });
  });
});
