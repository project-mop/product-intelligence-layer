/**
 * Call Log Types
 *
 * Type definitions for the call logging service.
 *
 * @see docs/stories/6-1-call-logging-infrastructure.md
 */

/**
 * Parameters for creating a call log entry
 */
export interface CallLogEntry {
  tenantId: string;
  processId: string;
  processVersionId: string;
  inputHash: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  statusCode: number;
  errorCode?: string;
  latencyMs: number;
  modelUsed?: string;
  cached: boolean;
}

/**
 * Result from synchronous call logging
 */
export interface CallLogResult {
  id: string;
  createdAt: Date;
}
