# Story 4.4: LLM Unavailability Handling

Status: done

## Story

As a **system**,
I want **to gracefully handle LLM provider unavailability with circuit breaker protection**,
So that **consumers receive clear errors, can retry appropriately, and the system degrades gracefully during outages**.

## Acceptance Criteria

1. LLM calls have configurable timeout (default 30 seconds, via `LLM_TIMEOUT_MS`)
2. Timeout returns 503 with `code: "LLM_TIMEOUT"` and `retry_after: 30`
3. Anthropic API errors return 503 with `code: "LLM_ERROR"` and appropriate `retry_after`
4. Circuit breaker tracks consecutive LLM failures per provider
5. After 5 consecutive failures, circuit opens for 30 seconds
6. While circuit is open, requests fail fast with 503 (no LLM call attempted)
7. After timeout, circuit enters half-open state allowing 1 probe request
8. Successful probe closes circuit; failed probe re-opens it
9. Circuit breaker state changes are logged for monitoring
10. `Retry-After` header reflects circuit breaker state when applicable

## Tasks / Subtasks

- [x] **Task 1: Create Circuit Breaker Service** (AC: 4, 5, 7, 8)
  - [ ] Create `src/server/services/llm/circuit-breaker.ts`
  - [ ] Implement `CircuitBreaker` class with states: CLOSED, OPEN, HALF_OPEN
  - [ ] Track consecutive failures per provider
  - [ ] Configuration:
    - `CIRCUIT_BREAKER_THRESHOLD` (default: 5 failures)
    - `CIRCUIT_BREAKER_TIMEOUT_MS` (default: 30000ms = 30s)
  - [ ] Methods:
    - `canRequest(): boolean` - Returns true if circuit allows request
    - `recordSuccess(): void` - Reset failure count, close circuit
    - `recordFailure(): void` - Increment failure count, open circuit if threshold met
    - `getState(): CircuitState` - Returns current state
    - `getRetryAfterSeconds(): number | null` - Returns wait time if circuit open
  - [ ] Half-open logic: After timeout, allow 1 probe request

- [x] **Task 2: Add Circuit Breaker State Logging** (AC: 9)
  - [ ] Log circuit state transitions with structured logging:
    ```typescript
    {
      level: "warn" | "info",
      message: "Circuit breaker state changed",
      provider: "anthropic",
      previousState: "CLOSED" | "OPEN" | "HALF_OPEN",
      newState: "CLOSED" | "OPEN" | "HALF_OPEN",
      failureCount: number,
      openUntil?: string // ISO timestamp when OPEN
    }
    ```
  - [ ] Log when circuit OPENS (warn level)
  - [ ] Log when circuit CLOSES (info level)
  - [ ] Log when circuit enters HALF_OPEN (info level)
  - [ ] Include failure count in all state change logs

- [x] **Task 3: Integrate Circuit Breaker with LLM Gateway** (AC: 1, 4, 6)
  - [ ] Update `src/server/services/llm/anthropic.ts`:
    - Accept optional CircuitBreaker instance in config
    - Check `circuitBreaker.canRequest()` before making API call
    - Call `recordSuccess()` on successful response
    - Call `recordFailure()` on LLMError
  - [ ] If circuit is open, immediately throw LLMError with LLM_ERROR code
  - [ ] Ensure timeout is configurable via `LLM_TIMEOUT_MS` env var (already exists)

- [x] **Task 4: Update LLM Error Response Format** (AC: 2, 3, 10)
  - [ ] Verify `src/server/middleware/error-handler.ts` handles LLMError correctly:
    - LLM_TIMEOUT → 503 with retry_after
    - LLM_ERROR → 503 with retry_after
    - LLM_RATE_LIMITED → 429 with retry_after
  - [ ] Update LLMError to include circuitBreaker state info when applicable
  - [ ] Ensure retry_after value comes from:
    - Circuit breaker (if open): Remaining open time
    - Default: 30 seconds (DEFAULT_RETRY_AFTER)
  - [ ] Test that Retry-After header is set for all 503 responses

