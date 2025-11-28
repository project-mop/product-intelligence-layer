/**
 * Schema Services
 *
 * Barrel export for schema validation services.
 *
 * @see docs/stories/4-1-input-schema-validation.md
 * @see docs/stories/4-2-output-schema-enforcement.md
 */

export { validateInput } from "./validate-input";
export { validateOutput } from "./validate-output";
export { jsonSchemaToZod } from "./utils";
export type {
  ValidationResult,
  ValidationSuccess,
  ValidationFailure,
  ValidationIssue,
} from "./types";
export type {
  OutputValidationResult,
  OutputValidationSuccess,
  OutputParseFailure,
  OutputSchemaFailure,
} from "./validate-output";
