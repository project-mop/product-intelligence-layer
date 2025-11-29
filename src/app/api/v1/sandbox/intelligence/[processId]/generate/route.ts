/**
 * Sandbox Intelligence Generation API Endpoint
 *
 * POST /api/v1/sandbox/intelligence/:processId/generate
 *
 * Sandbox endpoint for generating intelligence output from a process.
 * Requires Bearer token authentication via API key.
 * Returns X-Environment: sandbox header.
 *
 * Version Pinning (Story 5.5):
 * - X-Version header pins to specific version number
 * - Response includes version metadata headers (X-Version, X-Version-Status)
 * - Deprecated versions include X-Deprecated, X-Deprecated-Message, X-Sunset-Date
 *
 * @see docs/stories/5-1-sandbox-and-production-modes.md
 * @see docs/stories/5-5-version-pinning-and-deprecation.md
 * @see docs/tech-spec-epic-5.md#Story-5.1-Sandbox-and-Production-Modes
 */

import { NextRequest, NextResponse } from "next/server";

import { generateRequestId } from "~/lib/id";
import { db } from "~/server/db";
import {
  validateApiKey,
  assertProcessAccess,
} from "~/server/services/auth/api-key-validator";
import {
  assertEnvironmentMatch,
  EnvironmentMismatchError,
} from "~/server/middleware/environment-guard";
import {
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  validationError,
} from "~/server/services/api/response";
import { handleApiError } from "~/server/middleware/error-handler";
import { validateInput } from "~/server/services/schema";
import { AnthropicGateway } from "~/server/services/llm";
import { ProcessEngine } from "~/server/services/process/engine";
import type { ProcessConfig } from "~/server/services/process/types";
import { resolveVersion, VersionResolutionError } from "~/server/services/process/version-resolver";
import { parseVersionHeader } from "~/server/services/process/parse-version-header";
import { buildVersionHeaders, applyVersionHeaders } from "~/server/services/process/version-headers";
import { getGatewayOverride } from "./testing";
import { computeInputHash, getCacheService } from "~/server/services/cache";
import { ApiError } from "~/lib/errors";

interface RouteParams {
  params: Promise<{
    processId: string;
  }>;
}

/**
 * LLM Gateway instance.
 *
 * Supports dependency injection for testing via getGatewayOverride from ./testing.ts.
 * In production, uses AnthropicGateway (lazy initialized).
 */
let defaultGateway: AnthropicGateway | null = null;

function getGateway(): AnthropicGateway {
  const override = getGatewayOverride();
  if (override) {
    return override as AnthropicGateway;
  }
  if (!defaultGateway) {
    defaultGateway = new AnthropicGateway();
  }
  return defaultGateway;
}

/**
 * Create success response with version headers (Story 5.5)
 */
function createSandboxSuccessResponse(
  data: Record<string, unknown>,
  requestId: string,
  startTime: number,
  cached: boolean,
  versionNumber: string,
  versionHeaders: ReturnType<typeof buildVersionHeaders>
): NextResponse {
  const latencyMs = Date.now() - startTime;

  const response = NextResponse.json(
    {
      success: true,
      data,
      meta: {
        version: versionNumber,
        cached,
        latency_ms: latencyMs,
        request_id: requestId,
      },
    },
    { status: 200 }
  );

  // Set standard headers
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Response-Time", `${latencyMs}ms`);
  response.headers.set("X-Cache", cached ? "HIT" : "MISS");

  // Apply version headers (Story 5.5)
  applyVersionHeaders(response.headers, versionHeaders);

  return response;
}

/**
 * Create error response for version resolution errors (Story 5.5)
 */
function createVersionErrorResponse(
  error: VersionResolutionError,
  requestId: string
): NextResponse {
  const response = NextResponse.json(error.toResponse(), {
    status: error.statusCode,
  });
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Environment", "sandbox");
  return response;
}

