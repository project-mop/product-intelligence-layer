/**
 * Sample Payload Generator
 *
 * Generates sample payloads from JSON Schema definitions.
 * Used by the test console to pre-populate input fields.
 *
 * AC: 3 - Sample payload auto-generated from input schema:
 *   - String fields → "example"
 *   - Number fields → 0
 *   - Boolean fields → true
 *   - Required fields included, optional omitted
 *
 * @see docs/stories/3-3-in-browser-endpoint-testing.md
 */

import type { JSONSchema7, JSONSchema7TypeName } from "json-schema";

/**
 * Generate a sample payload from a JSON Schema.
 *
 * @param schema - JSON Schema Draft 7 definition
 * @param includeOptional - Whether to include optional fields (default: false)
 * @returns Sample payload object matching the schema
 */
export function generateSamplePayload(
  schema: JSONSchema7 | Record<string, unknown>,
  includeOptional = false
): Record<string, unknown> {
  // Handle empty or invalid schema
  if (!schema || typeof schema !== "object") {
    return {};
  }

  const jsonSchema = schema as JSONSchema7;

  // If schema has properties, generate object
  if (jsonSchema.type === "object" || jsonSchema.properties) {
    return generateObjectSample(jsonSchema, includeOptional);
  }

  // For non-object root schemas, wrap in object
  return {};
}

/**
 * Generate a sample object from schema properties.
 */
function generateObjectSample(
  schema: JSONSchema7,
  includeOptional: boolean
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  for (const [key, propSchema] of Object.entries(properties)) {
    // Skip if not required and not including optional
    if (!required.has(key) && !includeOptional) {
      continue;
    }

    // Handle boolean schema (true/false)
    if (typeof propSchema === "boolean") {
      if (propSchema) {
        result[key] = "example";
      }
      continue;
    }

    result[key] = generateValueForSchema(propSchema, includeOptional);
  }

  return result;
}

/**
 * Generate a sample value for a given schema type.
 */
function generateValueForSchema(
  schema: JSONSchema7,
  includeOptional: boolean
): unknown {
  // Handle const values
  if (schema.const !== undefined) {
    return schema.const;
  }

  // Handle enum values - use first option
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }

  // Handle default values
  if (schema.default !== undefined) {
    return schema.default;
  }

  // Determine type from schema
  const type = getSchemaType(schema);

  switch (type) {
    case "string":
      return generateStringSample(schema);
    case "number":
    case "integer":
      return generateNumberSample(schema);
    case "boolean":
      return true;
    case "array":
      return generateArraySample(schema, includeOptional);
    case "object":
      return generateObjectSample(schema, includeOptional);
    case "null":
      return null;
    default:
      // Unknown type - return example string
      return "example";
  }
}

/**
 * Determine the type of a schema.
 */
function getSchemaType(schema: JSONSchema7): JSONSchema7TypeName | undefined {
  if (schema.type) {
    // Handle array of types - use first non-null type
    if (Array.isArray(schema.type)) {
      return schema.type.find((t) => t !== "null") ?? schema.type[0];
    }
    return schema.type;
  }

  // Infer type from other properties
  if (schema.properties) return "object";
  if (schema.items) return "array";
  if (schema.pattern || schema.minLength || schema.maxLength) return "string";
  if (
    schema.minimum !== undefined ||
    schema.maximum !== undefined ||
    schema.multipleOf
  )
    return "number";

  return undefined;
}

/**
 * Generate a sample string value.
 */
function generateStringSample(schema: JSONSchema7): string {
  // Handle format-specific samples
  if (schema.format) {
    switch (schema.format) {
      case "email":
        return "user@example.com";
      case "uri":
      case "url":
        return "https://example.com";
      case "date":
        return "2024-01-01";
      case "date-time":
        return "2024-01-01T00:00:00Z";
      case "time":
        return "12:00:00";
      case "uuid":
        return "00000000-0000-0000-0000-000000000000";
      case "hostname":
        return "example.com";
      case "ipv4":
        return "192.168.1.1";
      case "ipv6":
        return "::1";
    }
  }

  // Handle pattern - return example
  if (schema.pattern) {
    return "example";
  }

  // Handle minLength
  if (schema.minLength && schema.minLength > 7) {
    return "example".padEnd(schema.minLength, "x");
  }

  return "example";
}

/**
 * Generate a sample number value.
 */
function generateNumberSample(schema: JSONSchema7): number {
  // Use minimum if specified
  if (schema.minimum !== undefined) {
    return schema.minimum;
  }

  // Use exclusiveMinimum if specified
  if (schema.exclusiveMinimum !== undefined) {
    return schema.exclusiveMinimum + 1;
  }

  // Default to 0
  return 0;
}

/**
 * Generate a sample array value.
 */
function generateArraySample(
  schema: JSONSchema7,
  includeOptional: boolean
): unknown[] {
  // If no items schema, return empty array
  if (!schema.items) {
    return [];
  }

  // Handle tuple validation (array of schemas)
  if (Array.isArray(schema.items)) {
    return schema.items.map((itemSchema) => {
      if (typeof itemSchema === "boolean") {
        return itemSchema ? "example" : null;
      }
      return generateValueForSchema(itemSchema, includeOptional);
    });
  }

  // Handle boolean items schema
  if (typeof schema.items === "boolean") {
    return schema.items ? ["example"] : [];
  }

  // Generate single sample item
  const sampleItem = generateValueForSchema(schema.items, includeOptional);
  return [sampleItem];
}
