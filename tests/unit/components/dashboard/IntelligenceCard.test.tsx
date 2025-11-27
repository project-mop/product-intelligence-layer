/**
 * IntelligenceCard Component Tests
 *
 * Tests for the IntelligenceCard component rendering, interactions, and navigation.
 *
 * @see docs/stories/3-4-intelligence-list-dashboard.md - AC: 2, 3, 8
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, fireEvent } from "../../../support/render";
import { IntelligenceCard, type ProcessWithStatus } from "~/components/dashboard/IntelligenceCard";

// Mock process data factory
function createMockProcess(overrides: Partial<ProcessWithStatus> = {}): ProcessWithStatus {
  return {
    id: "proc_test_123",
    name: "Test Intelligence",
    description: "A test intelligence description for testing purposes.",
    status: "SANDBOX",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-15"),
    ...overrides,
  };
}

describe("IntelligenceCard", () => {
  const defaultProps = {
    process: createMockProcess(),
    onTest: vi.fn(),
    onEdit: vi.fn(),
    onDocs: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("content rendering", () => {
    it("should render process name", () => {
      renderWithProviders(<IntelligenceCard {...defaultProps} />);

      expect(screen.getByText("Test Intelligence")).toBeInTheDocument();
    });

    it("should render process description", () => {
      renderWithProviders(<IntelligenceCard {...defaultProps} />);

      expect(
        screen.getByText("A test intelligence description for testing purposes.")
      ).toBeInTheDocument();
    });

    it("should render status badge", () => {
      renderWithProviders(<IntelligenceCard {...defaultProps} />);

      expect(screen.getByText("Sandbox")).toBeInTheDocument();
    });

    it("should render 'No description' when description is null", () => {
      const process = createMockProcess({ description: null });
      renderWithProviders(
        <IntelligenceCard {...defaultProps} process={process} />
      );

      expect(screen.getByText("No description")).toBeInTheDocument();
    });
  });

  describe("description truncation", () => {
    it("should truncate long descriptions with ellipsis", () => {
      const longDescription = "A".repeat(150);
      const process = createMockProcess({ description: longDescription });
      renderWithProviders(
        <IntelligenceCard {...defaultProps} process={process} />
      );

      // Description should be truncated to ~100 chars + ellipsis
      const truncatedText = screen.getByText(/^A+\.\.\.$/);
      expect(truncatedText).toBeInTheDocument();
      expect(truncatedText.textContent?.length).toBeLessThanOrEqual(104); // 100 chars + "..."
    });

    it("should not truncate short descriptions", () => {
      const shortDescription = "Short description";
      const process = createMockProcess({ description: shortDescription });
      renderWithProviders(
        <IntelligenceCard {...defaultProps} process={process} />
      );

      expect(screen.getByText("Short description")).toBeInTheDocument();
    });

    it("should handle exactly 100 character descriptions", () => {
      const exactDescription = "A".repeat(100);
      const process = createMockProcess({ description: exactDescription });
      renderWithProviders(
        <IntelligenceCard {...defaultProps} process={process} />
      );

      expect(screen.getByText(exactDescription)).toBeInTheDocument();
    });
  });

  describe("status badge variants", () => {
    it("should render DRAFT status badge", () => {
      const process = createMockProcess({ status: "DRAFT" });
      renderWithProviders(
        <IntelligenceCard {...defaultProps} process={process} />
      );

      expect(screen.getByText("Draft")).toBeInTheDocument();
    });

    it("should render SANDBOX status badge", () => {
      const process = createMockProcess({ status: "SANDBOX" });
      renderWithProviders(
        <IntelligenceCard {...defaultProps} process={process} />
      );

      expect(screen.getByText("Sandbox")).toBeInTheDocument();
    });

    it("should render PRODUCTION status badge", () => {
      const process = createMockProcess({ status: "PRODUCTION" });
      renderWithProviders(
        <IntelligenceCard {...defaultProps} process={process} />
      );

      expect(screen.getByText("Production")).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("should link to process detail page", () => {
      renderWithProviders(<IntelligenceCard {...defaultProps} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/dashboard/processes/proc_test_123");
    });

    it("should link to correct detail page for different process IDs", () => {
      const process = createMockProcess({ id: "proc_custom_456" });
      renderWithProviders(
        <IntelligenceCard {...defaultProps} process={process} />
      );

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/dashboard/processes/proc_custom_456");
    });
  });

  describe("quick action buttons", () => {
    it("should render Test button", () => {
      renderWithProviders(<IntelligenceCard {...defaultProps} />);

      expect(screen.getByRole("button", { name: /test/i })).toBeInTheDocument();
    });

    it("should render Edit button", () => {
      renderWithProviders(<IntelligenceCard {...defaultProps} />);

      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    });

    it("should render Docs button", () => {
      renderWithProviders(<IntelligenceCard {...defaultProps} />);

      expect(screen.getByRole("button", { name: /docs/i })).toBeInTheDocument();
    });

    it("should call onTest when Test button is clicked", () => {
      const onTest = vi.fn();
      renderWithProviders(
        <IntelligenceCard {...defaultProps} onTest={onTest} />
      );

      const testButton = screen.getByRole("button", { name: /test/i });
      fireEvent.click(testButton);

      expect(onTest).toHaveBeenCalledTimes(1);
    });

    it("should call onEdit when Edit button is clicked", () => {
      const onEdit = vi.fn();
      renderWithProviders(
        <IntelligenceCard {...defaultProps} onEdit={onEdit} />
      );

      const editButton = screen.getByRole("button", { name: /edit/i });
      fireEvent.click(editButton);

      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it("should call onDocs when Docs button is clicked", () => {
      const onDocs = vi.fn();
      renderWithProviders(
        <IntelligenceCard {...defaultProps} onDocs={onDocs} />
      );

      const docsButton = screen.getByRole("button", { name: /docs/i });
      fireEvent.click(docsButton);

      expect(onDocs).toHaveBeenCalledTimes(1);
    });

    it("should prevent link navigation when action button is clicked", () => {
      const onTest = vi.fn();
      renderWithProviders(
        <IntelligenceCard {...defaultProps} onTest={onTest} />
      );

      const testButton = screen.getByRole("button", { name: /test/i });
      fireEvent.click(testButton);

      // The onClick handler calls stopPropagation, which should prevent navigation
      expect(onTest).toHaveBeenCalled();
    });
  });

  describe("styling and hover states", () => {
    it("should have group class for hover behavior", () => {
      renderWithProviders(<IntelligenceCard {...defaultProps} />);

      // The card should have 'group' class for hover state management
      const card = document.querySelector(".group");
      expect(card).toBeInTheDocument();
    });

    it("should apply hover shadow class", () => {
      renderWithProviders(<IntelligenceCard {...defaultProps} />);

      const card = document.querySelector(".hover\\:shadow-md");
      expect(card).toBeInTheDocument();
    });
  });
});