/**
 * POST /api/v1/sandbox/intelligence/:processId/generate
 *
 * Generate intelligence output from a sandbox process version.
 *
 * Request Headers:
 * - Authorization: Bearer pil_live_... or pil_test_...
 * - X-Version: N (optional) - Pin to specific version number
 *
 * Response Headers:
 * - X-Request-Id: Unique request identifier
 * - X-Response-Time: Request latency
 * - X-Cache: HIT/MISS
 * - X-Version: Resolved version number (AC: 9)
 * - X-Version-Status: active/deprecated (AC: 10)
 * - X-Environment: sandbox
 * - X-Deprecated: "true" (if deprecated) (AC: 4)
 * - X-Deprecated-Message: Upgrade guidance (if deprecated) (AC: 5)
 * - X-Sunset-Date: ISO 8601 date (if deprecated) (AC: 6)
 *
 * Response:
 * - 200: Success with generated output
 * - 400: Invalid/missing input, invalid X-Version header
 * - 401: Invalid/missing API key
 * - 403: API key lacks process access, version environment mismatch (AC: 8)
 * - 404: Process not found, no sandbox version, version not found (AC: 7)
 * - 500: Output parse failed after retry
 * - 503: LLM timeout or error
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Extract processId from route params
  const { processId } = await params;

  // Step 1: Validate API key from Authorization header
  const authHeader = request.headers.get("Authorization");
  const authResult = await validateApiKey(authHeader);

  if (!authResult.valid) {
    const response = unauthorized(authResult.error.message, requestId);
    response.headers.set("X-Environment", "sandbox");
    return response;
  }

  const { context: apiKeyContext } = authResult;

  // Step 2: Verify API key environment matches endpoint (Story 5.2)
  try {
    assertEnvironmentMatch(apiKeyContext.environment, "SANDBOX");
  } catch (error) {
    if (error instanceof EnvironmentMismatchError) {
      console.warn({
        message: "Environment mismatch rejected",
        request_id: requestId,
        tenant_id: apiKeyContext.tenantId,
        key_environment: error.keyEnvironment,
        path_environment: error.endpointEnvironment,
        key_id: apiKeyContext.keyId,
      });
    }
    const response = forbidden(
      error instanceof EnvironmentMismatchError
        ? error.message
        : "Environment access denied",
      requestId
    );
    response.headers.set("X-Environment", "sandbox");
    return response;
  }

  // Step 3: Check if API key has access to this process
  try {
    assertProcessAccess(apiKeyContext, processId);
  } catch {
    const response = forbidden(
      `API key does not have access to process ${processId}`,
      requestId
    );
    response.headers.set("X-Environment", "sandbox");
    return response;
  }

  // Step 4: Parse X-Version header (Story 5.5 AC: 1)
  let pinnedVersion: number | undefined;
  try {
    pinnedVersion = parseVersionHeader(request);
  } catch (error) {
    if (error instanceof ApiError) {
      const response = NextResponse.json(error.toResponse(), {
        status: error.statusCode,
      });
      response.headers.set("X-Request-Id", requestId);
      response.headers.set("X-Environment", "sandbox");
      return response;
    }
    throw error;
  }

  // Step 5: Resolve SANDBOX version using version resolver
  // Story 5.5: Supports version pinning via X-Version header
  let resolvedVersion;
  try {
    resolvedVersion = await resolveVersion({
      processId,
      tenantId: apiKeyContext.tenantId,
      environment: "SANDBOX",
      pinnedVersion,
    });
  } catch (error) {
    // Story 5.5 AC: 7, 8 - Handle version resolution errors
    if (error instanceof VersionResolutionError) {
      return createVersionErrorResponse(error, requestId);
    }
    throw error;
  }

  if (!resolvedVersion) {
    const response = notFound("No sandbox version found", requestId);
    response.headers.set("X-Environment", "sandbox");
    return response;
  }

  const { version: activeVersion } = resolvedVersion;

  // Build version headers for response (Story 5.5 AC: 4, 5, 6, 9, 10)
  const versionHeaders = buildVersionHeaders(resolvedVersion);

  // Step 6: Look up process for schema validation
  const process = await db.process.findFirst({
    where: {
      id: processId,
      tenantId: apiKeyContext.tenantId,
      deletedAt: null,
    },
  });

  if (!process) {
    const response = notFound("Process not found", requestId);
    response.headers.set("X-Environment", "sandbox");
    return response;
  }

  // Step 7: Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const response = badRequest("Invalid JSON in request body", requestId);
    response.headers.set("X-Environment", "sandbox");
    return response;
  }

  if (!body || typeof body !== "object") {
    const response = badRequest("Request body must be an object", requestId);
    response.headers.set("X-Environment", "sandbox");
    return response;
  }

  const { input } = body as { input?: unknown };

  if (input === undefined) {
    const response = badRequest("Missing required field: input", requestId);
    response.headers.set("X-Environment", "sandbox");
    return response;
  }

  if (typeof input !== "object" || input === null) {
    const response = badRequest("Field 'input' must be an object", requestId);
    response.headers.set("X-Environment", "sandbox");
    return response;
  }

  // Step 8: Validate input against process inputSchema
  const inputSchema = process.inputSchema;
  if (inputSchema && typeof inputSchema === "object") {
    const validationResult = validateInput(
      inputSchema as Record<string, unknown>,
      input as Record<string, unknown>
    );

    if (!validationResult.success) {
      console.warn(
        `[Sandbox Generate API] Validation failed for process ${processId}, request ${requestId}:`,
        validationResult.errors
      );
      const response = validationError(validationResult.errors, requestId);
      response.headers.set("X-Environment", "sandbox");
      return response;
    }

    // Use validated (and stripped) input for processing
    (body as { input: Record<string, unknown> }).input = validationResult.data;
  }

  // Step 9: Get process config from version
  const config = activeVersion.config as unknown as ProcessConfig;
  const validatedInput = (body as { input: Record<string, unknown> }).input;

  // Step 10: Cache lookup (Story 4.5, 4.6)
  const cacheControlHeader = request.headers.get("Cache-Control");
  const bypassCache = cacheControlHeader?.toLowerCase().includes("no-cache");
  const ttlSeconds = config.cacheTtlSeconds ?? 900;
  const cacheEnabled = config.cacheEnabled !== false && ttlSeconds > 0;

  let inputHash: string | null = null;

  if (cacheEnabled && !bypassCache) {
    inputHash = computeInputHash(
      apiKeyContext.tenantId,
      processId,
      validatedInput
    );

    const cacheService = getCacheService();
    const cachedEntry = await cacheService.get(
      apiKeyContext.tenantId,
      processId,
      inputHash
    );

    if (cachedEntry) {
      return createSandboxSuccessResponse(
        cachedEntry.data,
        requestId,
        startTime,
        true,
        activeVersion.version,
        versionHeaders
      );
    }
  }

  // Step 11: Initialize ProcessEngine with LLM gateway
  const gateway = getGateway();
  const engine = new ProcessEngine(gateway);

  // Step 12: Generate intelligence with output schema validation
  try {
    const outputSchema = process.outputSchema as Record<string, unknown> | null;

    const result = await engine.generateIntelligence(
      config,
      validatedInput,
      outputSchema
        ? {
            outputSchema,
            requestContext: {
              requestId,
              processId,
              tenantId: apiKeyContext.tenantId,
            },
          }
        : undefined
    );

    // Step 13: Store in cache after successful LLM response
    if (cacheEnabled && inputHash) {
      const cacheService = getCacheService();
      await cacheService.set(
        apiKeyContext.tenantId,
        processId,
        inputHash,
        {
          data: result.data,
          meta: {
            version: activeVersion.version,
            cachedAt: new Date().toISOString(),
            inputHash,
          },
        },
        ttlSeconds
      );
    }

    // Step 14: Return success response with version headers
    return createSandboxSuccessResponse(
      result.data,
      requestId,
      startTime,
      false,
      activeVersion.version,
      versionHeaders
    );
  } catch (error) {
    const response = handleApiError(error, requestId);
    response.headers.set("X-Environment", "sandbox");
    return response;
  }
}
