/**
 * Intelligence API Integration Tests
 *
 * Tests the REST API endpoints for intelligence generation.
 * Verifies authentication, authorization, and response format.
 *
 * Uses direct route handler calls for fast, reliable testing.
 *
 * @module tests/integration/intelligence-api.test
 * @see docs/stories/3-1-endpoint-url-generation.md
 * @see docs/stories/3-2-llm-gateway-integration.md
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

import { tenantFactory } from "../support/factories";
import { processFactory } from "../support/factories/process.factory";
import { processVersionFactory } from "../support/factories/process-version.factory";
import { apiKeyFactory } from "../support/factories/api-key.factory";

// Import route handlers directly
import { POST as generateHandler } from "~/app/api/v1/intelligence/[processId]/generate/route";
import { setGatewayOverride } from "~/app/api/v1/intelligence/[processId]/generate/testing";
import { POST as sandboxGenerateHandler } from "~/app/api/v1/sandbox/intelligence/[processId]/generate/route";
import { setGatewayOverride as setSandboxGatewayOverride } from "~/app/api/v1/sandbox/intelligence/[processId]/generate/testing";
import { GET as schemaHandler } from "~/app/api/v1/intelligence/[processId]/schema/route";
import type { LLMGateway, GenerateParams, GenerateResult } from "~/server/services/llm/types";
import { LLMError } from "~/server/services/llm/types";

/**
 * Helper to create a NextRequest for testing.
 */
function createRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): NextRequest {
  const { method = "GET", headers = {}, body } = options;

  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Helper to create route params promise.
 */
function createParams(processId: string): { params: Promise<{ processId: string }> } {
  return { params: Promise.resolve({ processId }) };
}

describe("POST /api/v1/intelligence/:processId/generate", () => {
  describe("Authentication (AC: 5)", () => {
    it("should return 401 for missing Authorization header", async () => {
      const { process } = await processFactory.createWithTenant();

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toContain("Authorization");

      // Verify X-Request-Id header is present
      expect(response.headers.get("X-Request-Id")).toMatch(/^req_/);
    });

    it("should return 401 for invalid Bearer token format", async () => {
      const { process } = await processFactory.createWithTenant();

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "InvalidToken",
          },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for invalid API key format (not pil_live_ or pil_test_)", async () => {
      const { process } = await processFactory.createWithTenant();

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer invalid_key_format",
          },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for non-existent API key", async () => {
      const { process } = await processFactory.createWithTenant();

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer pil_live_nonexistentkey123456789012345678901234567890123456",
          },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for expired API key", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      // Create expired API key
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toContain("expired");
    });

    it("should return 401 for revoked API key", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      // Create revoked API key
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        revokedAt: new Date(),
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toContain("revoked");
    });
  });

  describe("Authorization (AC: 5)", () => {
    it("should return 403 for API key without process scope", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      // Create API key without process scope
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: [], // No scopes
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("Process Lookup (AC: 6)", () => {
    it("should return 404 for non-existent processId", async () => {
      const tenant = await tenantFactory.create();

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/proc_nonexistent123456/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams("proc_nonexistent123456"));

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("should return 404 for draft-only process (no published version)", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      // Note: No version created - process is draft-only

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toContain("No production version");
    });

    it("should return 404 for deleted process", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        deletedAt: new Date(),
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("should return 404 when accessing other tenant's process (tenant isolation)", async () => {
      // Create tenant1 with process
      const tenant1 = await tenantFactory.create({ name: "Tenant 1" });
      const process = await processFactory.create({ tenantId: tenant1.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      // Create tenant2 with API key
      const tenant2 = await tenantFactory.create({ name: "Tenant 2" });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant2.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      // Try to access tenant1's process with tenant2's key
      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("LLM Generation (AC: 1-10)", () => {
    /**
     * Create a mock LLM gateway for testing.
     */
    function createMockGateway(
      generateFn: (params: GenerateParams) => Promise<GenerateResult>
    ): LLMGateway {
      return {
        generate: vi.fn(generateFn),
      };
    }

    beforeEach(() => {
      // Clear any previous gateway override
      setGatewayOverride(null);
    });

    afterEach(() => {
      // Clear gateway override after each test
      setGatewayOverride(null);
    });

    it("should return 200 with generated data for valid request (AC: 1-5, 10)", async () => {
      // Set up mock gateway
      const mockGateway = createMockGateway(async () => ({
        text: '{"result": "generated content"}',
        usage: { inputTokens: 50, outputTokens: 20 },
        model: "claude-3-haiku",
        durationMs: 150,
      }));
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        outputSchema: null, // Skip output validation for basic generation test
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
        version: "1.0.0",
        publishedAt: new Date(),
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "test data" } }, // Matches default inputSchema
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ result: "generated content" });

      // Verify meta fields (AC: 10)
      expect(body.meta.version).toBe("1.0.0");
      expect(body.meta.request_id).toMatch(/^req_/);
      expect(typeof body.meta.latency_ms).toBe("number");
      expect(body.meta.latency_ms).toBeGreaterThanOrEqual(0);
      expect(body.meta.cached).toBe(false);

      // Verify request ID header
      expect(response.headers.get("X-Request-Id")).toMatch(/^req_/);
    });

    it("should work with SANDBOX environment key and SANDBOX version", async () => {
      const mockGateway = createMockGateway(async () => ({
        text: '{"sandbox": "result"}',
        usage: { inputTokens: 10, outputTokens: 5 },
        model: "claude-3-haiku",
        durationMs: 100,
      }));
      // Use sandbox gateway override for sandbox endpoint
      setSandboxGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        outputSchema: null, // Skip output validation
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "SANDBOX",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "SANDBOX",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/sandbox/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "sandbox test" } }, // Matches default inputSchema
        }
      );

      // Use sandbox handler for sandbox endpoint
      const response = await sandboxGenerateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toEqual({ sandbox: "result" });

      // Clean up sandbox gateway override
      setSandboxGatewayOverride(null);
    });

    it("should work with specific process scope", async () => {
      const mockGateway = createMockGateway(async () => ({
        text: '{"scoped": true}',
        usage: { inputTokens: 10, outputTokens: 5 },
        model: "claude-3-haiku",
        durationMs: 100,
      }));
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        outputSchema: null, // Skip output validation
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: [`process:${process.id}`],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "scoped test" } }, // Matches default inputSchema
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);
    });

    it("should return 503 on LLM timeout (AC: 8)", async () => {
      const mockGateway = createMockGateway(async () => {
        throw new LLMError("LLM_TIMEOUT", "Request timed out");
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "timeout test" } }, // Matches default inputSchema
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("LLM_TIMEOUT");
    });

    it("should return 503 on LLM API error (AC: 9)", async () => {
      const mockGateway = createMockGateway(async () => {
        throw new LLMError("LLM_ERROR", "API error");
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "error test" } }, // Matches default inputSchema
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("LLM_ERROR");
    });

    it("should return 500 on output parse failure after retry (AC: 6, 7)", async () => {
      // Return invalid JSON both times to trigger parse failure
      // Note: This tests the legacy JSON parse retry path (without outputSchema)
      // With outputSchema, OUTPUT_VALIDATION_FAILED would be thrown instead
      const mockGateway = createMockGateway(async () => ({
        text: "This is not valid JSON at all {{",
        usage: { inputTokens: 10, outputTokens: 5 },
        model: "claude-3-haiku",
        durationMs: 100,
      }));
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        outputSchema: null, // Skip output validation to test legacy parse failure
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "parse test" } }, // Matches default inputSchema
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("OUTPUT_PARSE_FAILED");
    });

    it("should succeed on retry when first response is invalid JSON (AC: 6)", async () => {
      let callCount = 0;
      const mockGateway = createMockGateway(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            text: "Not valid JSON",
            usage: { inputTokens: 10, outputTokens: 5 },
            model: "claude-3-haiku",
            durationMs: 100,
          };
        }
        return {
          text: '{"retried": true}',
          usage: { inputTokens: 15, outputTokens: 8 },
          model: "claude-3-haiku",
          durationMs: 150,
        };
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        outputSchema: null, // Skip output validation for retry test
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "retry test" } }, // Matches default inputSchema
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.data).toEqual({ retried: true });
      expect(callCount).toBe(2);
    });

    it("should return 400 for missing input field", async () => {
      const mockGateway = createMockGateway(async () => ({
        text: '{}',
        usage: { inputTokens: 10, outputTokens: 5 },
        model: "claude-3-haiku",
        durationMs: 100,
      }));
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: {}, // Missing input field
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("BAD_REQUEST");
      expect(body.error.message).toContain("input");
    });

    it("should return 400 for invalid input type", async () => {
      const mockGateway = createMockGateway(async () => ({
        text: '{}',
        usage: { inputTokens: 10, outputTokens: 5 },
        model: "claude-3-haiku",
        durationMs: 100,
      }));
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: "string instead of object" },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("BAD_REQUEST");
    });
  });

  describe("Response Format (AC: 1)", () => {
    it("should include X-Request-Id header in response", async () => {
      const { process } = await processFactory.createWithTenant();

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      const requestId = response.headers.get("X-Request-Id");
      expect(requestId).toBeTruthy();
      expect(requestId).toMatch(/^req_[a-f0-9]{16}$/);
    });
  });

  describe("Input Schema Validation (Story 4.1)", () => {
    /**
     * Create a mock LLM gateway for testing.
     */
    function createMockGateway(
      generateFn: (params: GenerateParams) => Promise<GenerateResult>
    ): LLMGateway {
      return {
        generate: vi.fn(generateFn),
      };
    }

    beforeEach(() => {
      setGatewayOverride(null);
    });

    afterEach(() => {
      setGatewayOverride(null);
    });

    it("should return 400 VALIDATION_ERROR for missing required field (AC: 1, 3, 4)", async () => {
      const tenant = await tenantFactory.create();
      const inputSchema = {
        type: "object",
        required: ["productName", "category"],
        properties: {
          productName: { type: "string", minLength: 1 },
          category: { type: "string" },
        },
      };
      const process = await processFactory.create({
        tenantId: tenant.id,
        inputSchema,
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { productName: "Widget" } }, // Missing category
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe("Input validation failed");
      expect(body.error.details.issues).toBeDefined();
      expect(body.error.details.issues.length).toBeGreaterThan(0);
      expect(body.error.details.issues[0].path).toEqual(["category"]);
    });

    it("should return all validation errors, not just the first (AC: 6)", async () => {
      const tenant = await tenantFactory.create();
      const inputSchema = {
        type: "object",
        required: ["productName", "category", "price"],
        properties: {
          productName: { type: "string", minLength: 1 },
          category: { type: "string" },
          price: { type: "number", minimum: 0 },
        },
      };
      const process = await processFactory.create({
        tenantId: tenant.id,
        inputSchema,
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: {} }, // Missing all required fields
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.details.issues.length).toBe(3);

      const paths = body.error.details.issues.map((i: { path: string[] }) => i.path[0]);
      expect(paths).toContain("productName");
      expect(paths).toContain("category");
      expect(paths).toContain("price");
    });

    it("should include field path and message in error details (AC: 4, 5)", async () => {
      const tenant = await tenantFactory.create();
      const inputSchema = {
        type: "object",
        required: ["attributes"],
        properties: {
          attributes: {
            type: "object",
            required: ["price"],
            properties: {
              price: { type: "number", minimum: 0 },
            },
          },
        },
      };
      const process = await processFactory.create({
        tenantId: tenant.id,
        inputSchema,
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { attributes: { price: -10 } } }, // Negative price
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.details.issues[0].path).toEqual(["attributes", "price"]);
      expect(typeof body.error.details.issues[0].message).toBe("string");
      expect(body.error.details.issues[0].message.length).toBeGreaterThan(0);
    });

    it("should pass validation and proceed to LLM for valid input (AC: 1, 7)", async () => {
      const mockGateway = createMockGateway(async () => ({
        text: '{"result": "success"}',
        usage: { inputTokens: 50, outputTokens: 20 },
        model: "claude-3-haiku",
        durationMs: 150,
      }));
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const inputSchema = {
        type: "object",
        required: ["productName"],
        properties: {
          productName: { type: "string", minLength: 1 },
          category: { type: "string" },
        },
      };
      const process = await processFactory.create({
        tenantId: tenant.id,
        inputSchema,
        outputSchema: null, // Skip output validation for input test
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { productName: "Widget", category: "Electronics" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ result: "success" });
    });

    it("should strip unknown fields from input (AC: 8)", async () => {
      const mockGateway = createMockGateway(async () => {
        return {
          text: '{"result": "processed"}',
          usage: { inputTokens: 50, outputTokens: 20 },
          model: "claude-3-haiku",
          durationMs: 150,
        };
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const inputSchema = {
        type: "object",
        required: ["productName"],
        properties: {
          productName: { type: "string" },
        },
      };
      const process = await processFactory.create({
        tenantId: tenant.id,
        inputSchema,
        outputSchema: null, // Skip output validation for input test
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: {
            input: {
              productName: "Widget",
              extraField: "should be stripped",
              anotherExtra: 123,
            },
          },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);
      // The extra fields should have been stripped and not caused an error
    });

    it("should coerce string to number (AC: 9)", async () => {
      const mockGateway = createMockGateway(async () => ({
        text: '{"result": "coerced"}',
        usage: { inputTokens: 50, outputTokens: 20 },
        model: "claude-3-haiku",
        durationMs: 150,
      }));
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const inputSchema = {
        type: "object",
        required: ["price"],
        properties: {
          price: { type: "number", minimum: 0 },
        },
      };
      const process = await processFactory.create({
        tenantId: tenant.id,
        inputSchema,
        outputSchema: null, // Skip output validation for input test
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { price: "19.99" } }, // String instead of number
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);
      // Type coercion should have converted "19.99" to 19.99
    });

    it("should skip validation when process has no inputSchema", async () => {
      const mockGateway = createMockGateway(async () => ({
        text: '{"result": "no schema"}',
        usage: { inputTokens: 50, outputTokens: 20 },
        model: "claude-3-haiku",
        durationMs: 150,
      }));
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        inputSchema: null, // No input schema
        outputSchema: null, // No output schema
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { anything: "goes" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);
    });

    it("should not call LLM on validation failure (AC: 3)", async () => {
      const mockGenerate = vi.fn();
      const mockGateway: LLMGateway = {
        generate: mockGenerate,
      };
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const inputSchema = {
        type: "object",
        required: ["productName"],
        properties: {
          productName: { type: "string", minLength: 1 },
        },
      };
      const process = await processFactory.create({
        tenantId: tenant.id,
        inputSchema,
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: {} }, // Missing required field
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(400);
      // LLM should NOT have been called
      expect(mockGenerate).not.toHaveBeenCalled();
    });
  });
});

describe("Output Schema Enforcement (Story 4.2)", () => {
  /**
   * Create a mock LLM gateway for testing.
   */
  function createMockGateway(responses: Array<{ text: string }>): LLMGateway {
    let callIndex = 0;
    return {
      generate: vi.fn().mockImplementation(async () => {
        const response = responses[callIndex] ?? responses[responses.length - 1];
        callIndex++;
        return {
          text: response?.text ?? '{}',
          usage: { inputTokens: 50, outputTokens: 20 },
          model: "claude-3-haiku",
          durationMs: 150,
        };
      }),
    };
  }

  beforeEach(() => {
    setGatewayOverride(null);
  });

  afterEach(() => {
    setGatewayOverride(null);
  });

  it("should validate output against outputSchema (AC: 1, 2)", async () => {
    const mockGateway = createMockGateway([
      { text: '{"shortDescription": "A great product", "category": "Electronics"}' },
    ]);
    setGatewayOverride(mockGateway);

    const tenant = await tenantFactory.create();
    const outputSchema = {
      type: "object",
      required: ["shortDescription", "category"],
      properties: {
        shortDescription: { type: "string", minLength: 1 },
        category: { type: "string" },
      },
    };
    const process = await processFactory.create({
      tenantId: tenant.id,
      outputSchema,
    });
    await processVersionFactory.create({
      processId: process.id,
      environment: "PRODUCTION",
    });

    const { plainTextKey } = await apiKeyFactory.create({
      tenantId: tenant.id,
      environment: "PRODUCTION",
      scopes: ["process:*"],
    });

    const request = createRequest(
      `/api/v1/intelligence/${process.id}/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plainTextKey}`,
        },
        body: { input: { input: "test" } },
      }
    );

    const response = await generateHandler(request, createParams(process.id));

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      shortDescription: "A great product",
      category: "Electronics",
    });
  });

  it("should retry on JSON parse failure (AC: 3)", async () => {
    const mockGateway = createMockGateway([
      { text: "This is not valid JSON" }, // First attempt fails
      { text: '{"shortDescription": "Retried product"}' }, // Second attempt succeeds
    ]);
    setGatewayOverride(mockGateway);

    const tenant = await tenantFactory.create();
    const outputSchema = {
      type: "object",
      required: ["shortDescription"],
      properties: {
        shortDescription: { type: "string" },
      },
    };
    const process = await processFactory.create({
      tenantId: tenant.id,
      outputSchema,
    });
    await processVersionFactory.create({
      processId: process.id,
      environment: "PRODUCTION",
    });

    const { plainTextKey } = await apiKeyFactory.create({
      tenantId: tenant.id,
      environment: "PRODUCTION",
      scopes: ["process:*"],
    });

    const request = createRequest(
      `/api/v1/intelligence/${process.id}/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plainTextKey}`,
        },
        body: { input: { input: "retry test" } },
      }
    );

    const response = await generateHandler(request, createParams(process.id));

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data).toEqual({ shortDescription: "Retried product" });

    // Should have called LLM twice (initial + retry)
    expect(mockGateway.generate).toHaveBeenCalledTimes(2);
  });

  it("should retry on schema validation failure (AC: 4)", async () => {
    const mockGateway = createMockGateway([
      { text: '{"wrongField": "value"}' }, // First attempt - wrong schema
      { text: '{"shortDescription": "Correct this time"}' }, // Second attempt succeeds
    ]);
    setGatewayOverride(mockGateway);

    const tenant = await tenantFactory.create();
    const outputSchema = {
      type: "object",
      required: ["shortDescription"],
      properties: {
        shortDescription: { type: "string", minLength: 1 },
      },
    };
    const process = await processFactory.create({
      tenantId: tenant.id,
      outputSchema,
    });
    await processVersionFactory.create({
      processId: process.id,
      environment: "PRODUCTION",
    });

    const { plainTextKey } = await apiKeyFactory.create({
      tenantId: tenant.id,
      environment: "PRODUCTION",
      scopes: ["process:*"],
    });

    const request = createRequest(
      `/api/v1/intelligence/${process.id}/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plainTextKey}`,
        },
        body: { input: { input: "schema retry test" } },
      }
    );

    const response = await generateHandler(request, createParams(process.id));

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data).toEqual({ shortDescription: "Correct this time" });

    // Should have called LLM twice
    expect(mockGateway.generate).toHaveBeenCalledTimes(2);
  });

  it("should include schema in retry prompt (AC: 5)", async () => {
    const mockGateway = createMockGateway([
      { text: '{"wrong": "field"}' },
      { text: '{"shortDescription": "Fixed"}' },
    ]);
    setGatewayOverride(mockGateway);

    const tenant = await tenantFactory.create();
    const outputSchema = {
      type: "object",
      required: ["shortDescription"],
      properties: {
        shortDescription: { type: "string" },
      },
    };
    const process = await processFactory.create({
      tenantId: tenant.id,
      outputSchema,
    });
    await processVersionFactory.create({
      processId: process.id,
      environment: "PRODUCTION",
    });

    const { plainTextKey } = await apiKeyFactory.create({
      tenantId: tenant.id,
      environment: "PRODUCTION",
      scopes: ["process:*"],
    });

    const request = createRequest(
      `/api/v1/intelligence/${process.id}/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plainTextKey}`,
        },
        body: { input: { input: "prompt test" } },
      }
    );

    await generateHandler(request, createParams(process.id));

    // Check the retry call included schema in prompt
    const retryCalls = vi.mocked(mockGateway.generate).mock.calls;
    expect(retryCalls.length).toBe(2);

    const retryPrompt = retryCalls[1]?.[0]?.systemPrompt;
    expect(retryPrompt).toContain("PREVIOUS ATTEMPT FAILED VALIDATION");
    expect(retryPrompt).toContain("shortDescription");
  });

  it("should return 500 OUTPUT_VALIDATION_FAILED after two failures (AC: 6)", async () => {
    const mockGateway = createMockGateway([
      { text: '{"wrong": "field"}' }, // First attempt fails validation
      { text: '{"still": "wrong"}' }, // Second attempt also fails
    ]);
    setGatewayOverride(mockGateway);

    const tenant = await tenantFactory.create();
    const outputSchema = {
      type: "object",
      required: ["shortDescription"],
      properties: {
        shortDescription: { type: "string", minLength: 1 },
      },
    };
    const process = await processFactory.create({
      tenantId: tenant.id,
      outputSchema,
    });
    await processVersionFactory.create({
      processId: process.id,
      environment: "PRODUCTION",
    });

    const { plainTextKey } = await apiKeyFactory.create({
      tenantId: tenant.id,
      environment: "PRODUCTION",
      scopes: ["process:*"],
    });

    const request = createRequest(
      `/api/v1/intelligence/${process.id}/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plainTextKey}`,
        },
        body: { input: { input: "double failure test" } },
      }
    );

    const response = await generateHandler(request, createParams(process.id));

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("OUTPUT_VALIDATION_FAILED");
    expect(body.error.message).toBe("Failed to generate valid response after retry");
  });

  it("should include field-level error details (AC: 7)", async () => {
    const mockGateway = createMockGateway([
      { text: '{"shortDescription": ""}' }, // Empty string fails minLength
      { text: '{}' }, // Missing required field
    ]);
    setGatewayOverride(mockGateway);

    const tenant = await tenantFactory.create();
    const outputSchema = {
      type: "object",
      required: ["shortDescription"],
      properties: {
        shortDescription: { type: "string", minLength: 1 },
      },
    };
    const process = await processFactory.create({
      tenantId: tenant.id,
      outputSchema,
    });
    await processVersionFactory.create({
      processId: process.id,
      environment: "PRODUCTION",
    });

    const { plainTextKey } = await apiKeyFactory.create({
      tenantId: tenant.id,
      environment: "PRODUCTION",
      scopes: ["process:*"],
    });

    const request = createRequest(
      `/api/v1/intelligence/${process.id}/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plainTextKey}`,
        },
        body: { input: { input: "field error test" } },
      }
    );

    const response = await generateHandler(request, createParams(process.id));

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error.code).toBe("OUTPUT_VALIDATION_FAILED");
    expect(body.error.details).toBeDefined();
    expect(body.error.details.issues).toBeDefined();
    expect(Array.isArray(body.error.details.issues)).toBe(true);
    expect(body.error.details.issues.length).toBeGreaterThan(0);
    expect(body.error.details.issues[0]).toMatchObject({
      path: expect.any(Array),
      message: expect.any(String),
    });
  });

  it("should return typed output object on success (AC: 8)", async () => {
    const mockGateway = createMockGateway([
      { text: '{"shortDescription": "Widget X", "price": 29.99, "inStock": true}' },
    ]);
    setGatewayOverride(mockGateway);

    const tenant = await tenantFactory.create();
    const outputSchema = {
      type: "object",
      required: ["shortDescription"],
      properties: {
        shortDescription: { type: "string" },
        price: { type: "number" },
        inStock: { type: "boolean" },
      },
    };
    const process = await processFactory.create({
      tenantId: tenant.id,
      outputSchema,
    });
    await processVersionFactory.create({
      processId: process.id,
      environment: "PRODUCTION",
    });

    const { plainTextKey } = await apiKeyFactory.create({
      tenantId: tenant.id,
      environment: "PRODUCTION",
      scopes: ["process:*"],
    });

    const request = createRequest(
      `/api/v1/intelligence/${process.id}/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plainTextKey}`,
        },
        body: { input: { input: "typed output test" } },
      }
    );

    const response = await generateHandler(request, createParams(process.id));

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.shortDescription).toBe("Widget X");
    expect(body.data.price).toBe(29.99);
    expect(body.data.inStock).toBe(true);
    // Types should be preserved
    expect(typeof body.data.price).toBe("number");
    expect(typeof body.data.inStock).toBe("boolean");
  });

  it("should coerce types in output (AC: 9)", async () => {
    // LLM returns price as string, should be coerced to number
    const mockGateway = createMockGateway([
      { text: '{"shortDescription": "Widget", "price": "19.99"}' },
    ]);
    setGatewayOverride(mockGateway);

    const tenant = await tenantFactory.create();
    const outputSchema = {
      type: "object",
      required: ["shortDescription"],
      properties: {
        shortDescription: { type: "string" },
        price: { type: "number" },
      },
    };
    const process = await processFactory.create({
      tenantId: tenant.id,
      outputSchema,
    });
    await processVersionFactory.create({
      processId: process.id,
      environment: "PRODUCTION",
    });

    const { plainTextKey } = await apiKeyFactory.create({
      tenantId: tenant.id,
      environment: "PRODUCTION",
      scopes: ["process:*"],
    });

    const request = createRequest(
      `/api/v1/intelligence/${process.id}/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plainTextKey}`,
        },
        body: { input: { input: "coercion test" } },
      }
    );

    const response = await generateHandler(request, createParams(process.id));

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.price).toBe(19.99);
    expect(typeof body.data.price).toBe("number"); // Coerced from string
  });

  it("should skip output validation when process has no outputSchema", async () => {
    const mockGateway = createMockGateway([
      { text: '{"anything": "goes"}' },
    ]);
    setGatewayOverride(mockGateway);

    const tenant = await tenantFactory.create();
    const process = await processFactory.create({
      tenantId: tenant.id,
      outputSchema: null, // No output schema
    });
    await processVersionFactory.create({
      processId: process.id,
      environment: "PRODUCTION",
    });

    const { plainTextKey } = await apiKeyFactory.create({
      tenantId: tenant.id,
      environment: "PRODUCTION",
      scopes: ["process:*"],
    });

    const request = createRequest(
      `/api/v1/intelligence/${process.id}/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plainTextKey}`,
        },
        body: { input: { input: "no schema test" } },
      }
    );

    const response = await generateHandler(request, createParams(process.id));

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data).toEqual({ anything: "goes" });

    // Should only call LLM once (no validation retry needed)
    expect(mockGateway.generate).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/v1/intelligence/:processId/schema", () => {
  describe("Authentication (AC: 7)", () => {
    it("should return 401 for missing Authorization header", async () => {
      const { process } = await processFactory.createWithTenant();

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/schema`,
        { method: "GET" }
      );

      const response = await schemaHandler(request, createParams(process.id));

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for invalid Bearer token format", async () => {
      const { process } = await processFactory.createWithTenant();

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/schema`,
        {
          method: "GET",
          headers: {
            Authorization: "InvalidToken",
          },
        }
      );

      const response = await schemaHandler(request, createParams(process.id));

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for non-existent API key", async () => {
      const { process } = await processFactory.createWithTenant();

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/schema`,
        {
          method: "GET",
          headers: {
            Authorization: "Bearer pil_live_nonexistentkey123456789012345678901234567890123456",
          },
        }
      );

      const response = await schemaHandler(request, createParams(process.id));

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Authorization (AC: 7)", () => {
    it("should return 403 for API key without process scope", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      // Create API key without process scope
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: [], // No scopes
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/schema`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${plainTextKey}`,
          },
        }
      );

      const response = await schemaHandler(request, createParams(process.id));

      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 403 for API key scoped to different process", async () => {
      const tenant = await tenantFactory.create();
      const process1 = await processFactory.create({ tenantId: tenant.id });
      const process2 = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process1.id,
        environment: "PRODUCTION",
      });

      // Create API key scoped only to process2
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: [`process:${process2.id}`],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process1.id}/schema`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${plainTextKey}`,
          },
        }
      );

      const response = await schemaHandler(request, createParams(process1.id));

      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("Process Lookup (AC: 7)", () => {
    it("should return 404 for non-existent processId", async () => {
      const tenant = await tenantFactory.create();

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/proc_nonexistent123456/schema`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${plainTextKey}`,
          },
        }
      );

      const response = await schemaHandler(request, createParams("proc_nonexistent123456"));

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("should return 404 when accessing other tenant's process (tenant isolation)", async () => {
      // Create tenant1 with process
      const tenant1 = await tenantFactory.create({ name: "Tenant 1" });
      const process = await processFactory.create({ tenantId: tenant1.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });

      // Create tenant2 with API key
      const tenant2 = await tenantFactory.create({ name: "Tenant 2" });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant2.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      // Try to access tenant1's process with tenant2's key
      const request = createRequest(
        `/api/v1/intelligence/${process.id}/schema`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${plainTextKey}`,
          },
        }
      );

      const response = await schemaHandler(request, createParams(process.id));

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("Success Response (AC: 2)", () => {
    it("should return schema data for valid request", async () => {
      const tenant = await tenantFactory.create();
      const inputSchema = {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      };
      const outputSchema = {
        type: "object",
        properties: { result: { type: "string" } },
      };
      const process = await processFactory.create({
        tenantId: tenant.id,
        name: "Test Process",
        inputSchema,
        outputSchema,
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
        version: "2.0.0",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/schema`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${plainTextKey}`,
          },
        }
      );

      const response = await schemaHandler(request, createParams(process.id));

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.processId).toBe(process.id);
      expect(body.data.name).toBe("Test Process");
      expect(body.data.version).toBe("2.0.0");
      expect(body.data.inputSchema).toEqual(inputSchema);
      expect(body.data.outputSchema).toEqual(outputSchema);

      // Check meta fields
      expect(body.meta.version).toBe("1.0.0");
      expect(body.meta.request_id).toMatch(/^req_/);
      expect(typeof body.meta.latency_ms).toBe("number");
      expect(body.meta.cached).toBe(false);
    });

    it("should return 404 for draft-only process", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      // No version created - draft only

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
        scopes: ["process:*"],
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/schema`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${plainTextKey}`,
          },
        }
      );

      const response = await schemaHandler(request, createParams(process.id));

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});

