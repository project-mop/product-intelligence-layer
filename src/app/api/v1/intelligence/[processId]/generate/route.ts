/**
 * Intelligence Generation API Endpoint
 *
 * POST /api/v1/intelligence/:processId/generate
 *
 * Main endpoint for generating intelligence output from a process.
 * Requires Bearer token authentication via API key.
 *
 * @see docs/tech-spec-epic-3.md#Story-3.1-Endpoint-URL-Generation
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
  unauthorized,
  forbidden,
  notFound,
  notImplemented,
} from "~/server/services/api/response";

interface RouteParams {
  params: Promise<{
    processId: string;
  }>;
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
 * - 401: Invalid/missing API key
 * - 403: API key lacks process access
 * - 404: Process not found or no published version
 * - 501: LLM integration not implemented (placeholder)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId();

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

  // Step 6: Return 501 Not Implemented placeholder for LLM integration (Story 3.2)
  // This response indicates the endpoint is working but LLM logic is not yet implemented
  return notImplemented(
    "LLM integration not yet implemented. See Story 3.2.",
    requestId
  );

  // Future implementation (Story 3.2) will:
  // 1. Parse and validate input against process.inputSchema
  // 2. Build prompt from activeVersion.config
  // 3. Call LLM gateway
  // 4. Validate output against process.outputSchema
  // 5. Return generated intelligence
  //
  // return createSuccessResponse(
  //   {
  //     processId: process.id,
  //     versionId: activeVersion.id,
  //     output: generatedOutput,
  //   },
  //   requestId,
  //   startTime
  // );
}
