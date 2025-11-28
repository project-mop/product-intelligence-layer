/**
 * Output Validation Retry Handler
 *
 * Handles output validation with automatic retry on failure.
 * On first validation failure, retries with a stricter prompt.
 * Logs both attempts for debugging.
 *
 * AC covered:
 * - AC 3: JSON parse failures trigger one automatic retry with stricter prompt
 * - AC 4: Schema validation failures trigger one automatic retry with stricter prompt
 * - AC 5: Retry prompt includes failure message and schema description
 * - AC 6: After second failure, throws OUTPUT_VALIDATION_FAILED error
 * - AC 10: Both LLM attempts are logged for debugging
 *
 * @see docs/stories/4-2-output-schema-enforcement.md
 */

import type { JSONSchema7 } from "json-schema";
import type { LLMGateway, GenerateResult } from "../llm/types";
import type { AssembledPrompt } from "./prompt";
import type { ProcessConfig } from "./types";
import type { ValidationIssue } from "../schema/types";
import {
  validateOutput,
  type OutputValidationResult,
} from "../schema/validate-output";
import { ApiError, ErrorCode, ERROR_HTTP_STATUS } from "~/lib/errors";

/**
 * Result from output validation with retry.
 */
export interface OutputValidationWithRetryResult {
  /** Validated and coerced data */
  data: Record<string, unknown>;
  /** Whether a retry was needed */
  retried: boolean;
  /** Number of attempts made (1 or 2) */
  attempts: number;
  /** Validation result from each attempt */
  attemptResults: AttemptLog[];
}

/**
 * Log entry for a single validation attempt.
 */
export interface AttemptLog {
  /** Attempt number (1 or 2) */
  attempt: 1 | 2;
  /** Prompt sent to LLM (system + user) */
  prompt: {
    system: string;
    user: string;
  };
  /** Raw response from LLM */
  rawResponse: string;
  /** Whether JSON parsing succeeded */
  parseSuccess: boolean;
  /** Whether schema validation succeeded */
  validationSuccess: boolean;
  /** Validation errors if any */
  validationErrors?: ValidationIssue[];
  /** Duration of LLM call in ms */
  llmDurationMs: number;
  /** Duration of validation in ms */
  validationDurationMs: number;
}

/**
 * Validate LLM output with automatic retry on failure.
 *
 * Flow:
 * 1. Validate initial LLM response against schema
 * 2. On success, return validated data
 * 3. On failure, build stricter retry prompt and call LLM again
 * 4. Validate retry response
 * 5. On success, return validated data with retried=true
 * 6. On failure, throw ApiError with OUTPUT_VALIDATION_FAILED
 *
 * @param outputSchema - JSON Schema to validate against
 * @param initialResponse - Initial LLM response text
 * @param gateway - LLM gateway for retry call
 * @param originalPrompt - Original prompt (for retry enhancement)
 * @param config - Process configuration
 * @param requestContext - Context for logging (requestId, processId, tenantId)
 * @returns Validated output with metadata
 * @throws ApiError with OUTPUT_VALIDATION_FAILED after two failures
 */
export async function validateOutputWithRetry(
  outputSchema: JSONSchema7 | Record<string, unknown>,
  initialResponse: GenerateResult,
  gateway: LLMGateway,
  originalPrompt: AssembledPrompt,
  config: ProcessConfig,
  requestContext: {
    requestId: string;
    processId: string;
    tenantId: string;
  }
): Promise<OutputValidationWithRetryResult> {
  const attemptLogs: AttemptLog[] = [];

  // Attempt 1: Validate initial response
  const attempt1Start = performance.now();
  const attempt1Result = validateOutput(outputSchema, initialResponse.text);
  const attempt1ValidationDuration = performance.now() - attempt1Start;

  const attempt1Log: AttemptLog = {
    attempt: 1,
    prompt: {
      system: originalPrompt.system,
      user: originalPrompt.user,
    },
    rawResponse: redactPii(initialResponse.text),
    parseSuccess: !("parseError" in attempt1Result && attempt1Result.parseError),
    validationSuccess: attempt1Result.success,
    validationErrors: !attempt1Result.success
      ? attempt1Result.validationErrors ?? [
          { path: [], message: attempt1Result.parseError ?? "Unknown error" },
        ]
      : undefined,
    llmDurationMs: initialResponse.durationMs,
    validationDurationMs: attempt1ValidationDuration,
  };
  attemptLogs.push(attempt1Log);

  // Log attempt 1
  logAttempt(attempt1Log, requestContext);

  if (attempt1Result.success) {
    return {
      data: attempt1Result.data,
      retried: false,
      attempts: 1,
      attemptResults: attemptLogs,
    };
  }

  // Attempt 2: Build stricter prompt and retry
  console.warn(
    `[RetryHandler] Attempt 1 failed, retrying with stricter prompt. ` +
      `RequestId: ${requestContext.requestId}, ProcessId: ${requestContext.processId}`
  );

  const retryPrompt = buildRetryPrompt(
    originalPrompt,
    outputSchema,
    attempt1Result
  );

  const retryResponse = await gateway.generate({
    prompt: retryPrompt.user,
    systemPrompt: retryPrompt.system,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });

  const attempt2Start = performance.now();
  const attempt2Result = validateOutput(outputSchema, retryResponse.text);
  const attempt2ValidationDuration = performance.now() - attempt2Start;

  const attempt2Log: AttemptLog = {
    attempt: 2,
    prompt: {
      system: retryPrompt.system,
      user: retryPrompt.user,
    },
    rawResponse: redactPii(retryResponse.text),
    parseSuccess: !("parseError" in attempt2Result && attempt2Result.parseError),
    validationSuccess: attempt2Result.success,
    validationErrors: !attempt2Result.success
      ? attempt2Result.validationErrors ?? [
          { path: [], message: attempt2Result.parseError ?? "Unknown error" },
        ]
      : undefined,
    llmDurationMs: retryResponse.durationMs,
    validationDurationMs: attempt2ValidationDuration,
  };
  attemptLogs.push(attempt2Log);

  // Log attempt 2
  logAttempt(attempt2Log, requestContext);

  if (attempt2Result.success) {
    return {
      data: attempt2Result.data,
      retried: true,
      attempts: 2,
      attemptResults: attemptLogs,
    };
  }

  // Both attempts failed - throw OUTPUT_VALIDATION_FAILED
  console.error(
    `[RetryHandler] Both attempts failed. ` +
      `RequestId: ${requestContext.requestId}, ProcessId: ${requestContext.processId}`
  );

  const issues = attempt2Result.validationErrors ?? [
    { path: [], message: attempt2Result.parseError ?? "Failed to validate output" },
  ];

  throw new ApiError(
    ErrorCode.OUTPUT_VALIDATION_FAILED,
    "Failed to generate valid response after retry",
    ERROR_HTTP_STATUS[ErrorCode.OUTPUT_VALIDATION_FAILED],
    { issues }
  );
}

