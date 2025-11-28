/**
 * SchemaSection Component Tests
 *
 * Tests for the SchemaSection component rendering input/output schemas
 * with PropertyNode pattern, collapsible sections, and field descriptions.
 *
 * @see docs/stories/3-6-auto-generated-api-documentation.md - AC: 4, 5
 */

import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { renderWithProviders, screen } from "../../../../support/render";
import { SchemaSection } from "~/components/process/docs/SchemaSection";

// Sample JSON Schema for testing
const sampleInputSchema = {
  type: "object",
  description: "Input schema for product descriptions",
  properties: {
    productName: {
      type: "string",
      description: "The name of the product",
    },
    category: {
      type: "string",
      description: "Product category",
    },
    price: {
      type: "number",
    },
    attributes: {
      type: "object",
      description: "Additional attributes",
      properties: {
        color: { type: "string" },
        size: { type: "string" },
      },
    },
  },
  required: ["productName", "category"],
};

const sampleOutputSchema = {
  type: "object",
  properties: {
    shortDescription: {
      type: "string",
      description: "Brief product description",
    },
    longDescription: {
      type: "string",
      description: "Detailed product description",
    },
    bulletPoints: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["shortDescription"],
};

describe("SchemaSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("input schema rendering (AC: 4)", () => {
    it("should render section title", () => {
      renderWithProviders(
        <SchemaSection schema={sampleInputSchema} title="Input Schema" type="input" />
      );

      expect(screen.getByText("Input Schema")).toBeInTheDocument();
    });

    it("should render 'Request Body' badge for input type", () => {
      renderWithProviders(
        <SchemaSection schema={sampleInputSchema} title="Input Schema" type="input" />
      );

      expect(screen.getByText("Request Body")).toBeInTheDocument();
    });

    it("should render schema description when present", () => {
      renderWithProviders(
        <SchemaSection schema={sampleInputSchema} title="Input Schema" type="input" />
      );

      expect(screen.getByText("Input schema for product descriptions")).toBeInTheDocument();
    });

    it("should render property names", () => {
      renderWithProviders(
        <SchemaSection schema={sampleInputSchema} title="Input Schema" type="input" />
      );

      expect(screen.getByText("productName")).toBeInTheDocument();
      expect(screen.getByText("category")).toBeInTheDocument();
      expect(screen.getByText("price")).toBeInTheDocument();
    });

    it("should render property types", () => {
      renderWithProviders(
        <SchemaSection schema={sampleInputSchema} title="Input Schema" type="input" />
      );

      // Should show type indicators
      expect(screen.getAllByText("string").length).toBeGreaterThan(0);
      expect(screen.getAllByText("number").length).toBeGreaterThan(0);
    });

    it("should mark required properties with badge", () => {
      renderWithProviders(
        <SchemaSection schema={sampleInputSchema} title="Input Schema" type="input" />
      );

      // productName and category are required
      const requiredBadges = screen.getAllByText("required");
      expect(requiredBadges.length).toBeGreaterThanOrEqual(2);
    });

    it("should render info icons for properties with descriptions", () => {
      renderWithProviders(
        <SchemaSection schema={sampleInputSchema} title="Input Schema" type="input" />
      );

      // Properties with descriptions should have info icons
      const infoIcons = document.querySelectorAll('[class*="lucide-info"]');
      expect(infoIcons.length).toBeGreaterThan(0);
    });
  });

  describe("output schema rendering (AC: 5)", () => {
    it("should render section title", () => {
      renderWithProviders(
        <SchemaSection schema={sampleOutputSchema} title="Output Schema" type="output" />
      );

      expect(screen.getByText("Output Schema")).toBeInTheDocument();
    });

    it("should render 'Response Data' badge for output type", () => {
      renderWithProviders(
        <SchemaSection schema={sampleOutputSchema} title="Output Schema" type="output" />
      );

      expect(screen.getByText("Response Data")).toBeInTheDocument();
    });

    it("should render output property names", () => {
      renderWithProviders(
        <SchemaSection schema={sampleOutputSchema} title="Output Schema" type="output" />
      );

      expect(screen.getByText("shortDescription")).toBeInTheDocument();
      expect(screen.getByText("longDescription")).toBeInTheDocument();
      expect(screen.getByText("bulletPoints")).toBeInTheDocument();
    });
  });

  describe("nested objects", () => {
    it("should render nested object properties with collapsible trigger", () => {
      renderWithProviders(
        <SchemaSection schema={sampleInputSchema} title="Input Schema" type="input" />
      );

      // 'attributes' is a nested object
      expect(screen.getByText("attributes")).toBeInTheDocument();
    });

    it("should show nested objects that are initially expanded (depth < 2)", () => {
      renderWithProviders(
        <SchemaSection schema={sampleInputSchema} title="Input Schema" type="input" />
      );

      // At depth 0, attributes should be auto-expanded since depth < 2
      // The nested color and size should be visible
      expect(screen.getByText("color")).toBeInTheDocument();
      expect(screen.getByText("size")).toBeInTheDocument();
    });

    it("should have collapsible trigger for nested objects", () => {
      renderWithProviders(
        <SchemaSection schema={sampleInputSchema} title="Input Schema" type="input" />
      );

      // Find the attributes row which should have a collapse button
      const attributesRow = screen.getByText("attributes").closest("div");
      const collapseButton = attributesRow?.querySelector("button");

      expect(collapseButton).toBeInTheDocument();
    });
  });

  describe("empty schema", () => {
    it("should show 'No properties defined' for empty schema", () => {
      const emptySchema = { type: "object" };
      renderWithProviders(
        <SchemaSection schema={emptySchema} title="Empty Schema" type="input" />
      );

      expect(screen.getByText("No properties defined")).toBeInTheDocument();
    });
  });
});
