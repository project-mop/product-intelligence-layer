/**
 * Intelligence Generation API Endpoint
 *
 * POST /api/v1/intelligence/:processId/generate
 *
 * Main endpoint for generating intelligence output from a process.
 * Requires Bearer token authentication via API key.
 *
 * @see docs/tech-spec-epic-3.md#Story-3.2-LLM-Gateway-Integration
 * @see docs/architecture.md#Public-API-Patterns
 * @see docs/stories/4-3-error-response-contract.md
 * @see docs/stories/4-5-response-caching.md
 */

import { NextRequest } from "next/server";

import { generateRequestId } from "~/lib/id";
import { db } from "~/server/db";
import {
  validateApiKey,
  assertProcessAccess,
} from "~/server/services/auth/api-key-validator";
import {
  createSuccessResponse,
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
 * POST /api/v1/intelligence/:processId/generate
 *
 * Generate intelligence output from a published process.
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
 * - 404: Process not found or no published version
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
    return unauthorized(authResult.error.message, requestId);
  }

  const { context: apiKeyContext } = authResult;

  // Step 2: Check if API key has access to this process
  try {
    assertProcessAccess(apiKeyContext, processId);
  } catch {
    return forbidden(
      `API key does not have access to process ${processId}`,
      requestId
    );
  }

  // Step 3: Look up process with tenant isolation
  const process = await db.process.findFirst({
    where: {
      id: processId,
      tenantId: apiKeyContext.tenantId,
      deletedAt: null,
    },
    include: {
      versions: {
        where: {
          // Filter by environment based on API key type
          environment: apiKeyContext.environment,
          deprecatedAt: null,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Step 4: Check process exists
  if (!process) {
    return notFound("Process not found", requestId);
  }

  // Step 5: Check for published version (SANDBOX or PRODUCTION based on key)
  const activeVersion = process.versions[0];
  if (!activeVersion) {
    return notFound(
      "Process has no published version for this environment",
      requestId
    );
  }

  // Step 6: Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON in request body", requestId);
  }

  if (!body || typeof body !== "object") {
    return badRequest("Request body must be an object", requestId);
  }

  const { input } = body as { input?: unknown };

  if (input === undefined) {
    return badRequest("Missing required field: input", requestId);
  }

  if (typeof input !== "object" || input === null) {
    return badRequest("Field 'input' must be an object", requestId);
  }

  // Step 7: Validate input against process inputSchema
  const inputSchema = process.inputSchema;
  if (inputSchema && typeof inputSchema === "object") {
    const validationResult = validateInput(
      inputSchema as Record<string, unknown>,
      input as Record<string, unknown>
    );

    if (!validationResult.success) {
      console.warn(
        `[Generate API] Validation failed for process ${processId}, request ${requestId}:`,
        validationResult.errors
      );
      return validationError(validationResult.errors, requestId);
    }

    // Use validated (and stripped) input for processing
    (body as { input: Record<string, unknown> }).input = validationResult.data;
  }

  // Step 8: Get process config from version
  const config = activeVersion.config as unknown as ProcessConfig;
  const validatedInput = (body as { input: Record<string, unknown> }).input;

  // Step 9: Cache lookup (Story 4.5, 4.6)
  // Check for Cache-Control: no-cache header to bypass cache
  const cacheControlHeader = request.headers.get("Cache-Control");
  const bypassCache = cacheControlHeader?.toLowerCase().includes("no-cache");
  // Cache is enabled if: cacheEnabled !== false AND cacheTtlSeconds > 0 (Story 4.6 AC: 4)
  const ttlSeconds = config.cacheTtlSeconds ?? 900; // Default 15 min
  const cacheEnabled = config.cacheEnabled !== false && ttlSeconds > 0;

  let inputHash: string | null = null;

  if (cacheEnabled && !bypassCache) {
    // Compute cache key: SHA256(tenantId + processId + sortedJSON(input))
    inputHash = computeInputHash(
      apiKeyContext.tenantId,
      processId,
      validatedInput
    );

    // Check cache before LLM call (before circuit breaker per Story 4.4 learnings)
    const cacheService = getCacheService();
    const cachedEntry = await cacheService.get(
      apiKeyContext.tenantId,
      processId,
      inputHash
    );

    if (cachedEntry) {
      // Cache HIT - return immediately, skip LLM call
      return createSuccessResponse(
        cachedEntry.data,
        requestId,
        startTime,
        true // cached = true
      );
    }
  }

  // Step 10: Initialize ProcessEngine with LLM gateway
  const gateway = getGateway();
  const engine = new ProcessEngine(gateway);

  // Step 11: Generate intelligence with output schema validation (Story 4.2)
  try {
    // Get outputSchema from process for validation
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

    // Step 12: Store in cache after successful LLM response (Story 4.5)
    if (cacheEnabled && inputHash) {
      const cacheService = getCacheService();
      // ttlSeconds already computed above (line 197)

      // Cache write failures are silent per AC#9 (handled inside cacheService.set)
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

    // Step 13: Return success response with X-Cache: MISS
    return createSuccessResponse(
      result.data,
      requestId,
      startTime,
      false // cached = false (cache miss)
    );
  } catch (error) {
    // Use centralized error handler (Story 4.3)
    // Handles: ApiError, LLMError, ProcessEngineError, and unknown errors
    // Automatically sets Retry-After headers for 429/503 responses
    // Sanitizes error messages to remove internal details
    return handleApiError(error, requestId);
  }
}
