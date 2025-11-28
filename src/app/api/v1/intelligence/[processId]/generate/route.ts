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
  llmTimeout,
  llmError,
  outputParseFailed,
  outputValidationError,
  validationError,
} from "~/server/services/api/response";
import { ApiError, ErrorCode } from "~/lib/errors";
import { validateInput } from "~/server/services/schema";
import { AnthropicGateway } from "~/server/services/llm";
import { LLMError } from "~/server/services/llm/types";
import { ProcessEngine, ProcessEngineError } from "~/server/services/process/engine";
import type { ProcessConfig } from "~/server/services/process/types";
import { getGatewayOverride } from "./testing";

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

  // Step 9: Initialize ProcessEngine with LLM gateway
  const gateway = getGateway();
  const engine = new ProcessEngine(gateway);

  // Step 10: Generate intelligence with output schema validation (Story 4.2)
  try {
    // Get outputSchema from process for validation
    const outputSchema = process.outputSchema as Record<string, unknown> | null;

    const result = await engine.generateIntelligence(
      config,
      input as Record<string, unknown>,
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

    // Step 11: Return success response
    return createSuccessResponse(
      result.data,
      requestId,
      startTime,
      false // cached = false (Epic 5 implements caching)
    );
  } catch (error) {
    // Handle LLM errors
    if (error instanceof LLMError) {
      console.error(`[Generate API] LLM error: ${error.code} - ${error.message}`);

      if (error.code === "LLM_TIMEOUT") {
        return llmTimeout(
          "LLM request timed out. Please try again.",
          requestId
        );
      }

      // LLM_ERROR and LLM_RATE_LIMITED
      return llmError(
        "LLM service error. Please try again later.",
        requestId
      );
    }

    // Handle output validation errors (Story 4.2)
    if (error instanceof ApiError && error.code === ErrorCode.OUTPUT_VALIDATION_FAILED) {
      console.error(
        `[Generate API] Output validation failed: ${error.message}`,
        error.details
      );

      return outputValidationError(
        (error.details?.issues as Array<{ path: string[]; message: string }>) ?? [],
        requestId
      );
    }

    // Handle process engine errors
    if (error instanceof ProcessEngineError) {
      console.error(
        `[Generate API] Process engine error: ${error.code} - ${error.message}`
      );

      if (error.code === "OUTPUT_PARSE_FAILED") {
        return outputParseFailed(
          "Failed to parse LLM response. Please try again.",
          requestId
        );
      }
    }

    // Unknown errors
    console.error("[Generate API] Unknown error:", error);
    return llmError("An unexpected error occurred", requestId);
  }
}
