/**
 * Circuit Breaker Unit Tests
 *
 * Tests the circuit breaker state machine logic for LLM gateway protection.
 *
 * @see docs/stories/4-4-llm-unavailability-handling.md
 * @see src/server/services/llm/circuit-breaker.ts
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  CircuitBreaker,
  createCircuitBreakerLogger,
  type CircuitStateChangeEvent,
} from "~/server/services/llm/circuit-breaker";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("CLOSED state", () => {
    it("should allow all requests when circuit is closed", () => {
      const cb = new CircuitBreaker();

      expect(cb.canRequest()).toBe(true);
      expect(cb.getState()).toBe("CLOSED");
    });

    it("should stay closed after successful requests", () => {
      const cb = new CircuitBreaker();

      cb.recordSuccess();
      cb.recordSuccess();
      cb.recordSuccess();

      expect(cb.getState()).toBe("CLOSED");
      expect(cb.canRequest()).toBe(true);
    });

    it("should reset failure count on success", () => {
      const cb = new CircuitBreaker({ threshold: 5 });

      // Record some failures
      cb.recordFailure();
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getFailureCount()).toBe(3);

      // Success resets the count
      cb.recordSuccess();
      expect(cb.getFailureCount()).toBe(0);
    });
  });

  describe("Failure counting", () => {
    it("should increment failure count correctly", () => {
      const cb = new CircuitBreaker({ threshold: 5 });

      cb.recordFailure();
      expect(cb.getFailureCount()).toBe(1);

      cb.recordFailure();
      expect(cb.getFailureCount()).toBe(2);

      cb.recordFailure();
      expect(cb.getFailureCount()).toBe(3);
    });

    it("should use default threshold of 5 from config", () => {
      const cb = new CircuitBreaker();

      // 4 failures - still closed
      for (let i = 0; i < 4; i++) {
        cb.recordFailure();
      }
      expect(cb.getState()).toBe("CLOSED");

      // 5th failure opens the circuit
      cb.recordFailure();
      expect(cb.getState()).toBe("OPEN");
    });

    it("should use custom threshold when provided", () => {
      const cb = new CircuitBreaker({ threshold: 3 });

      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe("CLOSED");

      cb.recordFailure();
      expect(cb.getState()).toBe("OPEN");
    });
  });

  describe("OPEN state", () => {
    it("should open circuit after threshold failures", () => {
      const cb = new CircuitBreaker({ threshold: 5 });

      for (let i = 0; i < 5; i++) {
        cb.recordFailure();
      }

      expect(cb.getState()).toBe("OPEN");
      expect(cb.canRequest()).toBe(false);
    });

    it("should reject all requests when circuit is open", () => {
      const cb = new CircuitBreaker({ threshold: 2 });

      cb.recordFailure();
      cb.recordFailure();

      expect(cb.canRequest()).toBe(false);
      expect(cb.canRequest()).toBe(false);
      expect(cb.canRequest()).toBe(false);
    });

    it("should return correct retry-after seconds when open", () => {
      const cb = new CircuitBreaker({ threshold: 2, timeoutMs: 30000 });

      cb.recordFailure();
      cb.recordFailure();

      // Just opened - should be 30 seconds
      expect(cb.getRetryAfterSeconds()).toBe(30);

      // Advance 10 seconds
      vi.advanceTimersByTime(10000);
      expect(cb.getRetryAfterSeconds()).toBe(20);

      // Advance another 15 seconds
      vi.advanceTimersByTime(15000);
      expect(cb.getRetryAfterSeconds()).toBe(5);
    });

    it("should return null for retry-after when not in OPEN state", () => {
      const cb = new CircuitBreaker();

      expect(cb.getRetryAfterSeconds()).toBeNull();
    });
  });

  describe("HALF_OPEN state", () => {
    it("should transition to HALF_OPEN after timeout", () => {
      const cb = new CircuitBreaker({ threshold: 2, timeoutMs: 30000 });

      // Open the circuit
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe("OPEN");

      // Advance time past timeout
      vi.advanceTimersByTime(30001);

      // getState() should now return HALF_OPEN
      expect(cb.getState()).toBe("HALF_OPEN");
    });

    it("should allow one probe request in HALF_OPEN state", () => {
      const cb = new CircuitBreaker({ threshold: 2, timeoutMs: 30000 });

      // Open and wait for timeout
      cb.recordFailure();
      cb.recordFailure();
      vi.advanceTimersByTime(30001);

      // Should allow request
      expect(cb.canRequest()).toBe(true);
      expect(cb.getState()).toBe("HALF_OPEN");
    });

    it("should close circuit on successful probe", () => {
      const cb = new CircuitBreaker({ threshold: 2, timeoutMs: 30000 });

      // Open and wait for timeout
      cb.recordFailure();
      cb.recordFailure();
      vi.advanceTimersByTime(30001);
      cb.canRequest(); // Trigger transition to HALF_OPEN

      // Record success
      cb.recordSuccess();

      expect(cb.getState()).toBe("CLOSED");
      expect(cb.getFailureCount()).toBe(0);
      expect(cb.canRequest()).toBe(true);
    });

    it("should re-open circuit on failed probe", () => {
      const cb = new CircuitBreaker({ threshold: 2, timeoutMs: 30000 });

      // Open and wait for timeout
      cb.recordFailure();
      cb.recordFailure();
      vi.advanceTimersByTime(30001);
      cb.canRequest(); // Trigger transition to HALF_OPEN

      // Record failure - should re-open
      cb.recordFailure();

      expect(cb.getState()).toBe("OPEN");
      expect(cb.canRequest()).toBe(false);
    });
  });

  describe("State change logging", () => {
    it("should call onStateChange when circuit opens", () => {
      const onStateChange = vi.fn();
      const cb = new CircuitBreaker({
        threshold: 2,
        timeoutMs: 30000,
        provider: "anthropic",
        onStateChange,
      });

      cb.recordFailure();
      cb.recordFailure();

      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "anthropic",
          previousState: "CLOSED",
          newState: "OPEN",
          failureCount: 2,
          openUntil: expect.any(String),
        })
      );
    });

    it("should call onStateChange when circuit closes from HALF_OPEN", () => {
      const onStateChange = vi.fn();
      const cb = new CircuitBreaker({
        threshold: 2,
        timeoutMs: 30000,
        provider: "anthropic",
        onStateChange,
      });

      // Open circuit
      cb.recordFailure();
      cb.recordFailure();
      onStateChange.mockClear();

      // Wait for timeout and trigger HALF_OPEN
      vi.advanceTimersByTime(30001);
      cb.canRequest();

      // Record success to close
      cb.recordSuccess();

      expect(onStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          provider: "anthropic",
          previousState: "HALF_OPEN",
          newState: "CLOSED",
          failureCount: 0,
        })
      );
    });

    it("should call onStateChange when entering HALF_OPEN", () => {
      const onStateChange = vi.fn();
      const cb = new CircuitBreaker({
        threshold: 2,
        timeoutMs: 30000,
        provider: "anthropic",
        onStateChange,
      });

      cb.recordFailure();
      cb.recordFailure();
      onStateChange.mockClear();

      vi.advanceTimersByTime(30001);
      cb.canRequest(); // Triggers transition

      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "anthropic",
          previousState: "OPEN",
          newState: "HALF_OPEN",
        })
      );
    });

    it("should log with correct level (warn for OPEN, info for others)", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const consoleInfoSpy = vi
        .spyOn(console, "info")
        .mockImplementation(() => {});

      const openEvent: CircuitStateChangeEvent = {
        provider: "anthropic",
        previousState: "CLOSED",
        newState: "OPEN",
        failureCount: 5,
        openUntil: new Date().toISOString(),
      };

      createCircuitBreakerLogger(openEvent);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[CircuitBreaker]",
        expect.stringContaining('"level":"warn"')
      );

      const closeEvent: CircuitStateChangeEvent = {
        provider: "anthropic",
        previousState: "HALF_OPEN",
        newState: "CLOSED",
        failureCount: 0,
      };

      createCircuitBreakerLogger(closeEvent);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[CircuitBreaker]",
        expect.stringContaining('"level":"info"')
      );

      consoleSpy.mockRestore();
      consoleInfoSpy.mockRestore();
    });
  });

  describe("Environment variable configuration", () => {
    it("should use CIRCUIT_BREAKER_THRESHOLD env var", () => {
      const originalEnv = process.env.CIRCUIT_BREAKER_THRESHOLD;
      process.env.CIRCUIT_BREAKER_THRESHOLD = "3";

      const cb = new CircuitBreaker();

      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe("CLOSED");

      cb.recordFailure();
      expect(cb.getState()).toBe("OPEN");

      process.env.CIRCUIT_BREAKER_THRESHOLD = originalEnv;
    });

    it("should use CIRCUIT_BREAKER_TIMEOUT_MS env var", () => {
      const originalEnv = process.env.CIRCUIT_BREAKER_TIMEOUT_MS;
      process.env.CIRCUIT_BREAKER_TIMEOUT_MS = "10000";

      const cb = new CircuitBreaker({ threshold: 1 });
      cb.recordFailure();

      // Should be 10 seconds
      expect(cb.getRetryAfterSeconds()).toBe(10);

      // After 10 seconds, should transition
      vi.advanceTimersByTime(10001);
      expect(cb.getState()).toBe("HALF_OPEN");

      process.env.CIRCUIT_BREAKER_TIMEOUT_MS = originalEnv;
    });
  });

  describe("reset()", () => {
    it("should reset circuit to initial state", () => {
      const cb = new CircuitBreaker({ threshold: 2 });

      // Open the circuit
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe("OPEN");

      // Reset
      cb.reset();

      expect(cb.getState()).toBe("CLOSED");
      expect(cb.getFailureCount()).toBe(0);
      expect(cb.canRequest()).toBe(true);
    });
  });
});
