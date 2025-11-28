/**
 * AuthenticationSection Component Tests
 *
 * Tests for the AuthenticationSection component rendering, auth info display, and copy functionality.
 *
 * @see docs/stories/3-6-auto-generated-api-documentation.md - AC: 3, 9
 */

import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor } from "../../../../support/render";
import { AuthenticationSection } from "~/components/process/docs/AuthenticationSection";

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};

describe("AuthenticationSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rendering (AC: 3)", () => {
    it("should render the section title with key icon", () => {
      renderWithProviders(<AuthenticationSection />);

      expect(screen.getByText("Authentication")).toBeInTheDocument();
    });

    it("should render Bearer token authentication description", () => {
      renderWithProviders(<AuthenticationSection />);

      expect(
        screen.getByText(/all api requests must include a valid api key/i)
      ).toBeInTheDocument();
    });

    it("should render the example header format", () => {
      renderWithProviders(<AuthenticationSection />);

      expect(
        screen.getByText("Authorization: Bearer your_api_key_here")
      ).toBeInTheDocument();
    });

    it("should render link to API keys page", () => {
      renderWithProviders(<AuthenticationSection />);

      expect(screen.getByRole("link", { name: /manage api keys/i })).toHaveAttribute(
        "href",
        "/dashboard/api-keys"
      );
    });

    it("should render note about sandbox vs production keys", () => {
      renderWithProviders(<AuthenticationSection />);

      expect(
        screen.getByText(/use sandbox api keys for testing and production keys for live/i)
      ).toBeInTheDocument();
    });

    it("should render copy button", () => {
      renderWithProviders(<AuthenticationSection />);

      const copyButton = screen.getByRole("button", { name: /copy authentication header/i });
      expect(copyButton).toBeInTheDocument();
    });
  });

  describe("copy functionality (AC: 9)", () => {
    it("should copy auth header to clipboard when copy button is clicked", async () => {
      renderWithProviders(<AuthenticationSection />);

      const copyButton = screen.getByRole("button", { name: /copy authentication header/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        "Authorization: Bearer your_api_key_here"
      );
    });
  });

  describe("accessibility", () => {
    it("should have accessible copy button label", () => {
      renderWithProviders(<AuthenticationSection />);

      const copyButton = screen.getByRole("button", { name: /copy authentication header/i });
      expect(copyButton).toBeInTheDocument();
    });

    it("should have accessible link to API keys page", () => {
      renderWithProviders(<AuthenticationSection />);

      const link = screen.getByRole("link", { name: /manage api keys/i });
      expect(link).toBeInTheDocument();
    });
  });
});
