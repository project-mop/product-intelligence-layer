/**
 * TemplatePicker Component Tests
 *
 * Tests the template selection grid for the intelligence creation wizard.
 *
 * @see src/components/process/TemplatePicker.tsx
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, fireEvent } from "../../../support/render";
import {
  TemplatePicker,
  templates,
  blankTemplate,
} from "~/components/process/TemplatePicker";

describe("TemplatePicker", () => {
  describe("rendering", () => {
    it("renders all pre-built templates plus blank option", () => {
      const onSelect = vi.fn();
      renderWithProviders(
        <TemplatePicker selectedId={null} onSelect={onSelect} />
      );

      // Should show blank template
      expect(screen.getByText("Blank")).toBeInTheDocument();
      expect(screen.getByText("Start from scratch with empty fields")).toBeInTheDocument();

      // Should show all 4 pre-built templates
      expect(screen.getByText("Product Description Generator")).toBeInTheDocument();
      expect(screen.getByText("SEO Meta Generator")).toBeInTheDocument();
      expect(screen.getByText("Category Classifier")).toBeInTheDocument();
      expect(screen.getByText("Attribute Extractor")).toBeInTheDocument();
    });

    it("displays template descriptions", () => {
      const onSelect = vi.fn();
      renderWithProviders(
        <TemplatePicker selectedId={null} onSelect={onSelect} />
      );

      expect(
        screen.getByText("Generate compelling product descriptions from attributes")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Create optimized meta titles and descriptions for products")
      ).toBeInTheDocument();
    });

    it("displays template icons", () => {
      const onSelect = vi.fn();
      renderWithProviders(
        <TemplatePicker selectedId={null} onSelect={onSelect} />
      );

      // Icons are emojis in span elements
      expect(screen.getByText("✨")).toBeInTheDocument(); // Blank
      expect(screen.getByText("📝")).toBeInTheDocument(); // Product Description
      expect(screen.getByText("🔍")).toBeInTheDocument(); // SEO Meta
      expect(screen.getByText("🏷️")).toBeInTheDocument(); // Category Classifier
      expect(screen.getByText("🔬")).toBeInTheDocument(); // Attribute Extractor
    });
  });

  describe("selection", () => {
    it("calls onSelect with the blank template when clicked", () => {
      const onSelect = vi.fn();
      renderWithProviders(
        <TemplatePicker selectedId={null} onSelect={onSelect} />
      );

      fireEvent.click(screen.getByText("Blank"));

      expect(onSelect).toHaveBeenCalledWith(blankTemplate);
    });

    it("calls onSelect with the correct template when a pre-built template is clicked", () => {
      const onSelect = vi.fn();
      renderWithProviders(
        <TemplatePicker selectedId={null} onSelect={onSelect} />
      );

      fireEvent.click(screen.getByText("Product Description Generator"));

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "product-description",
          name: "Product Description Generator",
        })
      );
    });

    it("highlights the selected template", () => {
      const onSelect = vi.fn();
      const { container } = renderWithProviders(
        <TemplatePicker selectedId="product-description" onSelect={onSelect} />
      );

      // The selected card should have the ring class
      const selectedCard = container.querySelector(".ring-primary");
      expect(selectedCard).toBeInTheDocument();
    });
  });

  describe("template data integrity", () => {
    it("has exactly 4 pre-built templates", () => {
      expect(templates).toHaveLength(4);
    });

    it("all templates have required fields", () => {
      const allTemplates = [blankTemplate, ...templates];

      for (const template of allTemplates) {
        expect(template.id).toBeTruthy();
        expect(template.name).toBeTruthy();
        expect(template.description).toBeTruthy();
        expect(template.icon).toBeTruthy();
        expect(template.inputSchema).toBeDefined();
        expect(template.outputSchema).toBeDefined();
        expect(template.goal).toBeDefined();
      }
    });

    it("templates have valid JSON Schema structure", () => {
      const allTemplates = [blankTemplate, ...templates];

      for (const template of allTemplates) {
        expect(template.inputSchema.type).toBe("object");
        expect(template.outputSchema.type).toBe("object");
      }
    });
  });
});
