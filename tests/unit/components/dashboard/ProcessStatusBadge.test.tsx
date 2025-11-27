/**
 * ProcessStatusBadge Component Tests
 *
 * Tests for the ProcessStatusBadge component rendering and styling.
 *
 * @see docs/stories/3-4-intelligence-list-dashboard.md - AC: 2
 */

import React from "react";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../../support/render";
import { ProcessStatusBadge } from "~/components/dashboard/ProcessStatusBadge";

describe("ProcessStatusBadge", () => {
  describe("status label rendering", () => {
    it("should render DRAFT label correctly", () => {
      renderWithProviders(<ProcessStatusBadge status="DRAFT" />);

      expect(screen.getByText("Draft")).toBeInTheDocument();
    });

    it("should render SANDBOX label correctly", () => {
      renderWithProviders(<ProcessStatusBadge status="SANDBOX" />);

      expect(screen.getByText("Sandbox")).toBeInTheDocument();
    });

    it("should render PRODUCTION label correctly", () => {
      renderWithProviders(<ProcessStatusBadge status="PRODUCTION" />);

      expect(screen.getByText("Production")).toBeInTheDocument();
    });
  });

  describe("status styling", () => {
    it("should apply gray styling for DRAFT status", () => {
      renderWithProviders(<ProcessStatusBadge status="DRAFT" />);

      const badge = screen.getByText("Draft");
      expect(badge).toHaveClass("bg-gray-100", "text-gray-700");
    });

    it("should apply amber styling for SANDBOX status", () => {
      renderWithProviders(<ProcessStatusBadge status="SANDBOX" />);

      const badge = screen.getByText("Sandbox");
      expect(badge).toHaveClass("bg-amber-100", "text-amber-700");
    });

    it("should apply green styling for PRODUCTION status", () => {
      renderWithProviders(<ProcessStatusBadge status="PRODUCTION" />);

      const badge = screen.getByText("Production");
      expect(badge).toHaveClass("bg-green-100", "text-green-700");
    });
  });

  describe("custom className support", () => {
    it("should accept custom className prop", () => {
      renderWithProviders(
        <ProcessStatusBadge status="DRAFT" className="custom-class" />
      );

      const badge = screen.getByText("Draft");
      expect(badge).toHaveClass("custom-class");
    });

    it("should merge custom className with default styles", () => {
      renderWithProviders(
        <ProcessStatusBadge status="SANDBOX" className="ml-4" />
      );

      const badge = screen.getByText("Sandbox");
      expect(badge).toHaveClass("ml-4", "bg-amber-100");
    });
  });

  describe("accessibility", () => {
    it("should render as span element with data-slot attribute", () => {
      renderWithProviders(<ProcessStatusBadge status="PRODUCTION" />);

      const badge = screen.getByText("Production");
      expect(badge.tagName).toBe("SPAN");
      expect(badge).toHaveAttribute("data-slot", "badge");
    });
  });
});
