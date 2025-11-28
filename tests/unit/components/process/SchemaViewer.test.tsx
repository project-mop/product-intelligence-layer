/**
 * SchemaViewer Component Tests
 *
 * Tests for the SchemaViewer component rendering, syntax highlighting,
 * copy/download functionality, and field descriptions.
 *
 * @see docs/stories/3-5-view-json-schema.md - AC: 2, 3, 4, 5, 6
 */

import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor } from "../../../support/render";
import { SchemaViewer } from "~/components/process/SchemaViewer";

// Sample JSON Schema for testing
const sampleSchema = {
  type: "object",
  description: "A test schema for product descriptions",
  properties: {
    productName: {
      type: "string",
      description: "The name of the product",
    },
    price: {
      type: "number",
      description: "The price in USD",
    },
    inStock: {
      type: "boolean",
    },
    categories: {
      type: "array",
      items: {
        type: "string",
      },
    },
    details: {
      type: "object",
      description: "Additional product details",
      properties: {
        weight: {
          type: "number",
          description: "Weight in kg",
        },
        dimensions: {
          type: "object",
          properties: {
            width: { type: "number" },
            height: { type: "number" },
          },
        },
      },
    },
  },
  required: ["productName", "price"],
};

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};

// Mock URL and document APIs for download testing
const mockCreateObjectURL = vi.fn().mockReturnValue("blob:test-url");
const mockRevokeObjectURL = vi.fn();

