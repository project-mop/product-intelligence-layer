/**
 * ExampleRequestSection Component Tests
 *
 * Tests for the ExampleRequestSection component rendering sample request payload
 * and cURL command with copy functionality.
 *
 * @see docs/stories/3-6-auto-generated-api-documentation.md - AC: 6, 9
 */

import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor } from "../../../../support/render";
import { ExampleRequestSection } from "~/components/process/docs/ExampleRequestSection";

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};

// Sample input schema
const sampleInputSchema = {
  type: "object",
  properties: {
    productName: {
      type: "string",
      description: "The name of the product",
    },
    category: {
      type: "string",
    },
  },
  required: ["productName", "category"],
};

describe("ExampleRequestSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });

    // Mock window.location.origin
    Object.defineProperty(window, "location", {
      value: { origin: "https://app.example.com" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rendering (AC: 6)", () => {
    it("should render section title", () => {
      renderWithProviders(
        <ExampleRequestSection processId="proc_abc123" inputSchema={sampleInputSchema} />
      );

      expect(screen.getByText("Example Request")).toBeInTheDocument();
    });

    it("should render JSON Body and cURL tabs", () => {
      renderWithProviders(
        <ExampleRequestSection processId="proc_abc123" inputSchema={sampleInputSchema} />
      );

      expect(screen.getByRole("tab", { name: /json body/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /curl/i })).toBeInTheDocument();
    });

    it("should display JSON body by default", () => {
      renderWithProviders(
        <ExampleRequestSection processId="proc_abc123" inputSchema={sampleInputSchema} />
      );

      // Should show pre/code element with JSON
      const codeBlock = document.querySelector("pre");
      expect(codeBlock).toBeInTheDocument();
    });

    it("should generate sample payload from input schema", () => {
      renderWithProviders(
        <ExampleRequestSection processId="proc_abc123" inputSchema={sampleInputSchema} />
      );

      // The sample payload should contain 'example' for string fields
      const codeBlock = document.querySelector("pre");
      expect(codeBlock?.textContent).toContain("input");
    });

    it("should have cURL tab available", () => {
      renderWithProviders(
        <ExampleRequestSection processId="proc_abc123" inputSchema={sampleInputSchema} />
      );

      const curlTab = screen.getByRole("tab", { name: /curl/i });
      expect(curlTab).toBeInTheDocument();
    });

    it("should have JSON Body tab selected by default", () => {
      renderWithProviders(
        <ExampleRequestSection processId="proc_abc123" inputSchema={sampleInputSchema} />
      );

      const jsonTab = screen.getByRole("tab", { name: /json body/i });
      expect(jsonTab).toHaveAttribute("data-state", "active");
    });
  });

  describe("copy functionality (AC: 9)", () => {
    it("should render copy button in JSON tab", () => {
      renderWithProviders(
        <ExampleRequestSection processId="proc_abc123" inputSchema={sampleInputSchema} />
      );

      const copyButton = screen.getByRole("button", { name: /copy/i });
      expect(copyButton).toBeInTheDocument();
    });

    it("should copy JSON body to clipboard when copy button is clicked", async () => {
      renderWithProviders(
        <ExampleRequestSection processId="proc_abc123" inputSchema={sampleInputSchema} />
      );

      const copyButton = screen.getByRole("button", { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
      });

      // Verify the copied content contains 'input' wrapper
      const copiedContent = mockClipboard.writeText.mock.calls[0]?.[0];
      expect(copiedContent).toContain('"input"');
    });

    it("should have copy functionality for JSON body", async () => {
      renderWithProviders(
        <ExampleRequestSection processId="proc_abc123" inputSchema={sampleInputSchema} />
      );

      // Find and click the copy button in the JSON tab (default)
      const copyButton = screen.getByRole("button", { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalled();
      });

      // Verify the copied content is JSON with input wrapper
      const copiedContent = mockClipboard.writeText.mock.calls[0]?.[0];
      expect(copiedContent).toContain('"input"');
      expect(copiedContent).toContain("productName");
    });
  });

  describe("schema-based generation", () => {
    it("should include required fields in sample payload", () => {
      renderWithProviders(
        <ExampleRequestSection processId="proc_abc123" inputSchema={sampleInputSchema} />
      );

      const codeBlock = document.querySelector("pre");
      const content = codeBlock?.textContent ?? "";

      // Required fields should be present
      expect(content).toContain("productName");
      expect(content).toContain("category");
    });

    it("should handle empty schema gracefully", () => {
      const emptySchema = { type: "object" };

      renderWithProviders(
        <ExampleRequestSection processId="proc_abc123" inputSchema={emptySchema} />
      );

      // Should render without errors
      expect(screen.getByText("Example Request")).toBeInTheDocument();
    });
  });
});
