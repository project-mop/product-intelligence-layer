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
      expect(body.error.message).toContain("no published version");
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
      const process = await processFactory.create({ tenantId: tenant.id });
      await processVersionFactory.create({
        processId: process.id,
        environment: "PRODUCTION",
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
          body: { input: { test: "data" } },
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
      setGatewayOverride(mockGateway);

      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });
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

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toEqual({ sandbox: "result" });
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
      const process = await processFactory.create({ tenantId: tenant.id });
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
          body: { input: {} },
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
          body: { input: {} },
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
          body: { input: {} },
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
      const mockGateway = createMockGateway(async () => ({
        text: "This is not valid JSON at all {{",
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
          body: { input: {} },
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
          body: { input: {} },
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
});

describe("GET /api/v1/intelligence/:processId/schema", () => {
  describe("Authentication", () => {
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