- [x] **Task 5: Create Circuit Breaker Provider Registry** (AC: 4)
  - [ ] Create `src/server/services/llm/index.ts` export structure:
    - Export singleton circuit breaker for Anthropic
    - Export factory function `createLLMGateway()` with circuit breaker integration
  - [ ] Circuit breaker should be shared across all gateway instances for same provider
  - [ ] Support future multi-provider scenario (one circuit per provider)

- [x] **Task 6: Write Unit Tests for Circuit Breaker** (AC: 4-10)
  - [ ] Create `tests/unit/server/services/llm/circuit-breaker.test.ts`
  - [ ] Test CLOSED state allows all requests
  - [ ] Test failure count increments correctly
  - [ ] Test circuit OPENS after threshold failures
  - [ ] Test OPEN state rejects all requests immediately
  - [ ] Test circuit enters HALF_OPEN after timeout
  - [ ] Test successful probe in HALF_OPEN closes circuit
  - [ ] Test failed probe in HALF_OPEN re-opens circuit
  - [ ] Test `getRetryAfterSeconds()` returns correct values
  - [ ] Test state change logging is called correctly
  - [ ] Mock time/clock for deterministic timeout testing

- [x] **Task 7: Write Unit Tests for Gateway Integration** (AC: 1, 2, 3, 6)
  - [ ] Update `tests/unit/server/services/llm/anthropic.test.ts`
  - [ ] Test gateway uses circuit breaker when provided
  - [ ] Test gateway throws immediately when circuit is open
  - [ ] Test gateway records success on successful response
  - [ ] Test gateway records failure on LLMError
  - [ ] Test timeout error includes retry_after
  - [ ] Test API error includes retry_after
  - [ ] Mock Anthropic SDK for deterministic testing

- [x] **Task 8: Write Integration Tests** (AC: 1-10)
  - [ ] Update `tests/integration/intelligence-api.test.ts`
  - [ ] Add "Story 4.4: LLM Unavailability Handling" describe block
  - [ ] Test 503 LLM_TIMEOUT response format (mock timeout)
  - [ ] Test 503 LLM_ERROR response format (mock API error)
  - [ ] Test Retry-After header is present on 503 responses
  - [ ] Test retry_after field is in response body
  - [ ] Test multiple failures trigger circuit breaker (if feasible with mocks)
  - [ ] Test circuit breaker returns 503 immediately when open

- [x] **Task 9: Verification** (AC: 1-10)
  - [ ] Run `pnpm typecheck` - zero errors
  - [ ] Run `pnpm lint` - zero new errors
  - [ ] Run `pnpm test:unit` - all tests pass
  - [ ] Run `pnpm test:integration` - all tests pass
  - [ ] Run `pnpm build` - production build succeeds

## Dev Notes

**BEFORE WRITING TESTS:** Review testing strategy at `/docs/testing-strategy-mvp.md`
- Unit tests for circuit breaker state machine logic
- Unit tests for gateway integration
- Integration tests for API endpoint error responses
- 50% coverage minimum for MVP

### Technical Context

This story implements the circuit breaker pattern for LLM availability, ensuring the system fails fast during provider outages rather than queueing up slow-failing requests. The LLM gateway from Story 3.2 already handles timeout and error mapping to LLMError codes; this story adds circuit breaker protection on top.

**Key Architecture Decisions:**
- In-memory circuit breaker state (sufficient for MVP single-instance deployment)
- Per-provider circuit breakers (supports future multi-provider scenario)
- Conservative threshold (5 failures) to avoid premature circuit opening
- 30-second open timeout aligns with Anthropic's typical rate limit recovery

### Circuit Breaker State Machine

