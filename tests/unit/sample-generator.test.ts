/**
 * Sample Payload Generator Unit Tests
 *
 * Tests for generating sample payloads from JSON Schema definitions.
 *
 * @see docs/stories/3-3-in-browser-endpoint-testing.md
 * @see docs/testing-strategy-mvp.md
 */

import { describe, expect, it } from "vitest";
import { generateSamplePayload } from "~/lib/schema/sample-generator";

describe("generateSamplePayload", () => {
  describe("basic types", () => {
    it("should generate 'example' for string fields", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ name: "example" });
    });

    it("should generate 0 for number fields", () => {
      const schema = {
        type: "object",
        properties: {
          count: { type: "number" },
        },
        required: ["count"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ count: 0 });
    });

    it("should generate 0 for integer fields", () => {
      const schema = {
        type: "object",
        properties: {
          age: { type: "integer" },
        },
        required: ["age"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ age: 0 });
    });

    it("should generate true for boolean fields", () => {
      const schema = {
        type: "object",
        properties: {
          active: { type: "boolean" },
        },
        required: ["active"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ active: true });
    });

    it("should generate null for null type fields", () => {
      const schema = {
        type: "object",
        properties: {
          deleted: { type: "null" },
        },
        required: ["deleted"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ deleted: null });
    });
  });

  describe("required vs optional fields", () => {
    it("should include only required fields by default", () => {
      const schema = {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["id", "name"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({
        id: "example",
        name: "example",
      });
      expect(result).not.toHaveProperty("description");
    });

    it("should include optional fields when includeOptional is true", () => {
      const schema = {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["id", "name"],
      };

      const result = generateSamplePayload(schema, true);
      expect(result).toEqual({
        id: "example",
        name: "example",
        description: "example",
      });
    });

    it("should return empty object when no required fields", () => {
      const schema = {
        type: "object",
        properties: {
          optional1: { type: "string" },
          optional2: { type: "number" },
        },
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({});
    });
  });

  describe("array fields", () => {
    it("should generate array with single sample element", () => {
      const schema = {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["tags"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ tags: ["example"] });
    });

    it("should generate array with complex item type", () => {
      const schema = {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "number" },
                name: { type: "string" },
              },
              required: ["id", "name"],
            },
          },
        },
        required: ["items"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({
        items: [{ id: 0, name: "example" }],
      });
    });

    it("should handle tuple validation (array of schemas)", () => {
      const schema = {
        type: "object",
        properties: {
          coords: {
            type: "array",
            items: [
              { type: "number" },
              { type: "number" },
            ],
          },
        },
        required: ["coords"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ coords: [0, 0] });
    });

    it("should return empty array when no items schema", () => {
      const schema = {
        type: "object",
        properties: {
          data: { type: "array" },
        },
        required: ["data"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ data: [] });
    });
  });

  describe("nested objects", () => {
    it("should generate nested object recursively", () => {
      const schema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
            },
            required: ["name", "email"],
          },
        },
        required: ["user"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({
        user: {
          name: "example",
          email: "example",
        },
      });
    });

    it("should handle deeply nested structures", () => {
      const schema = {
        type: "object",
        properties: {
          level1: {
            type: "object",
            properties: {
              level2: {
                type: "object",
                properties: {
                  level3: { type: "string" },
                },
                required: ["level3"],
              },
            },
            required: ["level2"],
          },
        },
        required: ["level1"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({
        level1: {
          level2: {
            level3: "example",
          },
        },
      });
    });
  });

  describe("special values", () => {
    it("should use const values when present", () => {
      const schema = {
        type: "object",
        properties: {
          status: { const: "active" },
        },
        required: ["status"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ status: "active" });
    });

    it("should use first enum value", () => {
      const schema = {
        type: "object",
        properties: {
          status: { enum: ["pending", "active", "archived"] },
        },
        required: ["status"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ status: "pending" });
    });

    it("should use default value when present", () => {
      const schema = {
        type: "object",
        properties: {
          page: { type: "number", default: 1 },
        },
        required: ["page"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ page: 1 });
    });

    it("should use minimum value when present", () => {
      const schema = {
        type: "object",
        properties: {
          age: { type: "number", minimum: 18 },
        },
        required: ["age"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ age: 18 });
    });

    it("should use exclusiveMinimum + 1 when present", () => {
      const schema = {
        type: "object",
        properties: {
          count: { type: "number", exclusiveMinimum: 0 },
        },
        required: ["count"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ count: 1 });
    });
  });

  describe("string formats", () => {
    it("should generate email format", () => {
      const schema = {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
        },
        required: ["email"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ email: "user@example.com" });
    });

    it("should generate uri format", () => {
      const schema = {
        type: "object",
        properties: {
          url: { type: "string", format: "uri" },
        },
        required: ["url"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ url: "https://example.com" });
    });

    it("should generate date format", () => {
      const schema = {
        type: "object",
        properties: {
          date: { type: "string", format: "date" },
        },
        required: ["date"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ date: "2024-01-01" });
    });

    it("should generate date-time format", () => {
      const schema = {
        type: "object",
        properties: {
          timestamp: { type: "string", format: "date-time" },
        },
        required: ["timestamp"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ timestamp: "2024-01-01T00:00:00Z" });
    });

    it("should generate uuid format", () => {
      const schema = {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
        },
        required: ["id"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ id: "00000000-0000-0000-0000-000000000000" });
    });

    it("should generate hostname format", () => {
      const schema = {
        type: "object",
        properties: {
          host: { type: "string", format: "hostname" },
        },
        required: ["host"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ host: "example.com" });
    });
  });

  describe("edge cases", () => {
    it("should return empty object for empty schema", () => {
      const result = generateSamplePayload({});
      expect(result).toEqual({});
    });

    it("should return empty object for null schema", () => {
      const result = generateSamplePayload(null as unknown as Record<string, unknown>);
      expect(result).toEqual({});
    });

    it("should return empty object for undefined schema", () => {
      const result = generateSamplePayload(undefined as unknown as Record<string, unknown>);
      expect(result).toEqual({});
    });

    it("should handle boolean true property schema", () => {
      const schema = {
        type: "object",
        properties: {
          anything: true,
        },
        required: ["anything"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ anything: "example" });
    });

    it("should handle boolean false property schema", () => {
      const schema = {
        type: "object",
        properties: {
          nothing: false,
        },
        required: ["nothing"],
      };

      const result = generateSamplePayload(schema);
      // False schema means nothing is valid, so we skip it
      expect(result).toEqual({});
    });

    it("should infer object type from properties", () => {
      const schema = {
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({ name: "example" });
    });

    it("should handle minLength constraint", () => {
      const schema = {
        type: "object",
        properties: {
          code: { type: "string", minLength: 10 },
        },
        required: ["code"],
      };

      const result = generateSamplePayload(schema);
      expect(result.code).toHaveLength(10);
    });

    it("should handle string with pattern", () => {
      const schema = {
        type: "object",
        properties: {
          code: { type: "string", pattern: "^[A-Z]{3}$" },
        },
        required: ["code"],
      };

      const result = generateSamplePayload(schema);
      // We return "example" since we can't generate from pattern
      expect(result).toEqual({ code: "example" });
    });
  });

  describe("complex real-world schemas", () => {
    it("should generate sample for product metadata schema", () => {
      const schema = {
        type: "object",
        properties: {
          productName: { type: "string" },
          category: { type: "string" },
          price: { type: "number", minimum: 0 },
          inStock: { type: "boolean" },
          attributes: {
            type: "object",
            properties: {
              color: { type: "string" },
              size: { type: "string" },
            },
            required: ["color"],
          },
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["productName", "category", "price", "attributes", "tags"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({
        productName: "example",
        category: "example",
        price: 0,
        attributes: {
          color: "example",
        },
        tags: ["example"],
      });
    });

    it("should generate sample for API request schema", () => {
      const schema = {
        type: "object",
        properties: {
          query: { type: "string" },
          filters: {
            type: "object",
            properties: {
              startDate: { type: "string", format: "date" },
              endDate: { type: "string", format: "date" },
              limit: { type: "integer", minimum: 1, default: 10 },
            },
            required: ["startDate", "endDate"],
          },
        },
        required: ["query", "filters"],
      };

      const result = generateSamplePayload(schema);
      expect(result).toEqual({
        query: "example",
        filters: {
          startDate: "2024-01-01",
          endDate: "2024-01-01",
        },
      });
    });
  });
});
