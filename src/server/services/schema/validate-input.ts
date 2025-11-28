/**
 * Input Validation Service
 *
 * Validates API request input against JSON Schema definitions.
 * Converts JSON Schema to Zod for runtime validation with type coercion.
 *
 * AC covered:
 * - AC 1: Validates against process inputSchema
 * - AC 2: Uses Zod schemas converted from JSON Schema
 * - AC 6: Collects all validation errors
 * - AC 7: Returns validated input on success
 * - AC 8: Strips unknown fields (strict mode)
 * - AC 9: Type coercion for minor mismatches
 * - AC 10: Performance < 10ms for typical payloads
 *
 * @see docs/stories/4-1-input-schema-validation.md
 */

import type { JSONSchema7 } from "json-schema";
import type { ValidationResult, ValidationIssue } from "./types";
import { jsonSchemaToZod } from "./utils";

/**
 * Validate input data against a JSON Schema.
 *
 * @param inputSchema - JSON Schema defining expected input structure
 * @param input - Input data to validate
 * @returns Validation result with either validated data or error array
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: "object",
 *   required: ["productName"],
 *   properties: {
 *     productName: { type: "string", minLength: 1 },
 *     price: { type: "number", minimum: 0 }
 *   }
 * };
 *
 * const result = validateInput(schema, { productName: "Widget", price: "19.99" });
 * // result.success === true
 * // result.data === { productName: "Widget", price: 19.99 } // price coerced
 * ```
 */
export function validateInput(
  inputSchema: JSONSchema7 | Record<string, unknown>,
  input: Record<string, unknown>
): ValidationResult {
  const startTime = performance.now();

  try {
    // Convert JSON Schema to Zod schema
    const zodSchema = jsonSchemaToZod(inputSchema);

    // Validate input with Zod
    const result = zodSchema.safeParse(input);

    const duration = performance.now() - startTime;

    // Log performance (AC #10)
    if (duration > 10) {
      console.warn(
        `[Validation] Slow validation: ${duration.toFixed(2)}ms (threshold: 10ms)`
      );
    }

    if (result.success) {
      return {
        success: true,
        data: result.data as Record<string, unknown>,
      };
    }

    // Convert Zod errors to ValidationIssue array (AC #6 - collect all errors)
    const errors: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.map(String), // Convert number indices to strings
      message: issue.message,
    }));

    return {
      success: false,
      errors,
    };
  } catch (error) {
    // Handle unexpected errors during schema conversion
    const duration = performance.now() - startTime;
    console.error(
      `[Validation] Error during validation (${duration.toFixed(2)}ms):`,
      error
    );

    return {
      success: false,
      errors: [
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