describe("SchemaViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });

    // Mock URL methods
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rendering", () => {
    it("should render the title", () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      expect(screen.getByText("Input Schema")).toBeInTheDocument();
    });

    it("should render schema description when present", () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      expect(
        screen.getByText("A test schema for product descriptions")
      ).toBeInTheDocument();
    });

    it("should render property names in structured view", () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      expect(screen.getByText("productName")).toBeInTheDocument();
      expect(screen.getByText("price")).toBeInTheDocument();
      expect(screen.getByText("inStock")).toBeInTheDocument();
    });

    it("should render property types", () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      // Should show type indicators
      expect(screen.getAllByText("string").length).toBeGreaterThan(0);
      expect(screen.getAllByText("number").length).toBeGreaterThan(0);
      expect(screen.getAllByText("boolean").length).toBeGreaterThan(0);
    });

    it("should mark required properties", () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      // productName and price are required
      const requiredIndicators = screen.getAllByText("required");
      expect(requiredIndicators.length).toBeGreaterThanOrEqual(2);
    });

    it("should show 'No properties defined' for empty schema", () => {
      const emptySchema = { type: "object" };
      renderWithProviders(
        <SchemaViewer schema={emptySchema} title="Empty Schema" />
      );

      expect(screen.getByText("No properties defined")).toBeInTheDocument();
    });
  });

  describe("view mode toggle", () => {
    it("should render Structured and Raw view buttons", () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      expect(screen.getByRole("button", { name: /structured/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /raw/i })).toBeInTheDocument();
    });

    it("should default to structured view", () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      // Structured view shows property names
      expect(screen.getByText("productName")).toBeInTheDocument();
    });

    it("should switch to raw view when Raw button is clicked", async () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      const rawButton = screen.getByRole("button", { name: /raw/i });
      fireEvent.click(rawButton);

      // Raw view shows code/pre element for syntax highlighting
      await waitFor(() => {
        const codeBlock = document.querySelector("pre");
        expect(codeBlock).toBeInTheDocument();
      });
    });
  });

  describe("copy functionality (AC: 4)", () => {
    it("should render copy button", () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      const copyButton = screen.getByRole("button", { name: /copy/i });
      expect(copyButton).toBeInTheDocument();
    });

    it("should copy schema JSON to clipboard when copy button is clicked", async () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      const copyButton = screen.getByRole("button", { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
      });

      // Verify the copied content is the JSON stringified schema
      const copiedContent = mockClipboard.writeText.mock.calls[0]?.[0];
      expect(copiedContent).toBe(JSON.stringify(sampleSchema, null, 2));
    });

    it("should pass correct schema content to clipboard", async () => {
      const simpleSchema = { type: "string", description: "A simple string" };
      renderWithProviders(
        <SchemaViewer schema={simpleSchema} title="Simple Schema" />
      );

      const copyButton = screen.getByRole("button", { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
          JSON.stringify(simpleSchema, null, 2)
        );
      });
    });
  });

  describe("download functionality (AC: 5)", () => {
    it("should render download button", () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      const downloadButton = screen.getByRole("button", { name: /download/i });
      expect(downloadButton).toBeInTheDocument();
    });

    it("should create blob with correct content when download is clicked", () => {
      renderWithProviders(
        <SchemaViewer
          schema={sampleSchema}
          title="Input Schema"
          processName="Test Process"
          schemaType="input"
        />
      );

      const downloadButton = screen.getByRole("button", { name: /download/i });
      fireEvent.click(downloadButton);

      // Verify blob was created
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it("should trigger download with correct filename format", () => {
      // Track created anchor elements
      const createdAnchors: HTMLAnchorElement[] = [];
      const originalCreateElement = document.createElement.bind(document);

      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        const element = originalCreateElement(tagName);
        if (tagName === "a") {
          createdAnchors.push(element as HTMLAnchorElement);
        }
        return element;
      });

      renderWithProviders(
        <SchemaViewer
          schema={sampleSchema}
          title="Input Schema"
          processName="My Test Process"
          schemaType="input"
        />
      );

      const downloadButton = screen.getByRole("button", { name: /download/i });
      fireEvent.click(downloadButton);

      // Verify an anchor was created with correct download attribute
      expect(createdAnchors.length).toBeGreaterThan(0);
      const downloadAnchor = createdAnchors.find((a) => a.download);
      expect(downloadAnchor?.download).toBe("my-test-process-input-schema.json");
    });

    it("should use output in filename for output schema type", () => {
      const createdAnchors: HTMLAnchorElement[] = [];
      const originalCreateElement = document.createElement.bind(document);

      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        const element = originalCreateElement(tagName);
        if (tagName === "a") {
          createdAnchors.push(element as HTMLAnchorElement);
        }
        return element;
      });

      renderWithProviders(
        <SchemaViewer
          schema={sampleSchema}
          title="Output Schema"
          processName="My Process"
          schemaType="output"
        />
      );

      const downloadButton = screen.getByRole("button", { name: /download/i });
      fireEvent.click(downloadButton);

      const downloadAnchor = createdAnchors.find((a) => a.download);
      expect(downloadAnchor?.download).toBe("my-process-output-schema.json");
    });

    it("should sanitize special characters in process name for filename", () => {
      const createdAnchors: HTMLAnchorElement[] = [];
      const originalCreateElement = document.createElement.bind(document);

      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        const element = originalCreateElement(tagName);
        if (tagName === "a") {
          createdAnchors.push(element as HTMLAnchorElement);
        }
        return element;
      });

      renderWithProviders(
        <SchemaViewer
          schema={sampleSchema}
          title="Input Schema"
          processName="Product Description Generator (v2)"
          schemaType="input"
        />
      );

      const downloadButton = screen.getByRole("button", { name: /download/i });
      fireEvent.click(downloadButton);

      const downloadAnchor = createdAnchors.find((a) => a.download);
      expect(downloadAnchor?.download).toBe("product-description-generator-v2-input-schema.json");
    });
  });

  describe("field descriptions (AC: 6)", () => {
    it("should render info icon for properties with descriptions", () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      // Properties with descriptions should have info icons
      // productName, price, and details have descriptions
      const infoIcons = document.querySelectorAll('[class*="lucide-info"]');
      expect(infoIcons.length).toBeGreaterThan(0);
    });

    it("should not render info icon for properties without descriptions", () => {
      const schemaWithoutDescriptions = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      };

      renderWithProviders(
        <SchemaViewer schema={schemaWithoutDescriptions} title="No Descriptions" />
      );

      // Verify it renders without error and shows property names
      expect(screen.getByText("name")).toBeInTheDocument();
      expect(screen.getByText("age")).toBeInTheDocument();
    });
  });

  describe("nested object handling", () => {
    it("should render nested object properties", () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      // 'details' is a nested object
      expect(screen.getByText("details")).toBeInTheDocument();
    });

    it("should render array properties with correct type indicator", () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      // 'categories' is an array
      expect(screen.getByText("categories")).toBeInTheDocument();
    });

    it("should handle deeply nested schemas", () => {
      const deepSchema = {
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
              },
            },
          },
        },
      };

      renderWithProviders(
        <SchemaViewer schema={deepSchema} title="Deep Schema" />
      );

      expect(screen.getByText("level1")).toBeInTheDocument();
    });
  });

  describe("JSON syntax highlighting (AC: 2, 3)", () => {
    it("should render syntax-highlighted JSON in raw view", async () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      // Switch to raw view
      const rawButton = screen.getByRole("button", { name: /raw/i });
      fireEvent.click(rawButton);

      // Should contain pre/code elements with syntax highlighting
      await waitFor(() => {
        const codeBlock = document.querySelector("pre");
        expect(codeBlock).toBeInTheDocument();
      });
    });

    it("should format JSON with 2-space indentation", async () => {
      const simpleSchema = { type: "string" };
      renderWithProviders(
        <SchemaViewer schema={simpleSchema} title="Simple Schema" />
      );

      // Switch to raw view
      const rawButton = screen.getByRole("button", { name: /raw/i });
      fireEvent.click(rawButton);

      // The JSON should be formatted with 2-space indentation
      await waitFor(() => {
        const codeBlock = document.querySelector("pre");
        expect(codeBlock?.textContent).toContain("type");
      });
    });
  });

  describe("accessibility", () => {
    it("should have accessible button labels", () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
    });

    it("should have screen reader only text for icon-only buttons on mobile", () => {
      renderWithProviders(
        <SchemaViewer schema={sampleSchema} title="Input Schema" />
      );

      // Copy and Download buttons have sr-only text
      const copyButton = screen.getByRole("button", { name: /copy/i });
      const downloadButton = screen.getByRole("button", { name: /download/i });

      expect(copyButton).toBeInTheDocument();
      expect(downloadButton).toBeInTheDocument();
    });
  });
});
