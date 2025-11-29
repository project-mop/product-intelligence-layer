/**
 * Call Log Service Exports
 *
 * @see docs/stories/6-1-call-logging-infrastructure.md
 */

export { logCallAsync, logCallSync } from "./call-log-service";
export type { CallLogEntry, CallLogResult } from "./types";
