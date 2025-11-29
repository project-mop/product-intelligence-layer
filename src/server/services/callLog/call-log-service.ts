/**
 * Call Log Service
 *
 * Provides logging for API calls with support for both async (fire-and-forget)
 * and sync (for testing/specific use cases) modes.
 *
 * @see docs/stories/6-1-call-logging-infrastructure.md
 */

import type { Prisma } from "../../../../generated/prisma";
import { db } from "~/server/db";
import { generateRequestId } from "~/lib/id";
import type { CallLogEntry, CallLogResult } from "./types";

/**
 * Log an API call asynchronously (fire-and-forget pattern).
 *
 * Errors are caught and logged but do not propagate to the caller,
 * ensuring that logging failures do not affect API response times.
 *
 * @param entry - Call log entry data
 */
export function logCallAsync(entry: CallLogEntry): void {
  db.callLog
    .create({
      data: {
        id: generateRequestId(),
        tenantId: entry.tenantId,
        processId: entry.processId,
        processVersionId: entry.processVersionId,
        inputHash: entry.inputHash,
        input: entry.input as Prisma.InputJsonValue | undefined,
        output: entry.output as Prisma.InputJsonValue | undefined,
        statusCode: entry.statusCode,
        errorCode: entry.errorCode ?? null,
        latencyMs: entry.latencyMs,
        modelUsed: entry.modelUsed ?? null,
        cached: entry.cached,
      },
    })
    .catch((error: unknown) => {
      console.error("[CallLog] Failed to write call log:", error);
    });
}

/**
 * Log an API call synchronously.
 *
 * Use this for testing or when you need confirmation that the log was created.
 *
 * @param entry - Call log entry data
 * @returns The created log entry with id and createdAt
 */
export async function logCallSync(entry: CallLogEntry): Promise<CallLogResult> {
  const result = await db.callLog.create({
    data: {
      id: generateRequestId(),
      tenantId: entry.tenantId,
      processId: entry.processId,
      processVersionId: entry.processVersionId,
      inputHash: entry.inputHash,
      input: entry.input as Prisma.InputJsonValue | undefined,
      output: entry.output as Prisma.InputJsonValue | undefined,
      statusCode: entry.statusCode,
      errorCode: entry.errorCode ?? null,
      latencyMs: entry.latencyMs,
      modelUsed: entry.modelUsed ?? null,
      cached: entry.cached,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  return result;
}
