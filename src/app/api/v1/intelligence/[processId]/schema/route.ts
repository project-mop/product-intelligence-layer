/**
 * Intelligence Schema API Endpoint
 *
 * GET /api/v1/intelligence/:processId/schema
 *
 * Returns the input and output schemas for a process.
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
  createSuccessResponse,
  unauthorized,
  forbidden,
  notFound,
} from "~/server/services/api/response";

interface RouteParams {
  params: Promise<{
    processId: string;
  }>;
}

/**
 * GET /api/v1/intelligence/:processId/schema
 *
 * Get the input and output schemas for a process.
 *
 * Request:
 * - Headers: Authorization: Bearer pil_live_... or pil_test_...
 *
 * Response:
 * - 200: Success with schema data
 * - 401: Invalid/missing API key
 * - 403: API key lacks process access
 * - 404: Process not found or no published version
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();
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

  // Step 6: Return schema data
  return createSuccessResponse(
    {
      processId: process.id,
      name: process.name,
      version: activeVersion.version,
      inputSchema: process.inputSchema,
      outputSchema: process.outputSchema,
    },
    requestId,
    startTime
  );
}
