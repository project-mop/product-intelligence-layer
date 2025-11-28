/**
 * Schema Utilities
 *
 * Converts JSON Schema to Zod schemas for runtime validation.
 * Supports type coercion and constraint conversion.
 *
 * Supported types: string, number, integer, boolean, array, object
 * Supported constraints: minLength, maxLength, minimum, maximum, pattern, required
 *
 * @see docs/stories/4-1-input-schema-validation.md
 * @see src/lib/schema/sample-generator.ts for similar JSON Schema parsing
 */

import { z, type ZodTypeAny } from "zod";
import type { JSONSchema7, JSONSchema7TypeName } from "json-schema";

/**
 * Convert a JSON Schema to a Zod schema.
 *
 * @param schema - JSON Schema Draft 7 definition
 * @returns Zod schema that validates according to the JSON Schema
 *
 * @example
 * ```typescript
 * const jsonSchema = {
 *   type: "object",
 *   required: ["name"],
 *   properties: {
 *     name: { type: "string", minLength: 1 },
 *     age: { type: "number", minimum: 0 }
 *   }
 * };
 * const zodSchema = jsonSchemaToZod(jsonSchema);
 * const result = zodSchema.safeParse({ name: "John", age: 30 });
 * ```
 */
export function jsonSchemaToZod(
  schema: JSONSchema7 | Record<string, unknown>
): ZodTypeAny {
  // Handle empty or invalid schema
  if (!schema || typeof schema !== "object") {
    return z.unknown();
  }

  const jsonSchema = schema as JSONSchema7;

  // Determine type from schema
  const type = getSchemaType(jsonSchema);

  switch (type) {
    case "string":
      return createStringSchema(jsonSchema);
    case "number":
    case "integer":
      return createNumberSchema(jsonSchema, type === "integer");
    case "boolean":
      return createBooleanSchema();
    case "array":
      return createArraySchema(jsonSchema);
    case "object":
      return createObjectSchema(jsonSchema);
    case "null":
      return z.null();
    default:
      // If type is not specified but has properties, treat as object
      if (jsonSchema.properties) {
        return createObjectSchema(jsonSchema);
      }
      // Unknown type - accept any
      return z.unknown();
  }
}

/**
 * Determine the type of a JSON Schema.
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
 * Create a Zod string schema with constraints.
 */
function createStringSchema(schema: JSONSchema7): ZodTypeAny {
  let zodSchema = z.string();

  // Apply constraints
  if (schema.minLength !== undefined) {
    zodSchema = zodSchema.min(schema.minLength);
  }
  if (schema.maxLength !== undefined) {
    zodSchema = zodSchema.max(schema.maxLength);
  }
  if (schema.pattern) {
    zodSchema = zodSchema.regex(new RegExp(schema.pattern));
  }

  // Handle format
  if (schema.format) {
    switch (schema.format) {
      case "email":
        zodSchema = zodSchema.email();
        break;
      case "uri":
      case "url":
        zodSchema = zodSchema.url();
        break;
      case "uuid":
        zodSchema = zodSchema.uuid();
        break;
      // Other formats: date, date-time, time, etc. could be added
    }
  }

  return zodSchema;
}

/**
 * Create a Zod number schema with constraints and coercion.
 */
function createNumberSchema(
  schema: JSONSchema7,
  isInteger: boolean
): ZodTypeAny {
  let baseSchema = isInteger ? z.number().int() : z.number();

  if (schema.minimum !== undefined) {
    baseSchema = baseSchema.min(schema.minimum);
  }
  if (schema.maximum !== undefined) {
    baseSchema = baseSchema.max(schema.maximum);
  }
  if (schema.exclusiveMinimum !== undefined) {
    baseSchema = baseSchema.gt(schema.exclusiveMinimum);
  }
  if (schema.exclusiveMaximum !== undefined) {
    baseSchema = baseSchema.lt(schema.exclusiveMaximum);
  }

  // Wrap with coercion preprocessor
  return z.preprocess((val) => {
    if (typeof val === "string" && val.trim() !== "") {
      const num = Number(val);
      if (!isNaN(num)) {
        return num;
      }
    }
    return val;
  }, baseSchema);
}

/**
 * Create a Zod boolean schema with coercion.
 */
function createBooleanSchema(): ZodTypeAny {
  // Preprocess for type coercion: string booleans to actual booleans
  return z.preprocess((val) => {
    if (typeof val === "string") {
      const lower = val.toLowerCase();
      if (lower === "true") return true;
      if (lower === "false") return false;
    }
    return val;
  }, z.boolean());
}

/**
 * Create a Zod array schema.
 */
function createArraySchema(schema: JSONSchema7): ZodTypeAny {
  let itemSchema: ZodTypeAny = z.unknown();

  if (schema.items) {
    // Handle single schema for all items
    if (!Array.isArray(schema.items) && typeof schema.items !== "boolean") {
      itemSchema = jsonSchemaToZod(schema.items);
    }
    // For tuple schemas (array of items), use first item schema or unknown
    if (Array.isArray(schema.items) && schema.items.length > 0) {
      const firstItem = schema.items[0];
      if (firstItem !== undefined && typeof firstItem !== "boolean") {
        itemSchema = jsonSchemaToZod(firstItem);
      }
    }
  }

  let arraySchema = z.array(itemSchema);

  // Apply constraints
  if (schema.minItems !== undefined) {
    arraySchema = arraySchema.min(schema.minItems);
  }
  if (schema.maxItems !== undefined) {
    arraySchema = arraySchema.max(schema.maxItems);
  }

  return arraySchema;
}

/**
 * Create a Zod object schema with strict mode.
 */
function createObjectSchema(schema: JSONSchema7): ZodTypeAny {
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  const shape: Record<string, ZodTypeAny> = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    // Handle boolean schema (true means any, false means never)
    if (typeof propSchema === "boolean") {
      shape[key] = propSchema ? z.unknown() : z.never();
      continue;
    }

    let fieldSchema = jsonSchemaToZod(propSchema);

    // Make optional if not required
    if (!required.has(key)) {
      fieldSchema = fieldSchema.optional();
    }

    shape[key] = fieldSchema;
  }

  // Use strict mode to strip unknown fields
  // .strict() rejects unknown keys with an error
  // .strip() silently removes unknown keys (AC #8)
  return z.object(shape).strip();
}
