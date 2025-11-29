/**
 * Version Pinning Integration Tests
 *
 * Tests X-Version header support for version pinning.
 * Verifies version resolution, deprecation headers, and error handling.
 *
 * @module tests/integration/version-pinning.test
 * @see docs/stories/5-5-version-pinning-and-deprecation.md
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
import type { LLMGateway, GenerateParams, GenerateResult } from "~/server/services/llm/types";

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

/**
 * Create a mock LLM gateway for testing.
 * Output matches the default outputSchema from process.factory.ts: { output: string }
 */
function createMockGateway(): LLMGateway {
  return {
    generate: vi.fn(async (_params: GenerateParams): Promise<GenerateResult> => ({
      text: JSON.stringify({ output: "test output result" }),
      model: "claude-sonnet-4-20250514",
      usage: { inputTokens: 100, outputTokens: 50 },
      durationMs: 100,
    })),
  };
}

describe("Story 5.5: Version Pinning and Deprecation", () => {
  let mockGateway: LLMGateway;

  beforeEach(() => {
    mockGateway = createMockGateway();
    setGatewayOverride(mockGateway);
    setSandboxGatewayOverride(mockGateway);
  });

  afterEach(() => {
    setGatewayOverride(null);
    setSandboxGatewayOverride(null);
  });

  describe("AC 1: X-Version header support", () => {
    it("should use pinned version when X-Version header is provided", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      // Create version 1 (deprecated)
      await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
        deprecatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      });

      // Create version 2 (active)
      await processVersionFactory.create({
        processId: process.id,
        version: "2.0.0",
        environment: "PRODUCTION",
        status: "ACTIVE",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
      });

      // Request with X-Version: 1 should use version 1
      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
            "X-Version": "1",
          },
          body: { input: { input: "test input" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Version")).toBe("1");
    });
  });

  describe("AC 2: Default to latest version", () => {
    it("should use latest active version when no X-Version header", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      // Create version 1 (deprecated)
      await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
        deprecatedAt: new Date(),
      });

      // Create version 2 (active)
      await processVersionFactory.create({
        processId: process.id,
        version: "2.0.0",
        environment: "PRODUCTION",
        status: "ACTIVE",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
      });

      // Request without X-Version should use version 2
      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
          },
          body: { input: { input: "test input" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Version")).toBe("2");
      expect(response.headers.get("X-Version-Status")).toBe("active");
    });
  });

  describe("AC 3, 4, 5: Deprecated version headers", () => {
    it("should include deprecation headers when pinning to deprecated version", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      const deprecatedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      // Create version 1 (deprecated)
      await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
        deprecatedAt,
      });

      // Create version 2 (active)
      await processVersionFactory.create({
        processId: process.id,
        version: "2.0.0",
        environment: "PRODUCTION",
        status: "ACTIVE",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
            "X-Version": "1",
          },
          body: { input: { input: "test input" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);

      // AC 4: X-Deprecated header
      expect(response.headers.get("X-Deprecated")).toBe("true");

      // AC 5: X-Deprecated-Message with upgrade guidance
      const deprecatedMessage = response.headers.get("X-Deprecated-Message");
      expect(deprecatedMessage).toBeTruthy();
      expect(deprecatedMessage).toContain("deprecated");
      expect(deprecatedMessage).toContain("version 2");

      // AC 10: X-Version-Status
      expect(response.headers.get("X-Version-Status")).toBe("deprecated");
    });
  });

  describe("AC 6: X-Sunset-Date header", () => {
    it("should include X-Sunset-Date in ISO 8601 format for deprecated versions", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      const deprecatedAt = new Date("2024-01-15T00:00:00Z");

      await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
        deprecatedAt,
      });

      await processVersionFactory.create({
        processId: process.id,
        version: "2.0.0",
        environment: "PRODUCTION",
        status: "ACTIVE",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
            "X-Version": "1",
          },
          body: { input: { input: "test input" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);

      const sunsetDate = response.headers.get("X-Sunset-Date");
      expect(sunsetDate).toBeTruthy();
      // Verify sunset date is 90 days from deprecation
      const deprecatedDate = new Date("2024-01-15T00:00:00Z");
      const sunset = new Date(sunsetDate!);
      const diffDays = Math.round((sunset.getTime() - deprecatedDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(90);
    });
  });

  describe("AC 7: VERSION_NOT_FOUND error", () => {
    it("should return 404 with available versions when pinning to non-existent version", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      // Only create version 1 and 2
      await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
        deprecatedAt: new Date(),
      });

      await processVersionFactory.create({
        processId: process.id,
        version: "2.0.0",
        environment: "PRODUCTION",
        status: "ACTIVE",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
      });

      // Request version 99 which doesn't exist
      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
            "X-Version": "99",
          },
          body: { input: { input: "test input" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VERSION_NOT_FOUND");
      expect(body.error.message).toContain("Version 99 not found");

      // Details should contain available versions (structure validated in unit tests)
      expect(body.error.details).toBeDefined();
      expect(body.error.details.availableVersions).toBeDefined();
      expect(Array.isArray(body.error.details.availableVersions)).toBe(true);
    });
  });

  describe("AC 8: VERSION_ENVIRONMENT_MISMATCH error", () => {
    it("should return 403 when pinning to version in wrong environment", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      // Create sandbox version 1
      await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "SANDBOX",
        status: "ACTIVE",
      });

      // Create production version 2
      await processVersionFactory.create({
        processId: process.id,
        version: "2.0.0",
        environment: "PRODUCTION",
        status: "ACTIVE",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
      });

      // Request version 1 (sandbox) via production endpoint
      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
            "X-Version": "1",
          },
          body: { input: { input: "test input" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VERSION_ENVIRONMENT_MISMATCH");
      expect(body.error.message).toContain("sandbox");

      // Details should contain available versions (structure validated in unit tests)
      expect(body.error.details).toBeDefined();
      expect(body.error.details.availableVersions).toBeDefined();
      expect(Array.isArray(body.error.details.availableVersions)).toBe(true);
    });
  });

  describe("AC 9: X-Version header in response", () => {
    it("should include X-Version header showing resolved version number", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      await processVersionFactory.create({
        processId: process.id,
        version: "3.0.0",
        environment: "PRODUCTION",
        status: "ACTIVE",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
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
          body: { input: { input: "test input" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Version")).toBe("3");
    });
  });

  describe("AC 10: X-Version-Status header", () => {
    it("should return 'active' for active versions", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "ACTIVE",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
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
          body: { input: { input: "test input" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.headers.get("X-Version-Status")).toBe("active");
    });

    it("should return 'deprecated' for deprecated versions", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "DEPRECATED",
        deprecatedAt: new Date(),
      });

      await processVersionFactory.create({
        processId: process.id,
        version: "2.0.0",
        environment: "PRODUCTION",
        status: "ACTIVE",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
            "X-Version": "1",
          },
          body: { input: { input: "test input" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.headers.get("X-Version-Status")).toBe("deprecated");
    });
  });

  describe("Sandbox endpoint version pinning", () => {
    it("should support version pinning in sandbox endpoint", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "SANDBOX",
        status: "DEPRECATED",
        deprecatedAt: new Date(),
      });

      await processVersionFactory.create({
        processId: process.id,
        version: "2.0.0",
        environment: "SANDBOX",
        status: "ACTIVE",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "SANDBOX",
      });

      const request = createRequest(
        `/api/v1/sandbox/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
            "X-Version": "1",
          },
          body: { input: { input: "test input" } },
        }
      );

      const response = await sandboxGenerateHandler(request, createParams(process.id));

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Version")).toBe("1");
      expect(response.headers.get("X-Deprecated")).toBe("true");
      expect(response.headers.get("X-Environment")).toBe("sandbox");
    });
  });

  describe("Invalid X-Version header", () => {
    it("should return 400 for non-numeric X-Version header", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "ACTIVE",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
            "X-Version": "invalid",
          },
          body: { input: { input: "test input" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.code).toBe("INVALID_VERSION");
    });

    it("should return 400 for zero X-Version", async () => {
      const tenant = await tenantFactory.create();
      const process = await processFactory.create({ tenantId: tenant.id });

      await processVersionFactory.create({
        processId: process.id,
        version: "1.0.0",
        environment: "PRODUCTION",
        status: "ACTIVE",
      });

      const { plainTextKey } = await apiKeyFactory.create({
        tenantId: tenant.id,
        environment: "PRODUCTION",
      });

      const request = createRequest(
        `/api/v1/intelligence/${process.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${plainTextKey}`,
            "X-Version": "0",
          },
          body: { input: { input: "test input" } },
        }
      );

      const response = await generateHandler(request, createParams(process.id));

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.code).toBe("INVALID_VERSION");
    });
  });
});
