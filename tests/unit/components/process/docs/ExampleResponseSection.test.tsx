/**
 * ExampleResponseSection Component Tests
 *
 * Tests for the ExampleResponseSection component rendering mock response
 * based on output schema with response envelope and meta fields.
 *
 * @see docs/stories/3-6-auto-generated-api-documentation.md - AC: 7
 */

import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { renderWithProviders, screen } from "../../../../support/render";
import { ExampleResponseSection } from "~/components/process/docs/ExampleResponseSection";

// Sample output schema
const sampleOutputSchema = {
  type: "object",
  properties: {
    shortDescription: {
      type: "string",
      description: "Brief product description",
    },
    longDescription: {
      type: "string",
    },
    bulletPoints: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["shortDescription"],
};

describe("ExampleResponseSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rendering (AC: 7)", () => {
    it("should render section title", () => {
      renderWithProviders(<ExampleResponseSection outputSchema={sampleOutputSchema} />);

      expect(screen.getByText("Example Response")).toBeInTheDocument();
    });

    it("should render 200 OK badge", () => {
      renderWithProviders(<ExampleResponseSection outputSchema={sampleOutputSchema} />);

      expect(screen.getByText("200 OK")).toBeInTheDocument();
    });

    it("should render JSON response with syntax highlighting", () => {
      renderWithProviders(<ExampleResponseSection outputSchema={sampleOutputSchema} />);

      // Should show pre/code element with JSON
      const codeBlock = document.querySelector("pre");
      expect(codeBlock).toBeInTheDocument();
    });

    it("should include success: true in response envelope", () => {
      renderWithProviders(<ExampleResponseSection outputSchema={sampleOutputSchema} />);

      const codeBlock = document.querySelector("pre");
      expect(codeBlock?.textContent).toContain('"success"');
      expect(codeBlock?.textContent).toContain("true");
    });

    it("should include data field with generated sample", () => {
      renderWithProviders(<ExampleResponseSection outputSchema={sampleOutputSchema} />);

      const codeBlock = document.querySelector("pre");
      expect(codeBlock?.textContent).toContain('"data"');
    });

    it("should include meta fields in response", () => {
      renderWithProviders(<ExampleResponseSection outputSchema={sampleOutputSchema} />);

      const codeBlock = document.querySelector("pre");
      const content = codeBlock?.textContent ?? "";

      expect(content).toContain('"meta"');
      expect(content).toContain('"version"');
      expect(content).toContain('"cached"');
      expect(content).toContain('"latency_ms"');
      expect(content).toContain('"request_id"');
    });
  });

  describe("meta fields explanation", () => {
    it("should render meta fields description section", () => {
      renderWithProviders(<ExampleResponseSection outputSchema={sampleOutputSchema} />);

      expect(screen.getByText("Response Meta Fields")).toBeInTheDocument();
    });

    it("should explain version field", () => {
      renderWithProviders(<ExampleResponseSection outputSchema={sampleOutputSchema} />);

      expect(screen.getByText("API version used for this response")).toBeInTheDocument();
    });

    it("should explain cached field", () => {
      renderWithProviders(<ExampleResponseSection outputSchema={sampleOutputSchema} />);

      expect(screen.getByText("Whether the response was served from cache")).toBeInTheDocument();
    });

    it("should explain latency_ms field", () => {
      renderWithProviders(<ExampleResponseSection outputSchema={sampleOutputSchema} />);

      expect(screen.getByText("Processing time in milliseconds")).toBeInTheDocument();
    });

    it("should explain request_id field", () => {
      renderWithProviders(<ExampleResponseSection outputSchema={sampleOutputSchema} />);

      expect(screen.getByText("Unique identifier for debugging")).toBeInTheDocument();
    });
  });

  describe("schema-based generation", () => {
    it("should generate sample data from output schema properties", () => {
      renderWithProviders(<ExampleResponseSection outputSchema={sampleOutputSchema} />);

      const codeBlock = document.querySelector("pre");
      const content = codeBlock?.textContent ?? "";

      // Properties from schema should appear in data
      expect(content).toContain("shortDescription");
    });

    it("should handle empty schema gracefully", () => {
      const emptySchema = { type: "object" };

      renderWithProviders(<ExampleResponseSection outputSchema={emptySchema} />);

      // Should render without errors
      expect(screen.getByText("Example Response")).toBeInTheDocument();

      // Should still have response envelope
      const codeBlock = document.querySelector("pre");
      expect(codeBlock?.textContent).toContain('"success"');
      expect(codeBlock?.textContent).toContain('"data"');
    });
  });
});
