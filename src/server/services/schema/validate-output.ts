/**
 * Output Validation Service
 *
 * Validates LLM responses against JSON Schema definitions.
 * Handles JSON parsing, schema validation, and type coercion.
 *
 * AC covered:
 * - AC 1: Validates LLM responses against process outputSchema
 * - AC 2: Uses Zod schemas converted from JSON Schema
 * - AC 8: Returns parsed, typed output object on success
 * - AC 9: Type coercion for minor mismatches (via jsonSchemaToZod)
 *
 * @see docs/stories/4-2-output-schema-enforcement.md
 */

import type { JSONSchema7 } from "json-schema";
import type { ValidationIssue } from "./types";
import { jsonSchemaToZod } from "./utils";

/**
 * Result of output validation when JSON parsing succeeds and schema validation passes.
 */
export interface OutputValidationSuccess {
  success: true;
  /** Validated and coerced data */
  data: Record<string, unknown>;
}

/**
 * Result of output validation when JSON parsing fails.
 */
export interface OutputParseFailure {
  success: false;
  /** JSON parse error message */
  parseError: string;
  validationErrors?: never;
}

/**
 * Result of output validation when JSON parses but schema validation fails.
 */
export interface OutputSchemaFailure {
  success: false;
  parseError?: never;
  /** Array of all validation issues */
  validationErrors: ValidationIssue[];
}

/**
 * Union type for output validation result.
 */
export type OutputValidationResult =
  | OutputValidationSuccess
  | OutputParseFailure
  | OutputSchemaFailure;

/**
 * Validate LLM output against a JSON Schema.
 *
 * @param outputSchema - JSON Schema defining expected output structure
 * @param rawResponse - Raw LLM response string
 * @returns Validation result with either validated data, parse error, or validation errors
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: "object",
 *   required: ["shortDescription"],
 *   properties: {
 *     shortDescription: { type: "string", minLength: 1 }
 *   }
 * };
 *
 * const result = validateOutput(schema, '{"shortDescription": "A great product"}');
 * if (result.success) {
 *   console.log(result.data); // { shortDescription: "A great product" }
 * }
 * ```
 */
export function validateOutput(
  outputSchema: JSONSchema7 | Record<string, unknown>,
  rawResponse: string
): OutputValidationResult {
  const startTime = performance.now();

  // Step 1: Try to parse JSON from raw response
  const parseResult = tryParseJson(rawResponse);

  if (!parseResult.success) {
    const duration = performance.now() - startTime;
    logValidationTiming(duration, "parse_failed");
    return {
      success: false,
      parseError: parseResult.error,
    };
  }

  // Step 2: Validate parsed JSON against schema
  try {
    const zodSchema = jsonSchemaToZod(outputSchema);
    const result = zodSchema.safeParse(parseResult.data);

    const duration = performance.now() - startTime;

    // Log performance (AC constraint: < 5ms)
    if (duration > 5) {
      console.warn(
        `[OutputValidation] Slow validation: ${duration.toFixed(2)}ms (threshold: 5ms)`
      );
    }

    if (result.success) {
      logValidationTiming(duration, "success");
      return {
        success: true,
        data: result.data as Record<string, unknown>,
      };
    }

    // Convert Zod errors to ValidationIssue array
    const errors: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.map(String),
      message: issue.message,
    }));

    logValidationTiming(duration, "schema_failed");
    return {
      success: false,
      validationErrors: errors,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(
      `[OutputValidation] Error during validation (${duration.toFixed(2)}ms):`,
      error
    );

    return {
      success: false,
      validationErrors: [
        {
          path: [],
          message:
            error instanceof Error
              ? `Schema validation error: ${error.message}`
              : "Unknown schema validation error",
        },
      ],
    };
  }
}

/**
 * Try to parse text as JSON.
 *
 * Attempts to extract JSON from the response, handling cases where
 * the LLM may include extra text before/after the JSON or markdown code blocks.
 */
function tryParseJson(text: string):
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: string } {
  // First, try direct parse
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return { success: true, data: parsed as Record<string, unknown> };
    }
    if (Array.isArray(parsed)) {
      // Arrays are valid JSON but we expect objects for our use case
      // However, let the schema validation handle this
      return { success: true, data: parsed as unknown as Record<string, unknown> };
    }
    return { success: false, error: "Parsed value is not an object" };
  } catch {
    // Continue to extraction attempts
  }

  // Try to extract JSON from text (handle markdown code blocks)
  const trimmed = text.trim();

  // Remove markdown code blocks if present
  let cleaned = trimmed;
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Try to find JSON object boundaries
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonCandidate) as unknown;
      if (typeof parsed === "object" && parsed !== null) {
        return { success: true, data: parsed as Record<string, unknown> };
      }
    } catch {
      // Fall through to error
    }
  }

  // Also try finding array boundaries for completeness
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const jsonCandidate = cleaned.slice(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(jsonCandidate) as unknown;
      if (Array.isArray(parsed)) {
        return { success: true, data: parsed as unknown as Record<string, unknown> };
      }
    } catch {
      // Fall through to error
    }
  }

  return {
    success: false,
    error: `Could not parse response as JSON. Response starts with: ${text.slice(0, 100)}${text.length > 100 ? "..." : ""}`,
  };
}

/**
 * Log validation timing for performance monitoring.
 */
function logValidationTiming(
  durationMs: number,
  result: "success" | "parse_failed" | "schema_failed"
): void {
  // In production, this would be sent to observability system
  // For now, just debug log
  if (process.env.NODE_ENV === "development") {
    console.debug(
      `[OutputValidation] ${result} in ${durationMs.toFixed(2)}ms`
    );
  }
}
