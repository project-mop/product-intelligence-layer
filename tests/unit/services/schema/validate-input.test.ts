/**
 * Unit Tests for Input Validation Service
 *
 * Tests the validateInput function for validating API request input
 * against JSON Schema definitions.
 *
 * @see src/server/services/schema/validate-input.ts
 * @see docs/stories/4-1-input-schema-validation.md
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { validateInput } from "~/server/services/schema/validate-input";

describe("validateInput", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("successful validation (AC #7)", () => {
    it("should return success with validated data for valid input", () => {
      const schema = {
        type: "object" as const,
        required: ["name"],
        properties: {
          name: { type: "string" as const },
          age: { type: "number" as const },
        },
      };

      const result = validateInput(schema, { name: "Alice", age: 30 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: "Alice", age: 30 });
      }
    });

    it("should strip unknown fields (AC #8)", () => {
      const schema = {
        type: "object" as const,
        required: ["name"],
        properties: {
          name: { type: "string" as const },
        },
      };

      const result = validateInput(schema, {
        name: "Alice",
        extraField: "should be stripped",
        anotherExtra: 123,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: "Alice" });
        expect(result.data).not.toHaveProperty("extraField");
        expect(result.data).not.toHaveProperty("anotherExtra");
      }
    });

    it("should coerce string to number (AC #9)", () => {
      const schema = {
        type: "object" as const,
        required: ["price"],
        properties: {
          price: { type: "number" as const },
        },
      };

      const result = validateInput(schema, { price: "19.99" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.price).toBe(19.99);
        expect(typeof result.data.price).toBe("number");
      }
    });

    it("should coerce string to integer", () => {
      const schema = {
        type: "object" as const,
        required: ["count"],
        properties: {
          count: { type: "integer" as const },
        },
      };

      const result = validateInput(schema, { count: "42" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(42);
      }
    });

    it("should coerce string boolean to boolean", () => {
      const schema = {
        type: "object" as const,
        required: ["active"],
        properties: {
          active: { type: "boolean" as const },
        },
      };

      const result = validateInput(schema, { active: "true" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.active).toBe(true);
      }
    });
  });

  describe("validation failure", () => {
    it("should return error for missing required field", () => {
      const schema = {
        type: "object" as const,
        required: ["name", "email"],
        properties: {
          name: { type: "string" as const },
          email: { type: "string" as const },
        },
      };

      const result = validateInput(schema, { name: "Alice" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.path).toEqual(["email"]);
        expect(result.errors[0]?.message).toContain("Required");
      }
    });

    it("should return error for wrong type", () => {
      const schema = {
        type: "object" as const,
        required: ["age"],
        properties: {
          age: { type: "number" as const },
        },
      };

      const result = validateInput(schema, { age: "not-a-number" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.path).toEqual(["age"]);
      }
    });

    it("should return error for constraint violation (minLength)", () => {
      const schema = {
        type: "object" as const,
        required: ["name"],
        properties: {
          name: { type: "string" as const, minLength: 3 },
        },
      };

      const result = validateInput(schema, { name: "AB" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.path).toEqual(["name"]);
      }
    });

    it("should return error for constraint violation (minimum)", () => {
      const schema = {
        type: "object" as const,
        required: ["price"],
        properties: {
          price: { type: "number" as const, minimum: 0 },
        },
      };

      const result = validateInput(schema, { price: -10 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.path).toEqual(["price"]);
      }
    });

    it("should return error for pattern mismatch", () => {
      const schema = {
        type: "object" as const,
        required: ["code"],
        properties: {
          code: { type: "string" as const, pattern: "^[A-Z]{3}$" },
        },
      };

      const result = validateInput(schema, { code: "abc123" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.path).toEqual(["code"]);
      }
    });
  });

  describe("collect all errors (AC #6)", () => {
    it("should return all validation errors, not just the first", () => {
      const schema = {
        type: "object" as const,
        required: ["name", "email", "age"],
        properties: {
          name: { type: "string" as const },
          email: { type: "string" as const },
          age: { type: "number" as const },
        },
      };

      // All fields missing
      const result = validateInput(schema, {});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(3);
        const paths = result.errors.map((e) => e.path[0]);
        expect(paths).toContain("name");
        expect(paths).toContain("email");
        expect(paths).toContain("age");
      }
    });

    it("should return multiple errors for different validation failures", () => {
      const schema = {
        type: "object" as const,
        required: ["name", "price"],
        properties: {
          name: { type: "string" as const, minLength: 3 },
          price: { type: "number" as const, minimum: 0 },
        },
      };

      const result = validateInput(schema, { name: "AB", price: -5 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(2);
        const paths = result.errors.map((e) => e.path[0]);
        expect(paths).toContain("name");
        expect(paths).toContain("price");
      }
    });
  });

  describe("nested object validation", () => {
    it("should validate nested objects", () => {
      const schema = {
        type: "object" as const,
        required: ["user"],
        properties: {
          user: {
            type: "object" as const,
            required: ["name"],
            properties: {
              name: { type: "string" as const },
              age: { type: "number" as const },
            },
          },
        },
      };

      const result = validateInput(schema, { user: { name: "Alice" } });

      expect(result.success).toBe(true);
    });

    it("should return error with nested path for nested object failure (AC #5)", () => {
      const schema = {
        type: "object" as const,
        required: ["user"],
        properties: {
          user: {
            type: "object" as const,
            required: ["name"],
            properties: {
              name: { type: "string" as const },
            },
          },
        },
      };

      const result = validateInput(schema, { user: {} });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.path).toEqual(["user", "name"]);
      }
    });

    it("should return error with deep nested path", () => {
      const schema = {
        type: "object" as const,
        required: ["attributes"],
        properties: {
          attributes: {
            type: "object" as const,
            required: ["pricing"],
            properties: {
              pricing: {
                type: "object" as const,
                required: ["amount"],
                properties: {
                  amount: { type: "number" as const, minimum: 0 },
                },
              },
            },
          },
        },
      };

      const result = validateInput(schema, {
        attributes: { pricing: { amount: -10 } },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.path).toEqual([
          "attributes",
          "pricing",
          "amount",
        ]);
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

      const result = validateInput(schema, { tags: ["red", "blue", "green"] });

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

      const result = validateInput(schema, { numbers: [1, 2, "three"] });

      expect(result.success).toBe(false);
      if (!result.success) {
        // Error path should include array index
        expect(result.errors[0]?.path).toEqual(["numbers", "2"]);
      }
    });

    it("should return error for array constraint violation", () => {
      const schema = {
        type: "object" as const,
        required: ["items"],
        properties: {
          items: {
            type: "array" as const,
            items: { type: "string" as const },
            minItems: 2,
          },
        },
      };

      const result = validateInput(schema, { items: ["one"] });

      expect(result.success).toBe(false);
    });
  });

  describe("performance (AC #10)", () => {
    it("should complete validation in under 10ms for typical payload", () => {
      const schema = {
        type: "object" as const,
        required: ["productName", "category"],
        properties: {
          productName: { type: "string" as const, minLength: 1 },
          category: { type: "string" as const },
          description: { type: "string" as const },
          attributes: {
            type: "object" as const,
            properties: {
              color: { type: "string" as const },
              size: { type: "string" as const },
              price: { type: "number" as const, minimum: 0 },
              inStock: { type: "boolean" as const },
            },
          },
          tags: {
            type: "array" as const,
            items: { type: "string" as const },
          },
        },
      };

      const input = {
        productName: "Premium Widget",
        category: "Electronics",
        description: "A high-quality widget for all your needs",
        attributes: {
          color: "blue",
          size: "medium",
          price: 29.99,
          inStock: true,
        },
        tags: ["electronics", "gadgets", "premium", "new-arrival"],
      };

      const start = performance.now();
      const result = validateInput(schema, input);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10);
    });

    it("should log warning if validation takes more than 10ms", () => {
      // Mock slow performance
      const originalNow = performance.now;
      let callCount = 0;
      vi.spyOn(performance, "now").mockImplementation(() => {
        callCount++;
        // First call returns 0, second call returns 15 (simulating 15ms)
        return callCount === 1 ? 0 : 15;
      });

      const schema = {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
        },
      };

      validateInput(schema, { name: "test" });

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("[Validation] Slow validation:")
      );

      performance.now = originalNow;
    });
  });

  describe("error handling", () => {
    it("should handle invalid schema gracefully", () => {
      // Pass a null schema - should not crash
      const result = validateInput(null as unknown as Record<string, unknown>, {
        name: "test",
      });

      // Should either succeed (accept any) or fail gracefully
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });

    it("should handle empty input", () => {
      const schema = {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
        },
      };

      const result = validateInput(schema, {});

      expect(result.success).toBe(true);
    });
  });

  describe("real-world schema scenarios", () => {
    it("should validate product intelligence input schema from story", () => {
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

      // Valid input
      const validResult = validateInput(schema, {
        productName: "Widget",
        category: "Electronics",
        attributes: { color: "blue", price: 29.99 },
      });
      expect(validResult.success).toBe(true);

      // Missing required field
      const missingResult = validateInput(schema, {
        productName: "Widget",
      });
      expect(missingResult.success).toBe(false);
      if (!missingResult.success) {
        expect(missingResult.errors[0]?.path).toEqual(["category"]);
      }

      // Invalid nested field
      const invalidNested = validateInput(schema, {
        productName: "Widget",
        category: "Electronics",
        attributes: { price: -10 },
      });
      expect(invalidNested.success).toBe(false);
      if (!invalidNested.success) {
        expect(invalidNested.errors[0]?.path).toEqual(["attributes", "price"]);
      }
    });
  });
});
