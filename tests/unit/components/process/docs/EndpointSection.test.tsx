/**
 * EndpointSection Component Tests
 *
 * Tests for the EndpointSection component rendering, URL display, and copy functionality.
 *
 * @see docs/stories/3-6-auto-generated-api-documentation.md - AC: 2, 9
 */

import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor } from "../../../../support/render";
import { EndpointSection } from "~/components/process/docs/EndpointSection";

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};

describe("EndpointSection", () => {
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

  describe("rendering (AC: 2)", () => {
    it("should render the section title", () => {
      renderWithProviders(<EndpointSection processId="proc_abc123" />);

      expect(screen.getByText("Endpoint")).toBeInTheDocument();
    });

    it("should render the HTTP method badge", () => {
      renderWithProviders(<EndpointSection processId="proc_abc123" />);

      expect(screen.getByText("POST")).toBeInTheDocument();
    });

    it("should render the complete endpoint URL with process ID", () => {
      renderWithProviders(<EndpointSection processId="proc_abc123" />);

      expect(
        screen.getByText("https://app.example.com/api/v1/intelligence/proc_abc123/generate")
      ).toBeInTheDocument();
    });

    it("should render the description text", () => {
      renderWithProviders(<EndpointSection processId="proc_abc123" />);

      expect(
        screen.getByText("Send a POST request with your input data to generate intelligence output.")
      ).toBeInTheDocument();
    });

    it("should render copy button", () => {
      renderWithProviders(<EndpointSection processId="proc_abc123" />);

      const copyButton = screen.getByRole("button", { name: /copy endpoint url/i });
      expect(copyButton).toBeInTheDocument();
    });
  });

  describe("copy functionality (AC: 9)", () => {
    it("should copy endpoint URL to clipboard when copy button is clicked", async () => {
      renderWithProviders(<EndpointSection processId="proc_abc123" />);

      const copyButton = screen.getByRole("button", { name: /copy endpoint url/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        "https://app.example.com/api/v1/intelligence/proc_abc123/generate"
      );
    });

    it("should handle different process IDs", async () => {
      renderWithProviders(<EndpointSection processId="proc_xyz789" />);

      const copyButton = screen.getByRole("button", { name: /copy endpoint url/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
          "https://app.example.com/api/v1/intelligence/proc_xyz789/generate"
        );
      });
    });
  });

  describe("accessibility", () => {
    it("should have accessible copy button label", () => {
      renderWithProviders(<EndpointSection processId="proc_abc123" />);

      const copyButton = screen.getByRole("button", { name: /copy endpoint url/i });
      expect(copyButton).toBeInTheDocument();
    });
  });
});
