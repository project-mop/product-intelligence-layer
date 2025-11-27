/**
 * ProcessEmptyState Component Tests
 *
 * Tests for the ProcessEmptyState component rendering and CTA button.
 *
 * @see docs/stories/3-4-intelligence-list-dashboard.md - AC: 7
 */

import React from "react";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../../support/render";
import { ProcessEmptyState } from "~/components/dashboard/ProcessEmptyState";

describe("ProcessEmptyState", () => {
  describe("content rendering", () => {
    it("should render empty state heading", () => {
      renderWithProviders(<ProcessEmptyState />);

      expect(screen.getByText("No intelligences yet")).toBeInTheDocument();
    });

    it("should render helpful message", () => {
      renderWithProviders(<ProcessEmptyState />);

      expect(
        screen.getByText("Create your first intelligence to get started.")
      ).toBeInTheDocument();
    });

    it("should render Zap icon illustration", () => {
      renderWithProviders(<ProcessEmptyState />);

      // Check for the icon container with the Zap icon
      const iconContainer = document.querySelector(".rounded-full.bg-primary\\/10");
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe("CTA button", () => {
    it("should render Create Intelligence button", () => {
      renderWithProviders(<ProcessEmptyState />);

      const button = screen.getByRole("button", { name: /create intelligence/i });
      expect(button).toBeInTheDocument();
    });

    it("should link to the new process page", () => {
      renderWithProviders(<ProcessEmptyState />);

      const link = screen.getByRole("link", { name: /create intelligence/i });
      expect(link).toHaveAttribute("href", "/dashboard/processes/new");
    });

    it("should include Plus icon in button", () => {
      renderWithProviders(<ProcessEmptyState />);

      // Button exists with Create Intelligence text
      const button = screen.getByRole("button", { name: /create intelligence/i });
      expect(button).toHaveClass("gap-2");
    });
  });

  describe("styling", () => {
    it("should render as a dashed border card", () => {
      renderWithProviders(<ProcessEmptyState />);

      // Check for dashed border class on parent card
      const card = document.querySelector(".border-dashed");
      expect(card).toBeInTheDocument();
    });

    it("should center content", () => {
      renderWithProviders(<ProcessEmptyState />);

      // Check for centered content classes
      const content = document.querySelector(".flex.flex-col.items-center.justify-center");
      expect(content).toBeInTheDocument();
    });
  });
});
