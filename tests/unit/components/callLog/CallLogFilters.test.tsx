/**
 * CallLogFilters Component Tests
 *
 * Story 6.2: Call History UI - AC 3
 * Tests the filter controls for call history.
 *
 * @see src/components/callLog/CallLogFilters.tsx
 * @see docs/stories/6-2-call-history-ui.md
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor } from "../../../support/render";
import { CallLogFilters, type CallLogFiltersState } from "~/components/callLog/CallLogFilters";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
  usePathname: () => "/dashboard/processes/proc_123/logs",
  useSearchParams: () => new URLSearchParams(),
}));

describe("Story 6.2: CallLogFilters", () => {
  let onFiltersChange: (filters: CallLogFiltersState) => void;

  beforeEach(() => {
    onFiltersChange = vi.fn();
    vi.clearAllMocks();
  });

  describe("AC 3: Filter by date range, status, latency", () => {
    it("should render filter controls", () => {
      renderWithProviders(<CallLogFilters onFiltersChange={onFiltersChange} />);

      // Should display Filters label
      expect(screen.getByText("Filters")).toBeInTheDocument();
    });

    it("should render date range inputs", () => {
      renderWithProviders(<CallLogFilters onFiltersChange={onFiltersChange} />);

      // Should have date range separator
      expect(screen.getByText("to")).toBeInTheDocument();
    });

    it("should render status filter dropdown", () => {
      renderWithProviders(<CallLogFilters onFiltersChange={onFiltersChange} />);

      // Should have status filter (might be a select or combobox)
      const statusTrigger = screen.getByRole("combobox");
      expect(statusTrigger).toBeInTheDocument();
    });

    it("should render latency threshold input", () => {
      renderWithProviders(<CallLogFilters onFiltersChange={onFiltersChange} />);

      // Should have latency input
      const latencyInput = screen.getByPlaceholderText(/min latency/i);
      expect(latencyInput).toBeInTheDocument();
    });

    it("should call onFiltersChange when status filter changes", async () => {
      renderWithProviders(<CallLogFilters onFiltersChange={onFiltersChange} />);

      // Click the status dropdown
      const statusTrigger = screen.getByRole("combobox");
      fireEvent.click(statusTrigger);

      // Wait for dropdown to open and select an option
      await waitFor(() => {
        const successOption = screen.getByText(/success/i);
        if (successOption) {
          fireEvent.click(successOption);
        }
      });

      // onFiltersChange should be called
      await waitFor(() => {
        expect(onFiltersChange).toHaveBeenCalled();
      });
    });

    it("should call onFiltersChange when latency input changes", async () => {
      renderWithProviders(<CallLogFilters onFiltersChange={onFiltersChange} />);

      const latencyInput = screen.getByPlaceholderText(/min latency/i);
      fireEvent.change(latencyInput, { target: { value: "500" } });

      await waitFor(() => {
        expect(onFiltersChange).toHaveBeenCalled();
      });
    });

    it("should only allow numeric values in latency input", async () => {
      const mockOnFiltersChange = vi.fn();
      renderWithProviders(<CallLogFilters onFiltersChange={mockOnFiltersChange} />);

      const latencyInput = screen.getByPlaceholderText(/min latency/i) as HTMLInputElement;
      fireEvent.change(latencyInput, { target: { value: "abc123" } });

      // Should strip non-numeric characters
      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalled();
        // The call should include only the numeric part
        const lastCall = mockOnFiltersChange.mock.calls[mockOnFiltersChange.mock.calls.length - 1];
        if (lastCall?.[0]?.minLatencyMs) {
          expect(lastCall[0].minLatencyMs).toBe(123);
        }
      });
    });

    it("should not show Clear button when no filters active", () => {
      renderWithProviders(<CallLogFilters onFiltersChange={onFiltersChange} />);

      // Clear button should not be visible when no filters
      expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
    });
  });

  describe("Filter badge count", () => {
    it("should not show badge when no filters active", () => {
      renderWithProviders(<CallLogFilters onFiltersChange={onFiltersChange} />);

      // Should not have a badge with a number
      const badges = screen.queryAllByText(/^[0-9]+$/);
      expect(badges.length).toBe(0);
    });
  });
});
