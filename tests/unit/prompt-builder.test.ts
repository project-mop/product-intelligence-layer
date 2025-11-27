/**
 * Prompt Builder Unit Tests
 *
 * Tests for prompt assembly from ProcessConfig.
 *
 * @see docs/stories/3-2-llm-gateway-integration.md
 * @see docs/testing-strategy-mvp.md
 */

import { describe, expect, it } from "vitest";
import {
  assemblePrompt,
  enhancePromptForRetry,
} from "~/server/services/process/prompt";
import type { ProcessConfig } from "~/server/services/process/types";

describe("assemblePrompt", () => {
  const baseConfig: ProcessConfig = {
    systemPrompt: "Base system prompt",
    goal: "Generate product descriptions",
    outputSchemaDescription:
      "{ title: string, description: string, price: number }",
    inputSchemaDescription: "{ productId: string, category: string }",
    maxTokens: 1024,
    temperature: 0.3,
    cacheTtlSeconds: 900,
    cacheEnabled: true,
    requestsPerMinute: 60,
  };

  describe("system prompt assembly", () => {
    it("should include goal statement in system prompt", () => {
      const { system } = assemblePrompt(baseConfig, {});

      expect(system).toContain("GOAL: Generate product descriptions");
    });

    it("should include output schema description in system prompt", () => {
      const { system } = assemblePrompt(baseConfig, {});

      expect(system).toContain(
        "Your response must match this structure: { title: string, description: string, price: number }"
      );
    });

    it("should include JSON-only instructions", () => {
      const { system } = assemblePrompt(baseConfig, {});

      expect(system).toContain("Respond ONLY with valid JSON");
      expect(system).toContain(
        "Do not include explanations, markdown, or anything outside the JSON"
      );
    });

    it("should include AI assistant role", () => {
      const { system } = assemblePrompt(baseConfig, {});

      expect(system).toContain(
        "You are an AI assistant that generates structured product intelligence"
      );
    });

    it("should include additional instructions when provided", () => {
      const configWithInstructions: ProcessConfig = {
        ...baseConfig,
        additionalInstructions: "Always use formal language. Include SEO keywords.",
      };

      const { system } = assemblePrompt(configWithInstructions, {});

      expect(system).toContain("Always use formal language");
      expect(system).toContain("Include SEO keywords");
    });

    it("should not include additional instructions section when not provided", () => {
      const { system } = assemblePrompt(baseConfig, {});

      // Check the prompt doesn't have trailing newlines beyond what's expected
      const lines = system.split("\n");
      const nonEmptyLines = lines.filter((line) => line.trim() !== "");

      // Should have the standard sections but no extra content
      expect(nonEmptyLines[nonEmptyLines.length - 1]).toBe(
        "- Be concise and professional"
      );
    });
  });

  describe("user message assembly", () => {
    it("should JSON-stringify empty input object", () => {
      const { user } = assemblePrompt(baseConfig, {});

      expect(user).toBe("{}");
    });

    it("should JSON-stringify input data", () => {
      const input = { productId: "prod_123", category: "electronics" };
      const { user } = assemblePrompt(baseConfig, input);

      expect(user).toBe('{"productId":"prod_123","category":"electronics"}');
    });

    it("should handle complex nested input data", () => {
      const input = {
        product: {
          id: "prod_123",
          name: "Widget",
          attributes: ["red", "large"],
        },
        metadata: {
          timestamp: "2024-01-01",
        },
      };

      const { user } = assemblePrompt(baseConfig, input);
      const parsed = JSON.parse(user);

      expect(parsed.product.id).toBe("prod_123");
      expect(parsed.product.attributes).toEqual(["red", "large"]);
      expect(parsed.metadata.timestamp).toBe("2024-01-01");
    });

    it("should handle special characters in input", () => {
      const input = {
        text: 'Quote: "Hello"\nNewline here',
        unicode: "Émoji 🎉",
      };

      const { user } = assemblePrompt(baseConfig, input);
      const parsed = JSON.parse(user);

      expect(parsed.text).toBe('Quote: "Hello"\nNewline here');
      expect(parsed.unicode).toBe("Émoji 🎉");
    });

    it("should handle null and undefined values in input", () => {
      const input = {
        nullable: null,
        defined: "value",
        // undefined values are not serialized by JSON.stringify
      };

      const { user } = assemblePrompt(baseConfig, input);
      const parsed = JSON.parse(user);

      expect(parsed.nullable).toBeNull();
      expect(parsed.defined).toBe("value");
    });

    it("should handle numeric and boolean values", () => {
      const input = {
        count: 42,
        price: 19.99,
        active: true,
        deleted: false,
      };

      const { user } = assemblePrompt(baseConfig, input);
      const parsed = JSON.parse(user);

      expect(parsed.count).toBe(42);
      expect(parsed.price).toBe(19.99);
      expect(parsed.active).toBe(true);
      expect(parsed.deleted).toBe(false);
    });
  });

  describe("return structure", () => {
    it("should return object with system and user properties", () => {
      const result = assemblePrompt(baseConfig, { test: true });

      expect(result).toHaveProperty("system");
      expect(result).toHaveProperty("user");
      expect(typeof result.system).toBe("string");
      expect(typeof result.user).toBe("string");
    });
  });
});

describe("enhancePromptForRetry", () => {
  it("should add retry instructions to system prompt", () => {
    const original = {
      system: "Original system prompt",
      user: '{"test": "data"}',
    };

    const enhanced = enhancePromptForRetry(original);

    expect(enhanced.system).toContain("Original system prompt");
    expect(enhanced.system).toContain("PREVIOUS ATTEMPT FAILED VALIDATION");
    expect(enhanced.system).toContain("valid JSON only");
  });

  it("should preserve original user message", () => {
    const original = {
      system: "System prompt",
      user: '{"productId": "123"}',
    };

    const enhanced = enhancePromptForRetry(original);

    expect(enhanced.user).toBe('{"productId": "123"}');
  });

  it("should include strict JSON formatting instructions", () => {
    const original = {
      system: "System prompt",
      user: "{}",
    };

    const enhanced = enhancePromptForRetry(original);

    expect(enhanced.system).toContain("Start your response with {");
    expect(enhanced.system).toContain("end with }");
    expect(enhanced.system).toContain("no additional text");
    expect(enhanced.system).toContain("markdown code blocks");
  });

  it("should not modify original prompt object", () => {
    const original = {
      system: "Original system",
      user: "Original user",
    };

    enhancePromptForRetry(original);

    expect(original.system).toBe("Original system");
    expect(original.user).toBe("Original user");
  });
});
