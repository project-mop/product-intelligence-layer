/**
 * Call Log Test Factory
 *
 * Generates test data for CallLog entities.
 * Provides both in-memory (build) and persisted (create) methods.
 *
 * @module tests/support/factories/call-log.factory
 * @see docs/stories/6-1-call-logging-infrastructure.md
 */

import type { CallLog, Prisma } from "../../../generated/prisma";
import { generateRequestId } from "~/lib/id";
import { testDb } from "../db";

let counter = 0;

/**
 * Options for building/creating a call log.
 */
interface CallLogFactoryOptions {
  tenantId: string;
  processId: string;
  processVersionId: string;
  inputHash?: string;
  input?: Prisma.InputJsonValue;
  output?: Prisma.InputJsonValue;
  statusCode?: number;
  errorCode?: string | null;
  latencyMs?: number;
  modelUsed?: string | null;
  cached?: boolean;
  createdAt?: Date;
}

/**
 * Builds a call log object in memory without persisting to database.
 * Useful for unit tests that don't need database interaction.
 *
 * @param options - Required and optional call log fields
 * @returns Complete CallLog object
 *
 * @example
 * ```typescript
 * const log = callLogFactory.build({
 *   tenantId: "ten_123",
 *   processId: "proc_456",
 *   processVersionId: "procv_789",
 * });
 * ```
 */
function build(options: CallLogFactoryOptions): CallLog {
  counter++;
  return {
    id: generateRequestId(),
    tenantId: options.tenantId,
    processId: options.processId,
    processVersionId: options.processVersionId,
    inputHash: options.inputHash ?? `test_hash_${counter}`,
    input: (options.input ?? { test: "input" }) as CallLog["input"],
    output: (options.output ?? { success: true, data: {} }) as CallLog["output"],
    statusCode: options.statusCode ?? 200,
    errorCode: options.errorCode ?? null,
    errorMessage: null,
    latencyMs: options.latencyMs ?? 150,
    modelUsed: options.modelUsed ?? "claude-3-haiku-20240307",
    cached: options.cached ?? false,
    createdAt: options.createdAt ?? new Date(),
  };
}

/**
 * Creates a call log and persists it to the test database.
 *
 * @param options - Required and optional call log fields
 * @returns Promise resolving to the created CallLog
 *
 * @example
 * ```typescript
 * const log = await callLogFactory.create({
 *   tenantId: tenant.id,
 *   processId: process.id,
 *   processVersionId: version.id,
 * });
 * ```
 */
async function create(options: CallLogFactoryOptions): Promise<CallLog> {
  counter++;
  return testDb.callLog.create({
    data: {
      id: generateRequestId(),
      tenantId: options.tenantId,
      processId: options.processId,
      processVersionId: options.processVersionId,
      inputHash: options.inputHash ?? `test_hash_${counter}`,
      input: options.input ?? { test: "input" },
      output: options.output ?? { success: true, data: {} },
      statusCode: options.statusCode ?? 200,
      errorCode: options.errorCode ?? null,
      latencyMs: options.latencyMs ?? 150,
      modelUsed: options.modelUsed ?? "claude-3-haiku-20240307",
      cached: options.cached ?? false,
      createdAt: options.createdAt ?? new Date(),
    },
  });
}

/**
 * Creates multiple call logs.
 *
 * @param options - Base options for all logs
 * @param count - Number of logs to create
 * @returns Promise resolving to array of created CallLogs
 */
async function createMany(
  options: CallLogFactoryOptions,
  count: number
): Promise<CallLog[]> {
  const logs: CallLog[] = [];
  for (let i = 0; i < count; i++) {
    logs.push(await create(options));
  }
  return logs;
}

/**
 * Creates a call log representing an error response.
 *
 * @param options - Base options plus required errorCode
 * @returns Promise resolving to the created error CallLog
 *
 * @example
 * ```typescript
 * const errorLog = await callLogFactory.createError({
 *   tenantId: tenant.id,
 *   processId: process.id,
 *   processVersionId: version.id,
 *   errorCode: "VALIDATION_ERROR",
 *   statusCode: 400,
 * });
 * ```
 */
async function createError(
  options: CallLogFactoryOptions & { errorCode: string }
): Promise<CallLog> {
  return create({
    ...options,
    statusCode: options.statusCode ?? 500,
    output: options.output ?? { error: { code: options.errorCode } },
  });
}

/**
 * Creates a call log representing a cached response.
 *
 * @param options - Base options
 * @returns Promise resolving to the created cached CallLog
 */
async function createCached(options: CallLogFactoryOptions): Promise<CallLog> {
  return create({
    ...options,
    cached: true,
    modelUsed: null, // Cache hits don't use a model
    latencyMs: options.latencyMs ?? 5, // Cache hits are fast
  });
}

/**
 * Resets the internal counter (for test isolation).
 */
function resetCounter(): void {
  counter = 0;
}

export const callLogFactory = {
  build,
  create,
  createMany,
  createError,
  createCached,
  resetCounter,
};