```
                  ┌─────────────┐
                  │   CLOSED    │ ◄── Normal operation
                  │             │
                  └──────┬──────┘
                         │ failure_count >= threshold (5)
                         ▼
                  ┌─────────────┐
                  │    OPEN     │ ◄── All requests fail fast
                  │             │
                  └──────┬──────┘
                         │ after timeout (30s)
                         ▼
                  ┌─────────────┐
         success  │  HALF-OPEN  │ failure
        ┌─────────│             │─────────┐
        │         └─────────────┘         │
        ▼                                 ▼
    CLOSED                              OPEN
```

### Current LLM Gateway State (After Story 3.2)

From `src/server/services/llm/anthropic.ts`:
- `AnthropicGateway` class implements `LLMGateway` interface
- Configurable timeout via `LLM_TIMEOUT_MS` env var (default 30s)
- Error mapping to `LLMError` with codes: `LLM_TIMEOUT`, `LLM_ERROR`, `LLM_RATE_LIMITED`
- Duration tracking for metrics

From `src/server/services/llm/types.ts`:
- `LLMError` class with `code`, `message`, `cause`
- `LLMErrorCode` type: `"LLM_TIMEOUT" | "LLM_ERROR" | "LLM_RATE_LIMITED"`

### Error Handler Integration (Story 4.3)

From `src/server/middleware/error-handler.ts`:
- `handleApiError()` already handles `LLMError` → 503 with retry_after
- `formatErrorResponse()` maps LLMError codes to ErrorCode enum
- `DEFAULT_RETRY_AFTER = 30` seconds for retryable errors
- Retry-After header automatically set for 429/503 responses

**What Story 4.4 Adds:**
- Circuit breaker to fail fast during prolonged outages
- Dynamic retry_after based on circuit breaker state
- Structured logging of circuit state transitions

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `LLM_TIMEOUT_MS` | LLM call timeout | 30000 | No |
| `CIRCUIT_BREAKER_THRESHOLD` | Failures before open | 5 | No |
| `CIRCUIT_BREAKER_TIMEOUT_MS` | Open state duration | 30000 | No |

### Example Error Responses

**503 LLM_TIMEOUT:**
```json
{
  "success": false,
  "error": {
    "code": "LLM_TIMEOUT",
    "message": "Intelligence service timed out. Please retry.",
    "retry_after": 30
  }
}
```
Headers: `Retry-After: 30`

**503 LLM_ERROR (API Error):**
```json
{
  "success": false,
  "error": {
    "code": "LLM_ERROR",
    "message": "Intelligence service temporarily unavailable. Please retry.",
    "retry_after": 30
  }
}
```
Headers: `Retry-After: 30`

**503 LLM_ERROR (Circuit Open):**
```json
{
  "success": false,
  "error": {
    "code": "LLM_ERROR",
    "message": "Intelligence service temporarily unavailable. Please retry.",
    "retry_after": 25
  }
}
```
Headers: `Retry-After: 25` (reflects remaining circuit open time)

### Learnings from Previous Stories

**From Story 4.3: Error Response Contract (Status: done)**
- `handleApiError()` in `src/server/middleware/error-handler.ts` handles LLMError correctly
- `DEFAULT_RETRY_AFTER = 30` seconds is already set
- `Retry-After` header is automatically added for retryable errors
- Error message sanitization prevents leaking internal details

**Services to Extend:**
- `src/server/services/llm/anthropic.ts` - Add circuit breaker integration
- `src/server/services/llm/index.ts` - Add circuit breaker singleton/registry

**Services to Create:**
- `src/server/services/llm/circuit-breaker.ts` - Circuit breaker implementation

