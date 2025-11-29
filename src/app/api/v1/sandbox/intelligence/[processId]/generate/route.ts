/**
 * Sandbox Intelligence Generation API Endpoint
 *
 * POST /api/v1/sandbox/intelligence/:processId/generate
 *
 * Sandbox endpoint for generating intelligence output from a process.
 * Requires Bearer token authentication via API key.
 * Returns X-Environment: sandbox header.
 *
 * @see docs/stories/5-1-sandbox-and-production-modes.md
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
import { resolveVersion } from "~/server/services/process/version-resolver";
import { getGatewayOverride } from "./testing";
import { computeInputHash, getCacheService } from "~/server/services/cache";

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
 * Create success response with environment header
 */
function createSandboxSuccessResponse(
  data: Record<string, unknown>,
  requestId: string,
  startTime: number,
  cached: boolean,
  versionNumber?: string
): NextResponse {
  const latencyMs = Date.now() - startTime;

  const headers: Record<string, string> = {
    "X-Request-Id": requestId,
    "X-Response-Time": `${latencyMs}ms`,
    "X-Cache": cached ? "HIT" : "MISS",
    "X-Environment": "sandbox",
  };

  if (versionNumber) {
    headers["X-Version"] = versionNumber;
  }

  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        requestId,
        latencyMs,
        cached,
      },
    },
    { status: 200, headers }
  );
}

/**
 * POST /api/v1/sandbox/intelligence/:processId/generate
 *
 * Generate intelligence output from a sandbox process version.
 *
 * Request:
 * - Headers: Authorization: Bearer pil_live_... or pil_test_...
 * - Body: { input: Record<string, unknown> }
 *
 * Response:
 * - 200: Success with generated output
 * - 400: Invalid/missing input
 * - 401: Invalid/missing API key
 * - 403: API key lacks process access
 * - 404: Process not found or no sandbox version
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

  // Step 2: Check if API key has access to this process
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

  // Step 3: Resolve SANDBOX version using version resolver
  const resolvedVersion = await resolveVersion({
    processId,
    tenantId: apiKeyContext.tenantId,
    environment: "SANDBOX",
  });

  if (!resolvedVersion) {
    const response = notFound("No sandbox version found", requestId);
    response.headers.set("X-Environment", "sandbox");
    return response;
  }

  const { version: activeVersion } = resolvedVersion;

  // Step 4: Look up process for schema validation
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

  // Step 5: Parse and validate request body
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

  // Step 6: Validate input against process inputSchema
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

  // Step 7: Get process config from version
  const config = activeVersion.config as unknown as ProcessConfig;
  const validatedInput = (body as { input: Record<string, unknown> }).input;

  // Step 8: Cache lookup (Story 4.5, 4.6)
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
        activeVersion.version
      );
    }
  }

  // Step 9: Initialize ProcessEngine with LLM gateway
  const gateway = getGateway();
  const engine = new ProcessEngine(gateway);

  // Step 10: Generate intelligence with output schema validation
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

    // Step 11: Store in cache after successful LLM response
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

    // Step 12: Return success response with X-Environment: sandbox
    return createSandboxSuccessResponse(
      result.data,
      requestId,
      startTime,
      false,
      activeVersion.version
    );
  } catch (error) {
    const response = handleApiError(error, requestId);
    response.headers.set("X-Environment", "sandbox");
    return response;
  }
}
