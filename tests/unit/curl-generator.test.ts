/**
 * cURL Command Generator Unit Tests
 *
 * Tests for generating cURL commands for API endpoints.
 *
 * @see docs/stories/3-3-in-browser-endpoint-testing.md
 * @see docs/testing-strategy-mvp.md
 */

import { describe, expect, it } from "vitest";
import {
  generateCurlCommand,
  generateScriptCurlCommand,
  generateMinimalCurlCommand,
} from "~/lib/api/curl-generator";

describe("generateCurlCommand", () => {
  const baseUrl = "https://api.example.com";
  const processId = "proc_abc123xyz456";

  describe("basic command generation", () => {
    it("should generate correct endpoint URL", () => {
      const input = { name: "test" };
      const result = generateCurlCommand(processId, input, baseUrl);

      expect(result).toContain(
        `"${baseUrl}/api/v1/intelligence/${processId}/generate"`
      );
    });

    it("should include POST method", () => {
      const input = { name: "test" };
      const result = generateCurlCommand(processId, input, baseUrl);

      expect(result).toContain("-X POST");
    });

    it("should include Content-Type header", () => {
      const input = { name: "test" };
      const result = generateCurlCommand(processId, input, baseUrl);

      expect(result).toContain('-H "Content-Type: application/json"');
    });

    it("should include Authorization header with placeholder", () => {
      const input = { name: "test" };
      const result = generateCurlCommand(processId, input, baseUrl);

      expect(result).toContain('-H "Authorization: Bearer YOUR_API_KEY"');
    });

    it("should include JSON body", () => {
      const input = { name: "test", value: 123 };
      const result = generateCurlCommand(processId, input, baseUrl);

      expect(result).toContain('"name": "test"');
      expect(result).toContain('"value": 123');
    });
  });

  describe("multiline formatting", () => {
    it("should use line breaks by default", () => {
      const input = { name: "test" };
      const result = generateCurlCommand(processId, input, baseUrl);

      expect(result).toContain(" \\\n");
    });

    it("should use single line when multiline is false", () => {
      const input = { name: "test" };
      const result = generateCurlCommand(processId, input, baseUrl, {
        multiline: false,
      });

      expect(result).not.toContain("\n");
      expect(result.split(" -").length).toBeGreaterThan(1);
    });
  });

  describe("custom API key", () => {
    it("should use provided API key", () => {
      const input = { name: "test" };
      const result = generateCurlCommand(processId, input, baseUrl, {
        apiKey: "sk_test_abc123",
      });

      expect(result).toContain('-H "Authorization: Bearer sk_test_abc123"');
    });
  });

  describe("complex input objects", () => {
    it("should handle nested objects", () => {
      const input = {
        product: {
          name: "Widget",
          price: 29.99,
        },
      };
      const result = generateCurlCommand(processId, input, baseUrl);

      expect(result).toContain('"product"');
      expect(result).toContain('"name": "Widget"');
      expect(result).toContain('"price": 29.99');
    });

    it("should handle arrays", () => {
      const input = {
        tags: ["red", "blue", "green"],
      };
      const result = generateCurlCommand(processId, input, baseUrl);

      expect(result).toContain('"tags"');
      expect(result).toContain('"red"');
      expect(result).toContain('"blue"');
      expect(result).toContain('"green"');
    });

    it("should handle deeply nested structures", () => {
      const input = {
        level1: {
          level2: {
            level3: {
              value: "deep",
            },
          },
        },
      };
      const result = generateCurlCommand(processId, input, baseUrl);

      expect(result).toContain('"level1"');
      expect(result).toContain('"level2"');
      expect(result).toContain('"level3"');
      expect(result).toContain('"value": "deep"');
    });

    it("should handle empty object", () => {
      const input = {};
      const result = generateCurlCommand(processId, input, baseUrl);

      expect(result).toContain("-d '{}'");
    });

    it("should handle boolean values", () => {
      const input = { active: true, deleted: false };
      const result = generateCurlCommand(processId, input, baseUrl);

      expect(result).toContain('"active": true');
      expect(result).toContain('"deleted": false');
    });

    it("should handle null values", () => {
      const input = { description: null };
      const result = generateCurlCommand(processId, input, baseUrl);

      expect(result).toContain('"description": null');
    });
  });
});