[Source: docs/stories/4-3-error-response-contract.md#Dev-Agent-Record]

### Project Structure Notes

Files to modify/create:

```
src/server/services/llm/circuit-breaker.ts         # CREATE - Circuit breaker class
src/server/services/llm/anthropic.ts               # MODIFY - Add circuit breaker
src/server/services/llm/index.ts                   # MODIFY - Export circuit breaker
tests/unit/server/services/llm/circuit-breaker.test.ts  # CREATE - Circuit breaker tests
tests/unit/server/services/llm/anthropic.test.ts   # MODIFY - Gateway integration tests
tests/integration/intelligence-api.test.ts         # MODIFY - Add Story 4.4 tests
```

### Dependencies

**NPM packages (already installed):**
- No new packages required

**Internal dependencies:**
- `LLMGateway` interface from Epic 3 (`src/server/services/llm/types.ts`)
- `LLMError` class from Epic 3 (`src/server/services/llm/types.ts`)
- `AnthropicGateway` from Epic 3 (`src/server/services/llm/anthropic.ts`)
- `handleApiError()` from Story 4.3 (`src/server/middleware/error-handler.ts`)

### Testing Strategy

**Mock Strategy:**
- Mock `Date.now()` for deterministic timeout testing
- Use Vitest's fake timers for circuit breaker timeout scenarios
- Mock Anthropic SDK to simulate timeout/error scenarios
- Test circuit breaker state transitions in isolation

**Test Data:**
```typescript
// tests/fixtures/circuit-breaker.ts
export const mockLLMTimeout = new LLMError(
  "LLM_TIMEOUT",
  "LLM request timed out after 30000ms"
);

export const mockLLMError = new LLMError(
  "LLM_ERROR",
  "Anthropic API server error: Internal Server Error"
);
```

### References

- [Source: docs/tech-spec-epic-4.md#Story-4.4-LLM-Unavailability-Handling] - Acceptance criteria
- [Source: docs/tech-spec-epic-4.md#Circuit-Breaker-State-Machine] - State machine diagram
- [Source: docs/architecture.md#Error-Handling-Matrix] - Error codes and HTTP status mapping
- [Source: docs/epics.md#Story-4.4-LLM-Unavailability-Handling] - Epic story definition
- [Source: docs/testing-strategy-mvp.md] - Testing patterns
- [Source: docs/stories/4-3-error-response-contract.md#Dev-Agent-Record] - Previous story learnings

## Dev Agent Record

### Context Reference

- [docs/stories/4-4-llm-unavailability-handling.context.xml](./4-4-llm-unavailability-handling.context.xml)

### Implementation Summary

**Files Created:**
- `src/server/services/llm/circuit-breaker.ts` - Circuit breaker implementation with CLOSED/OPEN/HALF_OPEN states
- `tests/unit/server/services/llm/circuit-breaker.test.ts` - Unit tests for circuit breaker state machine

**Files Modified:**
- `src/server/services/llm/anthropic.ts` - Integrated circuit breaker with AnthropicGateway
- `src/server/services/llm/index.ts` - Added circuit breaker singleton registry and factory function
- `src/server/services/llm/types.ts` - Added CircuitBreaker interface and retryAfter to LLMError
- `src/server/middleware/error-handler.ts` - Updated to use dynamic retry_after from LLMError
- `tests/unit/llm-gateway.test.ts` - Added circuit breaker integration tests
- `tests/integration/intelligence-api.test.ts` - Added Story 4.4 integration tests

**Key Implementation Details:**
- Circuit breaker tracks consecutive failures per provider (threshold: 5)
- Open state duration: 30 seconds (configurable via CIRCUIT_BREAKER_TIMEOUT_MS)
- Half-open state allows one probe request to test recovery
- LLMError now carries `retryAfter` property for dynamic Retry-After header
- Singleton pattern ensures one circuit breaker per provider across gateway instances
- State transitions are logged at warn (OPEN) and info (CLOSED, HALF_OPEN) levels

**Verification:**
- All unit tests pass
- All integration tests pass
- TypeCheck passes
- Lint passes
- Build succeeds

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-28 | SM Agent | Initial story creation from Epic 4 tech spec |
| 2025-11-28 | SM Agent | Generated story context, marked ready-for-dev |
| 2025-11-28 | Dev Agent | Implementation complete, all AC satisfied |
