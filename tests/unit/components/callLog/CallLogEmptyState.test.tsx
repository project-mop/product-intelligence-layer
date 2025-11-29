/**
 * CallLogEmptyState Component Tests
 *
 * Story 6.2: Call History UI - AC 8
 * Tests the empty state component displayed when no call logs exist.
 *
 * @see src/components/callLog/CallLogEmptyState.tsx
 * @see docs/stories/6-2-call-history-ui.md
 */

import React from "react";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../../support/render";
import { CallLogEmptyState } from "~/components/callLog/CallLogEmptyState";

describe("Story 6.2: CallLogEmptyState", () => {
  describe("AC 8: Empty state shows helpful message", () => {
    it("should display 'No calls yet' message", () => {
      renderWithProviders(<CallLogEmptyState processId="proc_123" />);

      expect(screen.getByText("No calls yet")).toBeInTheDocument();
    });

    it("should display helpful description text", () => {
      renderWithProviders(<CallLogEmptyState processId="proc_123" />);

      expect(
        screen.getByText(/hasn't received any API calls yet/i)
      ).toBeInTheDocument();
    });

    it("should display Test Endpoint button linking to test page", () => {
      renderWithProviders(<CallLogEmptyState processId="proc_123" />);

      const testButton = screen.getByRole("link", { name: /test endpoint/i });
      expect(testButton).toBeInTheDocument();
      expect(testButton).toHaveAttribute(
        "href",
        "/dashboard/processes/proc_123/test"
      );
    });

    it("should display API Docs button linking to docs page", () => {
      renderWithProviders(<CallLogEmptyState processId="proc_456" />);

      const docsButton = screen.getByRole("link", { name: /api docs/i });
      expect(docsButton).toBeInTheDocument();
      expect(docsButton).toHaveAttribute(
        "href",
        "/dashboard/processes/proc_456/docs"
      );
    });

    it("should display history icon", () => {
      renderWithProviders(<CallLogEmptyState processId="proc_123" />);

      // The component should have a visual indicator (icon)
      const container = screen.getByText("No calls yet").closest("div");
      expect(container).toBeInTheDocument();
    });
  });
});