describe("generateScriptCurlCommand", () => {
  const baseUrl = "https://api.example.com";
  const processId = "proc_abc123xyz456";

  it("should generate command suitable for shell scripts", () => {
    const input = { name: "test" };
    const result = generateScriptCurlCommand(processId, input, baseUrl);

    expect(result).toContain("-X POST");
    expect(result).toContain(`"${baseUrl}/api/v1/intelligence/${processId}/generate"`);
    expect(result).toContain("-H \"Content-Type: application/json\"");
  });

  it("should use provided API key", () => {
    const input = { name: "test" };
    const result = generateScriptCurlCommand(
      processId,
      input,
      baseUrl,
      "sk_live_xyz789"
    );

    expect(result).toContain('-H "Authorization: Bearer sk_live_xyz789"');
  });

  it("should escape single quotes in JSON", () => {
    const input = { message: "It's a test" };
    const result = generateScriptCurlCommand(processId, input, baseUrl);

    // Single quotes should be escaped for shell using the pattern: '\'
    // The string "It's" becomes "It'\''s" when escaped for shell
    expect(result).toContain("It'\\''s a test");
  });
});

describe("generateMinimalCurlCommand", () => {
  const baseUrl = "https://api.example.com";
  const processId = "proc_abc123xyz456";

  it("should generate single-line command", () => {
    const input = { name: "test" };
    const result = generateMinimalCurlCommand(processId, input, baseUrl);

    expect(result).not.toContain("\n");
  });

  it("should include all required parts", () => {
    const input = { name: "test", count: 5 };
    const result = generateMinimalCurlCommand(processId, input, baseUrl);

    expect(result).toContain("curl -X POST");
    expect(result).toContain(`"${baseUrl}/api/v1/intelligence/${processId}/generate"`);
    expect(result).toContain('-H "Content-Type: application/json"');
    expect(result).toContain('-H "Authorization: Bearer YOUR_API_KEY"');
    expect(result).toContain('{"name":"test","count":5}');
  });

  it("should produce compact JSON without formatting", () => {
    const input = { key: "value" };
    const result = generateMinimalCurlCommand(processId, input, baseUrl);

    // Should be compact JSON, not pretty-printed
    expect(result).toContain('{"key":"value"}');
    expect(result).not.toContain('  "key"');
  });
});

describe("edge cases", () => {
  const baseUrl = "https://api.example.com";
  const processId = "proc_abc123xyz456";

  it("should handle special characters in string values", () => {
    const input = { text: 'Hello "World" & <Test>' };
    const result = generateCurlCommand(processId, input, baseUrl);

    // JSON should properly escape quotes
    expect(result).toContain('\\"World\\"');
  });

  it("should handle unicode characters", () => {
    const input = { name: "Test" };
    const result = generateCurlCommand(processId, input, baseUrl);

    expect(result).toContain("Test");
  });

  it("should handle numeric string keys", () => {
    const input = { "123": "value" };
    const result = generateCurlCommand(processId, input, baseUrl);

    expect(result).toContain('"123": "value"');
  });

  it("should handle very large numbers", () => {
    const input = { bigNum: 9007199254740991 };
    const result = generateCurlCommand(processId, input, baseUrl);

    expect(result).toContain("9007199254740991");
  });

  it("should handle different base URLs", () => {
    const inputs = [
      "http://localhost:3000",
      "https://api.example.com",
      "https://subdomain.example.com/v2",
    ];

    inputs.forEach((url) => {
      const result = generateCurlCommand(processId, { test: true }, url);
      expect(result).toContain(`"${url}/api/v1/intelligence/${processId}/generate"`);
    });
  });
});