/**
 * Story 4.3: Error Response Contract Tests
 *
 * Verifies all error responses follow the standard format:
 * { success: false, error: { code, message, details?, retry_after? } }
 *
 * Also verifies:
 * - Correct HTTP status codes for each error type
 * - Retry-After header for 429/503 responses
 * - No internal details leak in error messages
 *
 * @see docs/stories/4-3-error-response-contract.md
 */
describe("Story 4.3: Error Response Contract", () => {
  /**
   * Helper to create a mock gateway for testing.
   */
  function createMockGateway43(
    handler: (params: GenerateParams) => Promise<GenerateResult> | GenerateResult
  ): LLMGateway {
    return {
      generate: async (params: GenerateParams): Promise<GenerateResult> => {
        return handler(params);
      },
    };
  }

  beforeEach(() => {
    setGatewayOverride(null);
  });

  afterEach(() => {
    setGatewayOverride(null);
  });

  describe("Standard Error Response Format (AC#1)", () => {
    it("should return success: false for all errors", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      // Test 401 response
      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));
      const body = await response.json();

      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(typeof body.error.code).toBe("string");
      expect(typeof body.error.message).toBe("string");
    });

    it("should include X-Request-Id header on all error responses", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.headers.get("X-Request-Id")).toMatch(/^req_/);
    });
  });

  describe("HTTP 400 VALIDATION_ERROR (AC#2)", () => {
    it("should return 400 with VALIDATION_ERROR code for invalid input", async () => {
      const mockGateway = createMockGateway43(async () => ({
        text: "{}",
        model: "claude-3-haiku",
        durationMs: 100,
        usage: { inputTokens: 10, outputTokens: 5 },
      }));
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        inputSchema: {
          type: "object",
          properties: {
            productName: { type: "string" },
          },
          required: ["productName"],
        },
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: {} }, // Missing required productName
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe("Input validation failed");
      expect(body.error.details?.issues).toBeDefined();
    });
  });

  describe("HTTP 401 UNAUTHORIZED (AC#3)", () => {
    it("should return 401 with UNAUTHORIZED code for missing API key", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 with UNAUTHORIZED code for invalid API key", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer pil_test_invalid_key",
          },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("HTTP 403 FORBIDDEN (AC#4)", () => {
    it("should return 403 with FORBIDDEN code when API key lacks scope for process", async () => {
      const tenant = await tenantFactory.create();

      // Create two processes
      const process1 = await processFactory.create({ tenantId: tenant.id });
      const process2 = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process1.id,
        environment: "PRODUCTION",
      });
      await processVersionFactory.create({
        processId: process2.id,
        environment: "PRODUCTION",
      });

      // API key with scope only for process2 (not process1)
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: [`process:${process2.id}`], // Only has access to process2
        environment: "PRODUCTION",
      });

      // Try to access process1 (which the key doesn't have scope for)
      const request = createRequest(
        `/api/v1/intelligence/${process1.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "forbidden test" } },
        }
      );

      const response = await generateHandler(request, createParams(process1.id));

      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("HTTP 404 NOT_FOUND (AC#5)", () => {
    it("should return 404 with NOT_FOUND code for non-existent process", async () => {
      const tenant = await tenantFactory.create();
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/non-existent-process-id/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: {} },
        }
      );

      const response = await generateHandler(
        request,
        createParams("non-existent-process-id")
      );

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("should return 404 with NOT_FOUND code for unpublished process", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      // No published version created
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: {} },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("HTTP 500 OUTPUT_VALIDATION_FAILED (AC#7)", () => {
    it("should return 500 with OUTPUT_VALIDATION_FAILED when LLM output fails schema after retry", async () => {
      // Mock gateway that always returns invalid output
      let callCount = 0;
      const mockGateway = createMockGateway43(async () => {
        callCount++;
        return {
          text: '{"invalid": "output"}', // Missing required shortDescription
          model: "claude-3-haiku",
          durationMs: 100,
          usage: { inputTokens: 10, outputTokens: 5 },
        };
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        outputSchema: {
          type: "object",
          properties: {
            shortDescription: { type: "string" },
          },
          required: ["shortDescription"],
        },
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "output validation test" } }, // Matches default inputSchema
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("OUTPUT_VALIDATION_FAILED");
      expect(body.error.details?.issues).toBeDefined();

      // Should have retried
      expect(callCount).toBe(2);
    });
  });

  describe("HTTP 503 LLM_TIMEOUT with Retry-After (AC#8, AC#9)", () => {
    it("should return 503 with LLM_TIMEOUT code and Retry-After header", async () => {
      const mockGateway = createMockGateway43(async () => {
        throw new LLMError("LLM_TIMEOUT", "Request timed out");
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "timeout test" } }, // Matches default inputSchema
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(503);

      // Verify Retry-After header (AC#9)
      expect(response.headers.get("Retry-After")).toBe("30");

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("LLM_TIMEOUT");
      expect(body.error.retry_after).toBe(30);
    });
  });

  describe("HTTP 503 LLM_ERROR with Retry-After (AC#8, AC#9)", () => {
    it("should return 503 with LLM_ERROR code and Retry-After header", async () => {
      const mockGateway = createMockGateway43(async () => {
        throw new LLMError("LLM_ERROR", "Service unavailable");
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "llm error test" } }, // Matches default inputSchema
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(503);

      // Verify Retry-After header (AC#9)
      expect(response.headers.get("Retry-After")).toBe("30");

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("LLM_ERROR");
      expect(body.error.retry_after).toBe(30);
    });
  });

  describe("No Internal Details Leaked (AC#10)", () => {
    it("should not expose stack traces in error messages", async () => {
      const mockGateway = createMockGateway43(async () => {
        const error = new Error("Internal error at /src/api.ts:123");
        throw error;
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "sanitize test" } }, // Matches default inputSchema
        }
      );

      const response = await generateHandler(request, createParams(process.id));
      const body = await response.json();

      // Should not contain file paths
      expect(body.error.message).not.toMatch(/\/src\//);
      expect(body.error.message).not.toMatch(/\.ts/);
      expect(body.error.message).not.toMatch(/:\d+/);

      // Should have a sanitized, user-friendly message
      expect(body.success).toBe(false);
    });

    it("should return generic 500 for unknown errors without internal details", async () => {
      const mockGateway = createMockGateway43(async () => {
        throw new Error("Database connection failed at node_modules/pg/client.js:45");
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "unknown error test" } }, // Matches default inputSchema
        }
      );

      const response = await generateHandler(request, createParams(process.id));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe("INTERNAL_ERROR");
      expect(body.error.message).not.toContain("node_modules");
      expect(body.error.message).not.toContain(".js");
    });
  });
});

/**
 * Story 4.4: LLM Unavailability Handling Tests
 *
 * Tests circuit breaker integration with the LLM gateway:
 * - 503 responses include Retry-After header
 * - retry_after field in response body
 * - LLM_TIMEOUT and LLM_ERROR response formats
 *
 * Circuit breaker state machine is tested in unit tests.
 * @see tests/unit/server/services/llm/circuit-breaker.test.ts
 *
 * @see docs/stories/4-4-llm-unavailability-handling.md
 */
describe("Story 4.4: LLM Unavailability Handling", () => {
  /**
   * Helper to create a mock gateway for testing.
   */
  function createMockGateway44(
    handler: (params: GenerateParams) => Promise<GenerateResult> | GenerateResult
  ): LLMGateway {
    return {
      generate: async (params: GenerateParams): Promise<GenerateResult> => {
        return handler(params);
      },
    };
  }

  beforeEach(() => {
    setGatewayOverride(null);
  });

  afterEach(() => {
    setGatewayOverride(null);
  });

  describe("503 LLM_TIMEOUT Response Format (AC: 1, 2)", () => {
    it("should return 503 with code LLM_TIMEOUT on timeout", async () => {
      const mockGateway = createMockGateway44(async () => {
        throw new LLMError("LLM_TIMEOUT", "LLM request timed out after 30000ms");
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "timeout test" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("LLM_TIMEOUT");
      expect(body.error.retry_after).toBe(30);
    });

    it("should include Retry-After header on 503 timeout response", async () => {
      const mockGateway = createMockGateway44(async () => {
        throw new LLMError("LLM_TIMEOUT", "Request timed out");
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "timeout header test" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("30");
    });
  });

  describe("503 LLM_ERROR Response Format (AC: 3)", () => {
    it("should return 503 with code LLM_ERROR on API error", async () => {
      const mockGateway = createMockGateway44(async () => {
        throw new LLMError("LLM_ERROR", "Anthropic API server error");
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "api error test" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("LLM_ERROR");
      expect(body.error.retry_after).toBe(30);
    });

    it("should include Retry-After header on 503 error response", async () => {
      const mockGateway = createMockGateway44(async () => {
        throw new LLMError("LLM_ERROR", "Service unavailable");
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "error header test" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("30");
    });
  });

  describe("Dynamic Retry-After from Circuit Breaker (AC: 10)", () => {
    it("should use custom retryAfter value when provided in LLMError", async () => {
      // When circuit breaker is open, the gateway throws LLMError with custom retryAfter
      const mockGateway = createMockGateway44(async () => {
        // Simulate circuit breaker open - 25 seconds remaining
        throw new LLMError(
          "LLM_ERROR",
          "Service temporarily unavailable. Retry after 25 seconds.",
          undefined,
          25 // Custom retry after from circuit breaker
        );
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "circuit breaker test" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(503);

      // Should use the custom retryAfter value
      expect(response.headers.get("Retry-After")).toBe("25");

      const body = await response.json();
      expect(body.error.retry_after).toBe(25);
    });
  });

  describe("Response Body Format (AC: 2, 3)", () => {
    it("should include retry_after in response body for LLM_TIMEOUT", async () => {
      const mockGateway = createMockGateway44(async () => {
        throw new LLMError("LLM_TIMEOUT", "Timeout");
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "body format test" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));
      const body = await response.json();

      // Verify the exact response format per spec
      expect(body).toMatchObject({
        success: false,
        error: {
          code: "LLM_TIMEOUT",
          message: expect.any(String),
          retry_after: 30,
        },
      });
    });

    it("should include retry_after in response body for LLM_ERROR", async () => {
      const mockGateway = createMockGateway44(async () => {
        throw new LLMError("LLM_ERROR", "API Error");
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "error body format test" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));
      const body = await response.json();

      // Verify the exact response format per spec
      expect(body).toMatchObject({
        success: false,
        error: {
          code: "LLM_ERROR",
          message: expect.any(String),
          retry_after: 30,
        },
      });
    });
  });
});

/**
 * Story 4.5: Response Caching Tests
 *
 * Tests caching behavior for intelligence responses:
 * - Cache miss stores response and returns X-Cache: MISS
 * - Cache hit returns cached response with X-Cache: HIT and meta.cached: true
 * - Cache-Control: no-cache bypasses cache lookup
 * - Cache is tenant-isolated (tenant A can't hit tenant B's cache)
 * - Identical requests within TTL return same cached response
 * - Different inputs produce different cache keys
 *
 * @see docs/stories/4-5-response-caching.md
 */
describe("Story 4.5: Response Caching", () => {
  /**
   * Helper to create a mock gateway for caching tests.
   */
  function createMockGateway45(
    handler: (params: GenerateParams) => Promise<GenerateResult>
  ): LLMGateway {
    return {
      generate: vi.fn(handler),
    };
  }

  beforeEach(() => {
    setGatewayOverride(null);
  });

  afterEach(() => {
    setGatewayOverride(null);
  });

  describe("Cache Miss Flow (AC: 1, 5, 6)", () => {
    it("should return X-Cache: MISS header on first request", async () => {
      const mockGateway = createMockGateway45(async () => ({
        text: JSON.stringify({ result: "Fresh response" }),
        usage: { inputTokens: 10, outputTokens: 20 },
        model: "claude-3-haiku",
        durationMs: 100,
      }));
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        outputSchema: null, // Skip output validation
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
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
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "Widget" } }, // Matches default inputSchema
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Cache")).toBe("MISS");

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.meta.cached).toBe(false);
    });

    it("should store response in cache after LLM call", async () => {
      const mockGateway = createMockGateway45(async () => ({
        text: JSON.stringify({ result: "Cached data" }),
        usage: { inputTokens: 10, outputTokens: 20 },
        model: "claude-3-haiku",
        durationMs: 100,
      }));
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        outputSchema: null, // Skip output validation
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
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
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const requestInput = { input: "CacheTest" }; // Matches default inputSchema

      // First request - cache miss
      const request1 = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: requestInput },
        }
      );

      const response1 = await generateHandler(request1, createParams(process.id));
      expect(response1.status).toBe(200);
      expect(response1.headers.get("X-Cache")).toBe("MISS");

      // Verify LLM was called once
      expect(mockGateway.generate).toHaveBeenCalledTimes(1);
    });
  });

  describe("Cache Hit Flow (AC: 3, 4, 10)", () => {
    it("should return X-Cache: HIT header on subsequent identical request", async () => {
      let callCount = 0;
      const mockGateway = createMockGateway45(async () => {
        callCount++;
        return {
          text: JSON.stringify({ result: `Response ${callCount}` }),
          usage: { inputTokens: 10, outputTokens: 20 },
          model: "claude-3-haiku",
          durationMs: 100,
        };
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        outputSchema: null, // Skip output validation
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
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
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const requestInput = { input: "CacheHitTest" }; // Matches default inputSchema

      // First request - cache miss
      const request1 = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: requestInput },
        }
      );

      const response1 = await generateHandler(request1, createParams(process.id));
      expect(response1.status).toBe(200);
      expect(response1.headers.get("X-Cache")).toBe("MISS");
      const body1 = await response1.json();
      expect(body1.meta.cached).toBe(false);

      // Second request - should be cache hit
      const request2 = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: requestInput },
        }
      );

      const response2 = await generateHandler(request2, createParams(process.id));
      expect(response2.status).toBe(200);
      expect(response2.headers.get("X-Cache")).toBe("HIT");

      const body2 = await response2.json();
      expect(body2.success).toBe(true);
      expect(body2.meta.cached).toBe(true);
      // Should return the same data as first request
      expect(body2.data).toEqual(body1.data);

      // LLM should only be called once (cache hit skipped second call)
      expect(mockGateway.generate).toHaveBeenCalledTimes(1);
    });

    it("should return cached response within TTL window (AC: 10)", async () => {
      let callCount = 0;
      const mockGateway = createMockGateway45(async () => {
        callCount++;
        return {
          text: JSON.stringify({ result: `Generated ${callCount}` }),
          usage: { inputTokens: 10, outputTokens: 20 },
          model: "claude-3-haiku",
          durationMs: 100,
        };
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        outputSchema: null, // Skip output validation
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
        config: {
          systemPrompt: "Test",
          maxTokens: 100,
          temperature: 0.3,
          inputSchemaDescription: "",
          outputSchemaDescription: "",
          goal: "Test",
          cacheTtlSeconds: 900, // 15 min TTL
          cacheEnabled: true,
          requestsPerMinute: 60,
        },
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const requestInput = { input: "TTLTest" }; // Matches default inputSchema

      // Make 3 identical requests
      for (let i = 0; i < 3; i++) {
        const request = createRequest(
          `/api/v1/intelligence/${process.id}/generate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${plainTextKey}`,
            },
            body: { input: requestInput },
          }
        );

        const response = await generateHandler(request, createParams(process.id));
        expect(response.status).toBe(200);
      }

      // Only the first request should have called the LLM
      expect(mockGateway.generate).toHaveBeenCalledTimes(1);
    });
  });

  describe("Cache-Control: no-cache (AC: 8)", () => {
    it("should bypass cache when Cache-Control: no-cache header is present", async () => {
      let callCount = 0;
      const mockGateway = createMockGateway45(async () => {
        callCount++;
        return {
          text: JSON.stringify({ result: `Fresh ${callCount}` }),
          usage: { inputTokens: 10, outputTokens: 20 },
          model: "claude-3-haiku",
          durationMs: 100,
        };
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        outputSchema: null, // Skip output validation
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
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
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const requestInput = { input: "BypassTest" }; // Matches default inputSchema

      // First request - cache miss, stores in cache
      const request1 = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: requestInput },
        }
      );

      const response1 = await generateHandler(request1, createParams(process.id));
      expect(response1.status).toBe(200);
      expect(response1.headers.get("X-Cache")).toBe("MISS");

      // Second request with Cache-Control: no-cache - should bypass cache
      const request2 = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
            "Cache-Control": "no-cache",
          },
          body: { input: requestInput },
        }
      );

      const response2 = await generateHandler(request2, createParams(process.id));
      expect(response2.status).toBe(200);
      // Should be MISS because we bypassed cache
      expect(response2.headers.get("X-Cache")).toBe("MISS");

      const body2 = await response2.json();
      expect(body2.meta.cached).toBe(false);

      // LLM should have been called twice (bypass means fresh call)
      expect(mockGateway.generate).toHaveBeenCalledTimes(2);
    });
  });

  describe("Tenant Isolation (AC: 7)", () => {
    it("should not share cache between tenants", async () => {
      let callCount = 0;
      const mockGateway = createMockGateway45(async () => {
        callCount++;
        return {
          text: JSON.stringify({ result: `Response ${callCount}` }),
          usage: { inputTokens: 10, outputTokens: 20 },
          model: "claude-3-haiku",
          durationMs: 100,
        };
      });
      setGatewayOverride(mockGateway);

      // Create two tenants with identical processes
      const tenantA = await tenantFactory.create();
      const tenantB = await tenantFactory.create();

      const processA = await processFactory.create({
        tenantId: tenantA.id,
        outputSchema: null, // Skip output validation
      });
      const processB = await processFactory.create({
        tenantId: tenantB.id,
        outputSchema: null, // Skip output validation
      });

      await processVersionFactory.create({
        processId: processA.id,
        environment: "PRODUCTION",
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
      await processVersionFactory.create({
        processId: processB.id,
        environment: "PRODUCTION",
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

      const { plainTextKey: keyA } = await apiKeyFactory.create({
        tenantId: tenantA.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });
      const { plainTextKey: keyB } = await apiKeyFactory.create({
        tenantId: tenantB.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const sameInput = { input: "IsolationTest" }; // Matches default inputSchema

      // Tenant A makes a request
      const requestA = createRequest(
        `/api/v1/intelligence/${processA.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${keyA}`,
          },
          body: { input: sameInput },
        }
      );

      const responseA = await generateHandler(requestA, createParams(processA.id));
      expect(responseA.status).toBe(200);
      expect(responseA.headers.get("X-Cache")).toBe("MISS");

      // Tenant B makes same request - should NOT hit A's cache
      const requestB = createRequest(
        `/api/v1/intelligence/${processB.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${keyB}`,
          },
          body: { input: sameInput },
        }
      );

      const responseB = await generateHandler(requestB, createParams(processB.id));
      expect(responseB.status).toBe(200);
      // Should be MISS because tenant B has separate cache
      expect(responseB.headers.get("X-Cache")).toBe("MISS");

      // LLM should have been called twice (once per tenant)
      expect(mockGateway.generate).toHaveBeenCalledTimes(2);
    });
  });

  describe("Different Inputs (AC: 2)", () => {
    it("should produce different cache keys for different inputs", async () => {
      let callCount = 0;
      const mockGateway = createMockGateway45(async () => {
        callCount++;
        return {
          text: JSON.stringify({ result: `Response ${callCount}` }),
          usage: { inputTokens: 10, outputTokens: 20 },
          model: "claude-3-haiku",
          durationMs: 100,
        };
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        outputSchema: null, // Skip output validation
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
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
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      // First request
      const request1 = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "Widget A" } }, // Matches default inputSchema
        }
      );

      const response1 = await generateHandler(request1, createParams(process.id));
      expect(response1.headers.get("X-Cache")).toBe("MISS");

      // Second request with different input - should be cache miss
      const request2 = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "Widget B" } }, // Matches default inputSchema
        }
      );

      const response2 = await generateHandler(request2, createParams(process.id));
      expect(response2.headers.get("X-Cache")).toBe("MISS");

      // LLM should have been called twice (different inputs)
      expect(mockGateway.generate).toHaveBeenCalledTimes(2);
    });
  });

  describe("Cache Disabled (AC: 5)", () => {
    it("should skip caching when cacheEnabled is false", async () => {
      let callCount = 0;
      const mockGateway = createMockGateway45(async () => {
        callCount++;
        return {
          text: JSON.stringify({ result: `Response ${callCount}` }),
          usage: { inputTokens: 10, outputTokens: 20 },
          model: "claude-3-haiku",
          durationMs: 100,
        };
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        outputSchema: null, // Skip output validation
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
        config: {
          systemPrompt: "Test",
          maxTokens: 100,
          temperature: 0.3,
          inputSchemaDescription: "",
          outputSchemaDescription: "",
          goal: "Test",
          cacheTtlSeconds: 900,
          cacheEnabled: false, // Caching disabled
          requestsPerMinute: 60,
        },
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const sameInput = { input: "NoCacheTest" }; // Matches default inputSchema

      // First request
      const request1 = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: sameInput },
        }
      );

      await generateHandler(request1, createParams(process.id));

      // Second request with same input
      const request2 = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: sameInput },
        }
      );

      await generateHandler(request2, createParams(process.id));

      // LLM should be called twice because caching is disabled
      expect(mockGateway.generate).toHaveBeenCalledTimes(2);
    });
  });

  describe("Story 4.6: TTL=0 Disables Caching (AC: 4)", () => {
    it("should skip caching when cacheTtlSeconds is 0", async () => {
      let callCount = 0;
      const mockGateway = createMockGateway45(async () => {
        callCount++;
        return {
          text: JSON.stringify({ result: `Response ${callCount}` }),
          usage: { inputTokens: 10, outputTokens: 20 },
          model: "claude-3-haiku",
          durationMs: 100,
        };
      });
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({
        tenantId: tenant.id,
        outputSchema: null, // Skip output validation
      });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
        config: {
          systemPrompt: "Test",
          maxTokens: 100,
          temperature: 0.3,
          inputSchemaDescription: "",
          outputSchemaDescription: "",
          goal: "Test",
          cacheTtlSeconds: 0, // TTL=0 disables caching
          cacheEnabled: true, // Even with cacheEnabled=true
          requestsPerMinute: 60,
        },
      });
      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        scopes: ["process:*"],
        environment: "PRODUCTION",
      });

      const sameInput = { input: "TTLZeroTest" };

      // First request
      const request1 = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: sameInput },
        }
      );

      await generateHandler(request1, createParams(process.id));

      // Second request with same input
      const request2 = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: sameInput },
        }
      );

      await generateHandler(request2, createParams(process.id));

      // LLM should be called twice because TTL=0 disables caching
      expect(mockGateway.generate).toHaveBeenCalledTimes(2);
    });
  });
});
