/**
 * CallLogErrorState Component Tests
 *
 * Story 6.2: Call History UI - AC 9
 * Tests the error state component displayed when data fails to load.
 *
 * @see src/components/callLog/CallLogErrorState.tsx
 * @see docs/stories/6-2-call-history-ui.md
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, fireEvent } from "../../../support/render";
import { CallLogErrorState } from "~/components/callLog/CallLogErrorState";

describe("Story 6.2: CallLogErrorState", () => {
  describe("AC 9: Error state shows clear message with retry option", () => {
    it("should display error title", () => {
      const onRetry = vi.fn();
      renderWithProviders(<CallLogErrorState onRetry={onRetry} />);

      expect(screen.getByText("Failed to load call history")).toBeInTheDocument();
    });

    it("should display default error message when no message provided", () => {
      const onRetry = vi.fn();
      renderWithProviders(<CallLogErrorState onRetry={onRetry} />);

      expect(
        screen.getByText(/an error occurred while fetching call logs/i)
      ).toBeInTheDocument();
    });

    it("should display custom error message when provided", () => {
      const onRetry = vi.fn();
      renderWithProviders(
        <CallLogErrorState message="Network connection failed" onRetry={onRetry} />
      );

      expect(screen.getByText("Network connection failed")).toBeInTheDocument();
    });

    it("should display Retry button", () => {
      const onRetry = vi.fn();
      renderWithProviders(<CallLogErrorState onRetry={onRetry} />);

      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    it("should call onRetry when Retry button is clicked", () => {
      const onRetry = vi.fn();
      renderWithProviders(<CallLogErrorState onRetry={onRetry} />);

      fireEvent.click(screen.getByRole("button", { name: /retry/i }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("should display error icon", () => {
      const onRetry = vi.fn();
      renderWithProviders(<CallLogErrorState onRetry={onRetry} />);

      // Error state should be styled with destructive colors
      const card = screen.getByText("Failed to load call history").closest("div");
      expect(card).toBeInTheDocument();
    });
  });
});
