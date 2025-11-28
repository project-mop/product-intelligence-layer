/**
 * Unit Tests for JSON Schema to Zod Conversion
 *
 * Tests the jsonSchemaToZod utility function for converting
 * JSON Schema definitions to Zod schemas for runtime validation.
 *
 * @see src/server/services/schema/utils.ts
 * @see docs/stories/4-1-input-schema-validation.md
 */

import { describe, expect, it } from "vitest";
import { jsonSchemaToZod } from "~/server/services/schema/utils";

describe("jsonSchemaToZod", () => {
  describe("string type", () => {
    it("should validate basic string", () => {
      const schema = { type: "string" as const };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse("hello").success).toBe(true);
      expect(zodSchema.safeParse(123).success).toBe(false);
    });

    it("should apply minLength constraint", () => {
      const schema = { type: "string" as const, minLength: 3 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse("abc").success).toBe(true);
      expect(zodSchema.safeParse("ab").success).toBe(false);
    });

    it("should apply maxLength constraint", () => {
      const schema = { type: "string" as const, maxLength: 5 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse("hello").success).toBe(true);
      expect(zodSchema.safeParse("hello!").success).toBe(false);
    });

    it("should apply pattern constraint", () => {
      const schema = { type: "string" as const, pattern: "^[a-z]+$" };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse("hello").success).toBe(true);
      expect(zodSchema.safeParse("Hello123").success).toBe(false);
    });

    it("should handle email format", () => {
      const schema = { type: "string" as const, format: "email" };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse("test@example.com").success).toBe(true);
      expect(zodSchema.safeParse("not-an-email").success).toBe(false);
    });

    it("should handle url format", () => {
      const schema = { type: "string" as const, format: "url" };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse("https://example.com").success).toBe(true);
      expect(zodSchema.safeParse("not-a-url").success).toBe(false);
    });

    it("should handle uuid format", () => {
      const schema = { type: "string" as const, format: "uuid" };
      const zodSchema = jsonSchemaToZod(schema);

      expect(
        zodSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success
      ).toBe(true);
      expect(zodSchema.safeParse("not-a-uuid").success).toBe(false);
    });
  });

  describe("number type", () => {
    it("should validate basic number", () => {
      const schema = { type: "number" as const };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(42).success).toBe(true);
      expect(zodSchema.safeParse(3.14).success).toBe(true);
      expect(zodSchema.safeParse("hello").success).toBe(false);
    });

    it("should apply minimum constraint", () => {
      const schema = { type: "number" as const, minimum: 0 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(0).success).toBe(true);
      expect(zodSchema.safeParse(100).success).toBe(true);
      expect(zodSchema.safeParse(-1).success).toBe(false);
    });

    it("should apply maximum constraint", () => {
      const schema = { type: "number" as const, maximum: 100 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(100).success).toBe(true);
      expect(zodSchema.safeParse(101).success).toBe(false);
    });

    it("should apply exclusiveMinimum constraint", () => {
      const schema = { type: "number" as const, exclusiveMinimum: 0 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(1).success).toBe(true);
      expect(zodSchema.safeParse(0).success).toBe(false);
    });

    it("should apply exclusiveMaximum constraint", () => {
      const schema = { type: "number" as const, exclusiveMaximum: 100 };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(99).success).toBe(true);
      expect(zodSchema.safeParse(100).success).toBe(false);
    });

    it("should coerce string to number (AC #9)", () => {
      const schema = { type: "number" as const };
      const zodSchema = jsonSchemaToZod(schema);

      const result = zodSchema.safeParse("123");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(123);
      }
    });

    it("should coerce decimal string to number", () => {
      const schema = { type: "number" as const };
      const zodSchema = jsonSchemaToZod(schema);

      const result = zodSchema.safeParse("19.99");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(19.99);
      }
    });

    it("should not coerce invalid string to number", () => {
      const schema = { type: "number" as const };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse("not-a-number").success).toBe(false);
    });
  });

  describe("integer type", () => {
    it("should validate integer values", () => {
      const schema = { type: "integer" as const };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(42).success).toBe(true);
      expect(zodSchema.safeParse(3.14).success).toBe(false);
    });

    it("should coerce string to integer", () => {
      const schema = { type: "integer" as const };
      const zodSchema = jsonSchemaToZod(schema);

      const result = zodSchema.safeParse("42");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });
  });

  describe("boolean type", () => {
    it("should validate boolean values", () => {
      const schema = { type: "boolean" as const };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(true).success).toBe(true);
      expect(zodSchema.safeParse(false).success).toBe(true);
      expect(zodSchema.safeParse("hello").success).toBe(false);
    });

    it("should coerce string 'true' to boolean (AC #9)", () => {
      const schema = { type: "boolean" as const };
      const zodSchema = jsonSchemaToZod(schema);

      const result = zodSchema.safeParse("true");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(true);
      }
    });

    it("should coerce string 'false' to boolean", () => {
      const schema = { type: "boolean" as const };
      const zodSchema = jsonSchemaToZod(schema);

      const result = zodSchema.safeParse("false");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(false);
      }
    });

    it("should not coerce invalid string to boolean", () => {
      const schema = { type: "boolean" as const };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse("yes").success).toBe(false);
    });
  });

  describe("array type", () => {
    it("should validate array of strings", () => {
      const schema = {
        type: "array" as const,
        items: { type: "string" as const },
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(["a", "b", "c"]).success).toBe(true);
      expect(zodSchema.safeParse([1, 2, 3]).success).toBe(false);
    });

    it("should validate array of numbers", () => {
      const schema = {
        type: "array" as const,
        items: { type: "number" as const },
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse([1, 2, 3]).success).toBe(true);
      expect(zodSchema.safeParse(["a", "b"]).success).toBe(false);
    });

    it("should apply minItems constraint", () => {
      const schema = {
        type: "array" as const,
        items: { type: "string" as const },
        minItems: 2,
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(["a", "b"]).success).toBe(true);
      expect(zodSchema.safeParse(["a"]).success).toBe(false);
    });

    it("should apply maxItems constraint", () => {
      const schema = {
        type: "array" as const,
        items: { type: "string" as const },
        maxItems: 3,
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(["a", "b", "c"]).success).toBe(true);
      expect(zodSchema.safeParse(["a", "b", "c", "d"]).success).toBe(false);
    });

    it("should handle nested object arrays", () => {
      const schema = {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const },
          },
          required: ["name"],
        },
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse([{ name: "Alice" }]).success).toBe(true);
      expect(zodSchema.safeParse([{}]).success).toBe(false);
    });
  });

  describe("object type", () => {
    it("should validate object with required fields", () => {
      const schema = {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          age: { type: "number" as const },
        },
        required: ["name"],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse({ name: "Alice" }).success).toBe(true);
      expect(zodSchema.safeParse({ name: "Alice", age: 30 }).success).toBe(true);
      expect(zodSchema.safeParse({}).success).toBe(false);
    });

    it("should strip unknown fields (AC #8)", () => {
      const schema = {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
        },
        required: ["name"],
      };
      const zodSchema = jsonSchemaToZod(schema);

      const result = zodSchema.safeParse({ name: "Alice", extra: "field" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: "Alice" });
        expect(result.data).not.toHaveProperty("extra");
      }
    });

    it("should handle nested objects", () => {
      const schema = {
        type: "object" as const,
        properties: {
          user: {
            type: "object" as const,
            properties: {
              name: { type: "string" as const },
              email: { type: "string" as const },
            },
            required: ["name"],
          },
        },
        required: ["user"],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse({ user: { name: "Alice" } }).success).toBe(
        true
      );
      expect(zodSchema.safeParse({ user: {} }).success).toBe(false);
    });

    it("should handle deeply nested objects", () => {
      const schema = {
        type: "object" as const,
        properties: {
          level1: {
            type: "object" as const,
            properties: {
              level2: {
                type: "object" as const,
                properties: {
                  level3: { type: "string" as const },
                },
                required: ["level3"],
              },
            },
            required: ["level2"],
          },
        },
        required: ["level1"],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(
        zodSchema.safeParse({
          level1: { level2: { level3: "deep value" } },
        }).success
      ).toBe(true);

      expect(
        zodSchema.safeParse({
          level1: { level2: {} },
        }).success
      ).toBe(false);
    });
  });

  describe("null type", () => {
    it("should validate null values", () => {
      const schema = { type: "null" as const };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse(null).success).toBe(true);
      expect(zodSchema.safeParse("hello").success).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty schema", () => {
      const zodSchema = jsonSchemaToZod({});

      // Empty schema should accept anything
      expect(zodSchema.safeParse("hello").success).toBe(true);
      expect(zodSchema.safeParse(123).success).toBe(true);
    });

    it("should handle schema with only properties (infer object type)", () => {
      const schema = {
        properties: {
          name: { type: "string" as const },
        },
        required: ["name"],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse({ name: "Alice" }).success).toBe(true);
      expect(zodSchema.safeParse({}).success).toBe(false);
    });

    it("should handle boolean schema true (any)", () => {
      const schema = {
        type: "object" as const,
        properties: {
          anything: true,
        },
        required: ["anything"],
      };
      const zodSchema = jsonSchemaToZod(schema);

      expect(zodSchema.safeParse({ anything: "hello" }).success).toBe(true);
      expect(zodSchema.safeParse({ anything: 123 }).success).toBe(true);
    });
  });

  describe("real-world schema examples", () => {
    it("should handle product intelligence input schema", () => {
      const schema = {
        type: "object" as const,
        required: ["productName", "category"],
        properties: {
          productName: { type: "string" as const, minLength: 1 },
          category: { type: "string" as const },
          attributes: {
            type: "object" as const,
            properties: {
              color: { type: "string" as const },
              price: { type: "number" as const, minimum: 0 },
            },
          },
        },
      };
      const zodSchema = jsonSchemaToZod(schema);

      // Valid input
      expect(
        zodSchema.safeParse({
          productName: "Widget",
          category: "Electronics",
          attributes: { color: "blue", price: 29.99 },
        }).success
      ).toBe(true);

      // Missing required field
      expect(
        zodSchema.safeParse({
          productName: "Widget",
        }).success
      ).toBe(false);

      // Empty productName
      expect(
        zodSchema.safeParse({
          productName: "",
          category: "Electronics",
        }).success
      ).toBe(false);

      // Negative price
      expect(
        zodSchema.safeParse({
          productName: "Widget",
          category: "Electronics",
          attributes: { price: -10 },
        }).success
      ).toBe(false);

      // Type coercion for price
      const result = zodSchema.safeParse({
        productName: "Widget",
        category: "Electronics",
        attributes: { price: "19.99" },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as { attributes: { price: number } }).attributes.price).toBe(19.99);
      }
    });
  });
});
