/**
 * Call Log Service Unit Tests
 *
 * Tests for logCallAsync and logCallSync functions.
 * Uses mocked database to test service behavior in isolation.
 *
 * @see docs/stories/6-1-call-logging-infrastructure.md
 * @see docs/testing-strategy-mvp.md
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { CallLogEntry } from "~/server/services/callLog/types";

// Local type to avoid importing from generated Prisma files (not available in CI pre-build)
type JsonValue = string | number | boolean | { [key: string]: JsonValue } | JsonValue[] | null;

// Mock the database module
vi.mock("~/server/db", () => ({
  db: {
    callLog: {
      create: vi.fn(),
    },
  },
}));

// Mock ID generator to be predictable
vi.mock("~/lib/id", () => ({
  generateRequestId: vi.fn(() => "req_test123456789012"),
}));

// Import after mocking
import { logCallAsync, logCallSync } from "~/server/services/callLog/call-log-service";
import { db } from "~/server/db";

describe("Call Log Service", () => {
  const mockEntry: CallLogEntry = {
    tenantId: "ten_test123",
    processId: "proc_test456",
    processVersionId: "procv_test789",
    inputHash: "abc123def456",
    input: { query: "test input" },
    output: { result: "test output" },
    statusCode: 200,
    errorCode: undefined,
    latencyMs: 150,
    modelUsed: "claude-3-haiku-20240307",
    cached: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("logCallAsync", () => {
    it("should call db.callLog.create with correct data", () => {
      const mockCreate = vi.mocked(db.callLog.create);
      mockCreate.mockResolvedValue({
        id: "req_test123456789012",
        tenantId: mockEntry.tenantId,
        processId: mockEntry.processId,
        processVersionId: mockEntry.processVersionId,
        inputHash: mockEntry.inputHash,
        input: mockEntry.input as JsonValue,
        output: mockEntry.output as JsonValue,
        statusCode: mockEntry.statusCode,
        errorCode: null,
        errorMessage: null,
        latencyMs: mockEntry.latencyMs,
        modelUsed: mockEntry.modelUsed!,
        cached: mockEntry.cached,
        createdAt: new Date(),
      });

      logCallAsync(mockEntry);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "req_test123456789012",
          tenantId: mockEntry.tenantId,
          processId: mockEntry.processId,
          processVersionId: mockEntry.processVersionId,
          inputHash: mockEntry.inputHash,
          input: mockEntry.input,
          output: mockEntry.output,
          statusCode: mockEntry.statusCode,
          errorCode: null,
          latencyMs: mockEntry.latencyMs,
          modelUsed: mockEntry.modelUsed,
          cached: mockEntry.cached,
        }),
      });
    });

    it("should be fire-and-forget (not await)", () => {
      const mockCreate = vi.mocked(db.callLog.create);
      // Create a promise that never resolves to test that we don't await
      mockCreate.mockReturnValue(new Promise(() => {}) as never);

      // This should return immediately, not hang
      const result = logCallAsync(mockEntry);

      expect(result).toBeUndefined();
      expect(mockCreate).toHaveBeenCalled();
    });

    it("should catch and log errors without throwing", async () => {
      const mockCreate = vi.mocked(db.callLog.create);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const testError = new Error("Database connection failed");
      mockCreate.mockRejectedValue(testError);

      logCallAsync(mockEntry);

      // Wait for the async error handler to run
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith(
        "[CallLog] Failed to write call log:",
        testError
      );
    });

    it("should handle undefined optional fields correctly", () => {
      const mockCreate = vi.mocked(db.callLog.create);
      mockCreate.mockResolvedValue({} as never);

      const entryWithoutOptionals: CallLogEntry = {
        tenantId: "ten_test",
        processId: "proc_test",
        processVersionId: "procv_test",
        inputHash: "hash123",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        latencyMs: 50,
        cached: false,
      };

      logCallAsync(entryWithoutOptionals);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          input: undefined,
          output: undefined,
          modelUsed: null,
          errorCode: "VALIDATION_ERROR",
        }),
      });
    });
  });

  describe("logCallSync", () => {
    it("should call db.callLog.create and return result", async () => {
      const mockCreate = vi.mocked(db.callLog.create);
      const createdAt = new Date();
      // The select clause means only these fields are returned
      mockCreate.mockResolvedValue({
        id: "req_test123456789012",
        createdAt,
      } as never);

      const result = await logCallSync(mockEntry);

      expect(result).toEqual({
        id: "req_test123456789012",
        createdAt,
      });
    });

    it("should pass all required fields to database", async () => {
      const mockCreate = vi.mocked(db.callLog.create);
      mockCreate.mockResolvedValue({
        id: "req_test123456789012",
        createdAt: new Date(),
      } as never);

      await logCallSync(mockEntry);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          id: "req_test123456789012",
          tenantId: mockEntry.tenantId,
          processId: mockEntry.processId,
          processVersionId: mockEntry.processVersionId,
          inputHash: mockEntry.inputHash,
          input: mockEntry.input,
          output: mockEntry.output,
          statusCode: mockEntry.statusCode,
          errorCode: null,
          latencyMs: mockEntry.latencyMs,
          modelUsed: mockEntry.modelUsed,
          cached: mockEntry.cached,
        },
        select: {
          id: true,
          createdAt: true,
        },
      });
    });

    it("should propagate database errors", async () => {
      const mockCreate = vi.mocked(db.callLog.create);
      const testError = new Error("Unique constraint violation");
      mockCreate.mockRejectedValue(testError);

      await expect(logCallSync(mockEntry)).rejects.toThrow(
        "Unique constraint violation"
      );
    });

    it("should handle error entry with errorCode", async () => {
      const mockCreate = vi.mocked(db.callLog.create);
      mockCreate.mockResolvedValue({
        id: "req_test123456789012",
        createdAt: new Date(),
      } as never);

      const errorEntry: CallLogEntry = {
        ...mockEntry,
        statusCode: 500,
        errorCode: "LLM_ERROR",
        output: { error: { code: "LLM_ERROR" } },
        modelUsed: undefined,
      };

      await logCallSync(errorEntry);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          statusCode: 500,
          errorCode: "LLM_ERROR",
          output: { error: { code: "LLM_ERROR" } },
          modelUsed: null,
        }),
        select: expect.any(Object),
      });
    });
  });
});
