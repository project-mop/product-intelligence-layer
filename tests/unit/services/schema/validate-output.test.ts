/**
 * Unit Tests for Output Validation Service
 *
 * Tests the validateOutput function for validating LLM responses
 * against JSON Schema definitions.
 *
 * @see src/server/services/schema/validate-output.ts
 * @see docs/stories/4-2-output-schema-enforcement.md
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { validateOutput } from "~/server/services/schema/validate-output";

describe("validateOutput", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("successful validation (AC #1, #2, #8)", () => {
    it("should return success with validated data for valid JSON output", () => {
      const schema = {
        type: "object" as const,
        required: ["shortDescription"],
        properties: {
          shortDescription: { type: "string" as const, minLength: 1 },
          price: { type: "number" as const },
        },
      };

      const rawResponse = JSON.stringify({
        shortDescription: "A great product",
        price: 29.99,
      });

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          shortDescription: "A great product",
          price: 29.99,
        });
      }
    });

    it("should strip unknown fields from output", () => {
      const schema = {
        type: "object" as const,
        required: ["name"],
        properties: {
          name: { type: "string" as const },
        },
      };

      const rawResponse = JSON.stringify({
        name: "Widget",
        extraField: "should be stripped",
      });

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: "Widget" });
        expect(result.data).not.toHaveProperty("extraField");
      }
    });
  });

  describe("type coercion (AC #9)", () => {
    it("should coerce string to number in output", () => {
      const schema = {
        type: "object" as const,
        required: ["price"],
        properties: {
          price: { type: "number" as const },
        },
      };

      const rawResponse = JSON.stringify({ price: "19.99" });

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.price).toBe(19.99);
        expect(typeof result.data.price).toBe("number");
      }
    });

    it("should coerce string to integer in output", () => {
      const schema = {
        type: "object" as const,
        required: ["count"],
        properties: {
          count: { type: "integer" as const },
        },
      };

      const rawResponse = JSON.stringify({ count: "42" });

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(42);
      }
    });

    it("should coerce string boolean to boolean in output", () => {
      const schema = {
        type: "object" as const,
        required: ["active"],
        properties: {
          active: { type: "boolean" as const },
        },
      };

      const rawResponse = JSON.stringify({ active: "true" });

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.active).toBe(true);
      }
    });
  });

  describe("JSON parse errors (AC #3)", () => {
    it("should return parse error for invalid JSON", () => {
      const schema = {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
        },
      };

      const rawResponse = "This is not valid JSON at all";

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.parseError).toBeDefined();
        expect(result.parseError).toContain("Could not parse response as JSON");
      }
    });

    it("should extract JSON from markdown code blocks", () => {
      const schema = {
        type: "object" as const,
        required: ["name"],
        properties: {
          name: { type: "string" as const },
        },
      };

      const rawResponse = '```json\n{"name": "Widget"}\n```';

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: "Widget" });
      }
    });

    it("should extract JSON with explanatory text around it", () => {
      const schema = {
        type: "object" as const,
        required: ["description"],
        properties: {
          description: { type: "string" as const },
        },
      };

      const rawResponse =
        'Here is the product description:\n{"description": "A great product"}\nHope that helps!';

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ description: "A great product" });
      }
    });
  });

  describe("schema validation errors (AC #4, #7)", () => {
    it("should return validation errors for missing required field", () => {
      const schema = {
        type: "object" as const,
        required: ["name", "email"],
        properties: {
          name: { type: "string" as const },
          email: { type: "string" as const },
        },
      };

      const rawResponse = JSON.stringify({ name: "Alice" });

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(false);
      if (!result.success && result.validationErrors) {
        expect(result.validationErrors.length).toBeGreaterThan(0);
        expect(result.validationErrors[0]?.path).toEqual(["email"]);
        expect(result.validationErrors[0]?.message).toContain("Required");
      }
    });

    it("should return validation errors for wrong type", () => {
      const schema = {
        type: "object" as const,
        required: ["age"],
        properties: {
          age: { type: "number" as const },
        },
      };

      const rawResponse = JSON.stringify({ age: "not-a-number" });

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(false);
      if (!result.success && result.validationErrors) {
        expect(result.validationErrors[0]?.path).toEqual(["age"]);
      }
    });

    it("should return validation errors with field-level details", () => {
      const schema = {
        type: "object" as const,
        required: ["name", "price"],
        properties: {
          name: { type: "string" as const, minLength: 3 },
          price: { type: "number" as const, minimum: 0 },
        },
      };

      const rawResponse = JSON.stringify({ name: "AB", price: -5 });

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(false);
      if (!result.success && result.validationErrors) {
        expect(result.validationErrors.length).toBe(2);
        const paths = result.validationErrors.map((e) => e.path[0]);
        expect(paths).toContain("name");
        expect(paths).toContain("price");
      }
    });
  });

  describe("nested object validation", () => {
    it("should validate nested objects", () => {
      const schema = {
        type: "object" as const,
        required: ["product"],
        properties: {
          product: {
            type: "object" as const,
            required: ["name", "price"],
            properties: {
              name: { type: "string" as const },
              price: { type: "number" as const },
            },
          },
        },
      };

      const rawResponse = JSON.stringify({
        product: { name: "Widget", price: 29.99 },
      });

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(true);
    });

    it("should return error with nested path for nested object failure", () => {
      const schema = {
        type: "object" as const,
        required: ["product"],
        properties: {
          product: {
            type: "object" as const,
            required: ["name"],
            properties: {
              name: { type: "string" as const },
            },
          },
        },
      };

      const rawResponse = JSON.stringify({ product: {} });

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(false);
      if (!result.success && result.validationErrors) {
        expect(result.validationErrors[0]?.path).toEqual(["product", "name"]);
      }
    });
  });

  describe("array validation", () => {
    it("should validate arrays", () => {
      const schema = {
        type: "object" as const,
        required: ["tags"],
        properties: {
          tags: {
            type: "array" as const,
            items: { type: "string" as const },
          },
        },
      };

      const rawResponse = JSON.stringify({ tags: ["red", "blue", "green"] });

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(true);
    });

    it("should return error for invalid array items", () => {
      const schema = {
        type: "object" as const,
        required: ["numbers"],
        properties: {
          numbers: {
            type: "array" as const,
            items: { type: "number" as const },
          },
        },
      };

      const rawResponse = JSON.stringify({ numbers: [1, 2, "three"] });

      const result = validateOutput(schema, rawResponse);

      expect(result.success).toBe(false);
      if (!result.success && result.validationErrors) {
        // Error path should include array index
        expect(result.validationErrors[0]?.path).toEqual(["numbers", "2"]);
      }
    });
  });

  describe("performance", () => {
    it("should complete validation in under 5ms for typical payload", () => {
      const schema = {
        type: "object" as const,
        required: ["shortDescription"],
        properties: {
          shortDescription: { type: "string" as const },
          longDescription: { type: "string" as const },
          category: { type: "string" as const },
          attributes: {
            type: "object" as const,
            properties: {
              color: { type: "string" as const },
              size: { type: "string" as const },
              price: { type: "number" as const },
            },
          },
          tags: {
            type: "array" as const,
            items: { type: "string" as const },
          },
        },
      };

      const rawResponse = JSON.stringify({
        shortDescription: "Premium Widget",
        longDescription: "A high-quality widget for all your needs",
        category: "Electronics",
        attributes: {
          color: "blue",
          size: "medium",
          price: 29.99,
        },
        tags: ["electronics", "gadgets", "premium"],
      });

      const start = performance.now();
      const result = validateOutput(schema, rawResponse);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5);
    });
  });

  describe("real-world output schema scenarios", () => {
    it("should validate product intelligence output schema", () => {
      const schema = {
        type: "object" as const,
        required: ["shortDescription", "category"],
        properties: {
          shortDescription: { type: "string" as const, minLength: 1, maxLength: 200 },
          longDescription: { type: "string" as const, maxLength: 1000 },
          category: { type: "string" as const },
          tags: {
            type: "array" as const,
            items: { type: "string" as const },
            maxItems: 10,
          },
          seoKeywords: {
            type: "array" as const,
            items: { type: "string" as const },
          },
          targetAudience: { type: "string" as const },
        },
      };

      // Valid LLM output
      const validResult = validateOutput(
        schema,
        JSON.stringify({
          shortDescription: "Premium wireless headphones with noise cancellation",
          longDescription: "Experience crystal-clear audio with our premium wireless headphones.",
          category: "Electronics",
          tags: ["audio", "wireless", "premium"],
          seoKeywords: ["headphones", "wireless audio", "noise cancelling"],
          targetAudience: "Music enthusiasts and professionals",
        })
      );
      expect(validResult.success).toBe(true);

      // Missing required field
      const missingResult = validateOutput(
        schema,
        JSON.stringify({
          shortDescription: "A product",
        })
      );
      expect(missingResult.success).toBe(false);
      if (!missingResult.success && missingResult.validationErrors) {
        expect(missingResult.validationErrors[0]?.path).toEqual(["category"]);
      }

      // Constraint violation
      const constraintResult = validateOutput(
        schema,
        JSON.stringify({
          shortDescription: "", // minLength: 1 violated
          category: "Electronics",
        })
      );
      expect(constraintResult.success).toBe(false);
      if (!constraintResult.success && constraintResult.validationErrors) {
        expect(constraintResult.validationErrors[0]?.path).toEqual(["shortDescription"]);
      }
    });
  });
});
