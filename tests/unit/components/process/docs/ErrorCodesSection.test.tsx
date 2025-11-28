/**
 * ErrorCodesSection Component Tests
 *
 * Tests for the ErrorCodesSection component rendering error codes table
 * and error response format documentation.
 *
 * @see docs/stories/3-6-auto-generated-api-documentation.md - AC: 8
 */

import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { renderWithProviders, screen } from "../../../../support/render";
import { ErrorCodesSection } from "~/components/process/docs/ErrorCodesSection";

describe("ErrorCodesSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rendering (AC: 8)", () => {
    it("should render section title with alert icon", () => {
      renderWithProviders(<ErrorCodesSection />);

      expect(screen.getByText("Error Codes")).toBeInTheDocument();
    });

    it("should render error codes table", () => {
      renderWithProviders(<ErrorCodesSection />);

      // Table headers
      expect(screen.getByText("Code")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    it("should document 401 Unauthorized error", () => {
      renderWithProviders(<ErrorCodesSection />);

      expect(screen.getByText("401")).toBeInTheDocument();
      expect(screen.getByText("Unauthorized")).toBeInTheDocument();
      expect(screen.getByText("Invalid or missing API key")).toBeInTheDocument();
    });

    it("should document 403 Forbidden error", () => {
      renderWithProviders(<ErrorCodesSection />);

      expect(screen.getByText("403")).toBeInTheDocument();
      expect(screen.getByText("Forbidden")).toBeInTheDocument();
      expect(screen.getByText("API key lacks access to this process")).toBeInTheDocument();
    });

    it("should document 404 Not Found error", () => {
      renderWithProviders(<ErrorCodesSection />);

      expect(screen.getByText("404")).toBeInTheDocument();
      expect(screen.getByText("Not Found")).toBeInTheDocument();
      expect(screen.getByText("Process not found or not published")).toBeInTheDocument();
    });

    it("should document 500 Internal Server Error", () => {
      renderWithProviders(<ErrorCodesSection />);

      expect(screen.getByText("500")).toBeInTheDocument();
      expect(screen.getByText("Internal Server Error")).toBeInTheDocument();
      expect(screen.getByText("Output validation failed or unexpected error")).toBeInTheDocument();
    });

    it("should document 503 Service Unavailable error", () => {
      renderWithProviders(<ErrorCodesSection />);

      expect(screen.getByText("503")).toBeInTheDocument();
      expect(screen.getByText("Service Unavailable")).toBeInTheDocument();
      expect(screen.getByText("LLM provider temporarily unavailable")).toBeInTheDocument();
    });

    it("should indicate 503 is retryable", () => {
      renderWithProviders(<ErrorCodesSection />);

      // Only 503 should be marked as retryable
      const yesText = screen.getByText("Yes");
      expect(yesText).toBeInTheDocument();
    });
  });

  describe("error response format", () => {
    it("should render error response format section", () => {
      renderWithProviders(<ErrorCodesSection />);

      expect(screen.getByText("Error Response Format")).toBeInTheDocument();
    });

    it("should show example error response with success: false", () => {
      renderWithProviders(<ErrorCodesSection />);

      const codeBlock = document.querySelector("pre");
      expect(codeBlock?.textContent).toContain('"success"');
      expect(codeBlock?.textContent).toContain("false");
    });

    it("should show error object with code and message", () => {
      renderWithProviders(<ErrorCodesSection />);

      const codeBlock = document.querySelector("pre");
      const content = codeBlock?.textContent ?? "";

      expect(content).toContain('"error"');
      expect(content).toContain('"code"');
      expect(content).toContain('"message"');
    });
  });

  describe("retry guidance", () => {
    it("should render retry guidance section", () => {
      renderWithProviders(<ErrorCodesSection />);

      expect(screen.getByText("Retry Guidance")).toBeInTheDocument();
    });

    it("should mention Retry-After header", () => {
      renderWithProviders(<ErrorCodesSection />);

      expect(screen.getByText("Retry-After")).toBeInTheDocument();
    });

    it("should recommend exponential backoff", () => {
      renderWithProviders(<ErrorCodesSection />);

      expect(screen.getByText(/exponential backoff/i)).toBeInTheDocument();
    });
  });
});
