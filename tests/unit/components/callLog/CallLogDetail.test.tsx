/**
 * CallLogDetail Component Tests
 *
 * Story 6.2: Call History UI - AC 2, 7
 * Tests the detail sheet showing full call log information.
 *
 * @see src/components/callLog/CallLogDetail.tsx
 * @see docs/stories/6-2-call-history-ui.md
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor } from "../../../support/render";

// Mock the tRPC hook
const mockUseQuery = vi.fn();

vi.mock("~/trpc/react", () => ({
  api: {
    callLog: {
      get: {
        useQuery: (input: { id: string }, options?: { enabled: boolean }) => mockUseQuery(input, options),
      },
    },
  },
}));

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};

// Import after mocking
import { CallLogDetail } from "~/components/callLog/CallLogDetail";

const sampleLog = {
  id: "log_123",
  processId: "proc_456",
  processVersionId: "ver_789",
  inputHash: "abc123def456",
  input: { query: "test input", data: { nested: true } },
  output: { result: "success", items: [1, 2, 3] },
  latencyMs: 245,
  cached: false,
  errorCode: null,
  statusCode: 200,
  modelUsed: "claude-3-haiku-20240307",
  createdAt: new Date("2025-01-15T10:30:00Z"),
};

describe("Story 6.2: CallLogDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });
  });

  describe("when closed", () => {
    it("should not fetch data when not open", () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      renderWithProviders(
        <CallLogDetail logId="log_123" open={false} onOpenChange={vi.fn()} />
      );

      // Query should be disabled when not open
      expect(mockUseQuery).toHaveBeenCalledWith(
        { id: "log_123" },
        expect.objectContaining({ enabled: false })
      );
    });
  });

  describe("AC 2: Detail view shows full input, output, metadata", () => {
    it("should display loading skeleton while fetching", () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      renderWithProviders(
        <CallLogDetail logId="log_123" open={true} onOpenChange={vi.fn()} />
      );

      // Should show skeleton or loading state
      // The component should render without errors
      expect(screen.getByText("Call Log Details")).toBeInTheDocument();
    });

    it("should display error message on fetch failure", () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: { message: "Failed to fetch" },
      });

      renderWithProviders(
        <CallLogDetail logId="log_123" open={true} onOpenChange={vi.fn()} />
      );

      expect(screen.getByText(/failed to load call details/i)).toBeInTheDocument();
    });

    it("should display full log data when loaded", () => {
      mockUseQuery.mockReturnValue({
        data: sampleLog,
        isLoading: false,
        error: null,
      });

      renderWithProviders(
        <CallLogDetail logId="log_123" open={true} onOpenChange={vi.fn()} />
      );

      // Should display header info
      expect(screen.getByText("Call Log Details")).toBeInTheDocument();

      // Should display status code
      expect(screen.getByText("200")).toBeInTheDocument();

      // Should display latency
      expect(screen.getByText("245ms")).toBeInTheDocument();

      // Should display model
      expect(screen.getByText("claude-3-haiku-20240307")).toBeInTheDocument();
    });

    it("should display metadata section", () => {
      mockUseQuery.mockReturnValue({
        data: sampleLog,
        isLoading: false,
        error: null,
      });

      renderWithProviders(
        <CallLogDetail logId="log_123" open={true} onOpenChange={vi.fn()} />
      );

      // Should display metadata labels and values
      expect(screen.getByText("Metadata")).toBeInTheDocument();
      expect(screen.getByText(/log_123/)).toBeInTheDocument();
      expect(screen.getByText(/proc_456/)).toBeInTheDocument();
    });
  });

  describe("AC 7: JSON with syntax highlighting and copy buttons", () => {
    it("should display Request Input section", () => {
      mockUseQuery.mockReturnValue({
        data: sampleLog,
        isLoading: false,
        error: null,
      });

      renderWithProviders(
        <CallLogDetail logId="log_123" open={true} onOpenChange={vi.fn()} />
      );

      expect(screen.getByText("Request Input")).toBeInTheDocument();
    });

    it("should display Response Output section", () => {
      mockUseQuery.mockReturnValue({
        data: sampleLog,
        isLoading: false,
        error: null,
      });

      renderWithProviders(
        <CallLogDetail logId="log_123" open={true} onOpenChange={vi.fn()} />
      );

      expect(screen.getByText("Response Output")).toBeInTheDocument();
    });

    it("should display copy buttons for input and output", () => {
      mockUseQuery.mockReturnValue({
        data: sampleLog,
        isLoading: false,
        error: null,
      });

      renderWithProviders(
        <CallLogDetail logId="log_123" open={true} onOpenChange={vi.fn()} />
      );

      expect(screen.getByRole("button", { name: /copy input/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /copy output/i })).toBeInTheDocument();
    });

    it("should copy input JSON to clipboard when copy button clicked", async () => {
      mockUseQuery.mockReturnValue({
        data: sampleLog,
        isLoading: false,
        error: null,
      });

      renderWithProviders(
        <CallLogDetail logId="log_123" open={true} onOpenChange={vi.fn()} />
      );

      const copyInputButton = screen.getByRole("button", { name: /copy input/i });
      fireEvent.click(copyInputButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
          JSON.stringify(sampleLog.input, null, 2)
        );
      });
    });

    it("should copy output JSON to clipboard when copy button clicked", async () => {
      mockUseQuery.mockReturnValue({
        data: sampleLog,
        isLoading: false,
        error: null,
      });

      renderWithProviders(
        <CallLogDetail logId="log_123" open={true} onOpenChange={vi.fn()} />
      );

      const copyOutputButton = screen.getByRole("button", { name: /copy output/i });
      fireEvent.click(copyOutputButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(
          JSON.stringify(sampleLog.output, null, 2)
        );
      });
    });

    it("should show 'Copied' feedback after copying", async () => {
      mockUseQuery.mockReturnValue({
        data: sampleLog,
        isLoading: false,
        error: null,
      });

      renderWithProviders(
        <CallLogDetail logId="log_123" open={true} onOpenChange={vi.fn()} />
      );

      const copyInputButton = screen.getByRole("button", { name: /copy input/i });
      fireEvent.click(copyInputButton);

      await waitFor(() => {
        expect(screen.getByText("Copied")).toBeInTheDocument();
      });
    });
  });

  describe("Error display", () => {
    it("should display error code when present", () => {
      const errorLog = {
        ...sampleLog,
        statusCode: 500,
        errorCode: "INTERNAL_ERROR",
      };

      mockUseQuery.mockReturnValue({
        data: errorLog,
        isLoading: false,
        error: null,
      });

      renderWithProviders(
        <CallLogDetail logId="log_123" open={true} onOpenChange={vi.fn()} />
      );

      expect(screen.getByText(/INTERNAL_ERROR/)).toBeInTheDocument();
    });
  });

  describe("Cached indicator", () => {
    it("should display 'Yes' for cached responses", () => {
      const cachedLog = { ...sampleLog, cached: true };

      mockUseQuery.mockReturnValue({
        data: cachedLog,
        isLoading: false,
        error: null,
      });

      renderWithProviders(
        <CallLogDetail logId="log_123" open={true} onOpenChange={vi.fn()} />
      );

      expect(screen.getByText("Yes")).toBeInTheDocument();
    });

    it("should display 'No' for non-cached responses", () => {
      mockUseQuery.mockReturnValue({
        data: sampleLog,
        isLoading: false,
        error: null,
      });

      renderWithProviders(
        <CallLogDetail logId="log_123" open={true} onOpenChange={vi.fn()} />
      );

      expect(screen.getByText("No")).toBeInTheDocument();
    });
  });
});
