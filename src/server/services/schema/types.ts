/**
 * Schema Validation Types
 *
 * Type definitions for input schema validation.
 * Used by the validation service to convert JSON Schema to Zod
 * and report validation errors.
 *
 * @see docs/stories/4-1-input-schema-validation.md
 */

/**
 * A single validation issue with path and message.
 * Path is an array to support nested field errors.
 */
export interface ValidationIssue {
  /** Path to the field that failed validation (e.g., ["attributes", "price"]) */
  path: string[];
  /** Human-readable error message */
  message: string;
}

/**
 * Result of successful validation.
 */
export interface ValidationSuccess {
  success: true;
  /** Validated and coerced data with unknown fields stripped */
  data: Record<string, unknown>;
}

/**
 * Result of failed validation.
 */
export interface ValidationFailure {
  success: false;
  /** Array of all validation issues (not just the first) */
  errors: ValidationIssue[];
}

/**
 * Union type for validation result.
 */
export type ValidationResult = ValidationSuccess | ValidationFailure;