/**
 * Build a stricter prompt for retry attempt.
 *
 * Per AC #5: "PREVIOUS ATTEMPT FAILED VALIDATION. Your response MUST be valid JSON matching: {schema description}"
 */
function buildRetryPrompt(
  original: AssembledPrompt,
  schema: JSONSchema7 | Record<string, unknown>,
  previousResult: OutputValidationResult
): AssembledPrompt {
  const schemaDescription = JSON.stringify(schema, null, 2);

  const previousErrors = !previousResult.success
    ? formatValidationErrors(previousResult)
    : "Unknown validation error";

  const retryInstructions = [
    "",
    "PREVIOUS ATTEMPT FAILED VALIDATION. Your response MUST be valid JSON matching:",
    schemaDescription,
    "",
    "CRITICAL REQUIREMENTS:",
    "- Output ONLY valid JSON",
    "- Do NOT include markdown code blocks (no ```json or ```)",
    "- Do NOT include explanations before or after the JSON",
    "- Ensure all required fields are present",
    "- Match exact types (strings for strings, numbers for numbers)",
    "",
    `Previous error: ${previousErrors}`,
  ].join("\n");

  return {
    system: original.system + retryInstructions,
    user: original.user,
  };
}

/**
 * Format validation errors for inclusion in retry prompt.
 */
function formatValidationErrors(result: OutputValidationResult): string {
  if (result.success) {
    return "None";
  }

  if ("parseError" in result && result.parseError) {
    return `JSON parse error: ${result.parseError}`;
  }

  if (result.validationErrors && result.validationErrors.length > 0) {
    return result.validationErrors
      .map((e) => `${e.path.join(".") || "root"}: ${e.message}`)
      .join("; ");
  }

  return "Unknown validation error";
}

/**
 * Log a validation attempt for debugging (AC #10).
 *
 * Logs are structured for observability systems.
 */
function logAttempt(
  attemptLog: AttemptLog,
  context: { requestId: string; processId: string; tenantId: string }
): void {
  const logEntry = {
    type: "output_validation_attempt",
    ...context,
    attempt: attemptLog.attempt,
    parseSuccess: attemptLog.parseSuccess,
    validationSuccess: attemptLog.validationSuccess,
    llmDurationMs: attemptLog.llmDurationMs,
    validationDurationMs: attemptLog.validationDurationMs,
    // Don't log full prompt/response in production to avoid log bloat
    // but keep error details
    ...(attemptLog.validationErrors && {
      errorCount: attemptLog.validationErrors.length,
      errors: attemptLog.validationErrors.slice(0, 5), // Limit to first 5 errors
    }),
  };

  if (attemptLog.validationSuccess) {
    console.info("[RetryHandler] Validation attempt succeeded", logEntry);
  } else {
    console.warn("[RetryHandler] Validation attempt failed", logEntry);
  }
}

/**
 * Redact potential PII from LLM responses (AC #10).
 *
 * Basic redaction for logs - redacts common PII patterns.
 * In production, this would use a more sophisticated PII detection system.
 */
function redactPii(text: string): string {
  // Redact email addresses
  let redacted = text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[EMAIL_REDACTED]"
  );

  // Redact phone numbers (basic patterns)
  redacted = redacted.replace(
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    "[PHONE_REDACTED]"
  );

  // Redact credit card patterns (13-16 digits)
  redacted = redacted.replace(
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{1,4}\b/g,
    "[CC_REDACTED]"
  );

  // Redact SSN patterns
  redacted = redacted.replace(
    /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    "[SSN_REDACTED]"
  );

  return redacted;
}

export { redactPii };
