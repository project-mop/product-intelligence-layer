/**
 * Circuit Breaker for LLM Gateway
 *
 * Implements the circuit breaker pattern to fail fast during provider outages.
 * Prevents cascading failures by short-circuiting requests when the provider is unhealthy.
 *
 * States:
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Provider unhealthy, all requests fail fast
 * - HALF_OPEN: Testing if provider recovered, allow one probe request
 *
 * @see docs/tech-spec-epic-4.md#Story-4.4-LLM-Unavailability-Handling
 * @see docs/stories/4-4-llm-unavailability-handling.md
 */

/** Circuit breaker states */
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

/**
 * Structured log entry for circuit breaker state changes.
 */
export interface CircuitBreakerLogEntry {
  level: "warn" | "info";
  message: string;
  provider: string;
  previousState: CircuitState;
  newState: CircuitState;
  failureCount: number;
  openUntil?: string;
}

/**
 * Default logger for circuit breaker state transitions.
 * Uses structured logging format as specified in Story 4.4.
 */
export function createCircuitBreakerLogger(
  event: CircuitStateChangeEvent
): void {
  const logEntry: CircuitBreakerLogEntry = {
    level: event.newState === "OPEN" ? "warn" : "info",
    message: "Circuit breaker state changed",
    provider: event.provider,
    previousState: event.previousState,
    newState: event.newState,
    failureCount: event.failureCount,
    openUntil: event.openUntil,
  };

  if (logEntry.level === "warn") {
    console.warn("[CircuitBreaker]", JSON.stringify(logEntry));
  } else {
    console.info("[CircuitBreaker]", JSON.stringify(logEntry));
  }
}

/** Default failure threshold before circuit opens */
const DEFAULT_THRESHOLD = 5;

/** Default timeout in milliseconds before circuit transitions to half-open */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Configuration for CircuitBreaker.
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before circuit opens (default: 5) */
  threshold?: number;

  /** Duration in ms to keep circuit open before testing (default: 30000) */
  timeoutMs?: number;

  /** Provider identifier for logging (default: "unknown") */
  provider?: string;

  /** Optional logger for state transitions */
  onStateChange?: (event: CircuitStateChangeEvent) => void;
}

/**
 * Event emitted when circuit state changes.
 */
export interface CircuitStateChangeEvent {
  provider: string;
  previousState: CircuitState;
  newState: CircuitState;
  failureCount: number;
  openUntil?: string; // ISO timestamp when OPEN
}

/**
 * Circuit Breaker implementation.
 *
 * Tracks consecutive failures and opens circuit when threshold is reached.
 * After timeout, allows one probe request to test if provider recovered.
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private openedAt: number | null = null;
  private readonly threshold: number;
  private readonly timeoutMs: number;
  private readonly provider: string;
  private readonly onStateChange?: (event: CircuitStateChangeEvent) => void;

  constructor(config: CircuitBreakerConfig = {}) {
    this.threshold =
      config.threshold ??
      (process.env.CIRCUIT_BREAKER_THRESHOLD
        ? parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD, 10)
        : DEFAULT_THRESHOLD);

    this.timeoutMs =
      config.timeoutMs ??
      (process.env.CIRCUIT_BREAKER_TIMEOUT_MS
        ? parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_MS, 10)
        : DEFAULT_TIMEOUT_MS);

    this.provider = config.provider ?? "unknown";
    this.onStateChange = config.onStateChange;
  }

  /**
   * Check if a request can proceed through the circuit.
   *
   * @returns true if request is allowed, false if circuit is open
   */
  canRequest(): boolean {
    if (this.state === "CLOSED") {
      return true;
    }

    if (this.state === "OPEN") {
      // Check if timeout has elapsed
      if (this.openedAt && Date.now() - this.openedAt >= this.timeoutMs) {
        this.transitionTo("HALF_OPEN");
        return true;
      }
      return false;
    }

    // HALF_OPEN: Allow the probe request
    return true;
  }

  /**
   * Record a successful request.
   *
   * Resets failure count and closes circuit if in HALF_OPEN state.
   */
  recordSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.transitionTo("CLOSED");
    }
    this.failureCount = 0;
  }

  /**
   * Record a failed request.
   *
   * Increments failure count and opens circuit if threshold reached.
   * If in HALF_OPEN, immediately reopens circuit.
   */
  recordFailure(): void {
    this.failureCount++;

    if (this.state === "HALF_OPEN") {
      // Probe failed, reopen circuit
      this.transitionTo("OPEN");
      return;
    }

    if (this.state === "CLOSED" && this.failureCount >= this.threshold) {
      this.transitionTo("OPEN");
    }
  }

  /**
   * Get current circuit state.
   */
  getState(): CircuitState {
    // Check for automatic transition to HALF_OPEN
    if (
      this.state === "OPEN" &&
      this.openedAt &&
      Date.now() - this.openedAt >= this.timeoutMs
    ) {
      this.transitionTo("HALF_OPEN");
    }
    return this.state;
  }

  /**
   * Get seconds until circuit can be retried, or null if closed.
   *
   * @returns Seconds to wait, or null if circuit is closed/half-open
   */
  getRetryAfterSeconds(): number | null {
    if (this.state !== "OPEN" || !this.openedAt) {
      return null;
    }

    const elapsed = Date.now() - this.openedAt;
    const remaining = this.timeoutMs - elapsed;

    if (remaining <= 0) {
      return null;
    }

    return Math.ceil(remaining / 1000);
  }

  /**
   * Get the current failure count (for testing/debugging).
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Reset circuit breaker to initial state (for testing).
   */
  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.openedAt = null;
  }

  /**
   * Transition to a new state with logging.
   */
  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;

    if (newState === "OPEN") {
      this.openedAt = Date.now();
    } else if (newState === "CLOSED") {
      this.openedAt = null;
      this.failureCount = 0;
    }

    // Emit state change event for logging
    this.onStateChange?.({
      provider: this.provider,
      previousState,
      newState,
      failureCount: this.failureCount,
      openUntil:
        newState === "OPEN" && this.openedAt
          ? new Date(this.openedAt + this.timeoutMs).toISOString()
          : undefined,
    });
  }
}
