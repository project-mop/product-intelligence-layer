# Epic Technical Specification: Schema Validation & Output

Date: 2025-11-28
Author: Zac
Epic ID: 4
Status: Draft

---

## Overview

Epic 4 delivers the reliability infrastructure that transforms the Product Intelligence Layer from a prototype into an enterprise-grade API platform. Building on the LLM gateway and API generation capabilities from Epic 3, this epic implements comprehensive schema validation, standardized error handling, graceful degradation patterns, and response caching—the features that enable reliable integration with ERP systems, commerce platforms, and internal tools.

The core value proposition of "schema-constrained output" depends on this epic. Without robust input validation, output enforcement, and predictable error responses, customers cannot trust the API for production workloads. Epic 4 ensures every API response either matches the defined schema exactly or returns a clear, actionable error that integrations can handle programmatically.

**FRs Covered:** FR-501 through FR-513 (Schema & Validation), covering output schema enforcement, input validation, error response contracts, LLM unavailability handling, response caching, and configurable cache TTL.

## Objectives and Scope

### In Scope

- Input schema validation with field-level error feedback (Zod-based validation against process.inputSchema)
- Output schema enforcement with type validation and retry logic (max 1 retry with stricter prompt)
- Standardized error response contract with error_code, message, details, and retry_after
- HTTP status code alignment: 4xx for client errors, 5xx for server errors
- LLM unavailability handling with 503 response and circuit breaker pattern
- Response caching based on input hash with configurable TTL (PostgreSQL-based per ADR-001)
- Cache lookup before LLM call, cache storage after successful response
- Per-process cache TTL configuration (0 to 24 hours, default 15 minutes)
- Exponential backoff guidance in Retry-After headers for retryable errors
- Cache bypass via Cache-Control: no-cache header

### Out of Scope

- Redis-based caching (future upgrade path per ADR-001)
- Rate limiting enforcement (Epic 7A)
- Call logging to database (Epic 6—console logging only)
- Version pinning and deprecation warnings (Epic 5)
- Sandbox/Production environment separation (Epic 5)
- Advanced retry strategies (circuit breaker state persistence)
- Cache warming or pre-generation

## System Architecture Alignment

This epic implements key components of the "Intelligence Generation Flow" documented in the architecture, specifically the validation and caching stages:

| Architecture Component | Epic 4 Implementation |
|------------------------|----------------------|
| Schema Validator | `src/server/services/schema/` - Input and output validation |
| Cache Service | `src/server/services/cache/` - PostgreSQL-based caching |
| Error Handling | `src/lib/errors.ts` - Standardized error types and responses |
| Process Engine | Enhancement to `src/server/services/process/` for retry logic |

**Architecture Flow Integration:**
```
Customer Request → API Key Auth → Rate Limit Check → [INPUT VALIDATION]
    → [CACHE LOOKUP] → [HIT: Return Cached] / [MISS: Continue]
    → Prompt Assembly → LLM Gateway → [OUTPUT VALIDATION]
    → [Retry if invalid] → [CACHE STORE] → Log Entry → Response
```

Epic 4 implements the bracketed stages above, completing the validation and caching pipeline that Epic 3 stubbed.

**Key Architecture Decisions Applied:**
- ADR-001: PostgreSQL for caching (MVP cost efficiency, abstraction allows Redis upgrade)
- Error Handling Matrix from architecture: Maps error types to HTTP status codes
- Response format from architecture: `{ success, data/error, meta }` structure

## Detailed Design

### Services and Modules

| Module | Location | Responsibility |
|--------|----------|----------------|
| Input Validator | `src/server/services/schema/validate-input.ts` | Validate request input against process.inputSchema |
| Output Validator | `src/server/services/schema/validate-output.ts` | Validate LLM output against process.outputSchema with retry |
| Schema Utils | `src/server/services/schema/utils.ts` | Convert JSON Schema to Zod, type coercion helpers |
| Cache Service | `src/server/services/cache/service.ts` | Cache interface with get/set/invalidate operations |
| Cache Hash | `src/server/services/cache/hash.ts` | Deterministic input hash computation |
| Cache Cleanup Job | `src/server/jobs/cache-cleanup.ts` | pg-boss job to purge expired cache entries |
| Error Types | `src/lib/errors.ts` | ApiError class, error codes enum, error response builder |
| Error Middleware | `src/server/middleware/error-handler.ts` | Catch errors and format standard responses |
| Circuit Breaker | `src/server/services/llm/circuit-breaker.ts` | Track LLM failures, open circuit on threshold |

### Data Models and Contracts

**New Database Table: response_cache**

```prisma
// Addition to prisma/schema.prisma

model ResponseCache {
  id          String   @id @default(cuid())
  tenantId    String   @map("tenant_id")
  processId   String   @map("process_id")
  inputHash   String   @map("input_hash")
  response    Json     // Cached output data
  expiresAt   DateTime @map("expires_at")
  createdAt   DateTime @default(now()) @map("created_at")

  tenant  Tenant  @relation(fields: [tenantId], references: [id])
  process Process @relation(fields: [processId], references: [id])

  @@unique([tenantId, processId, inputHash])
  @@index([expiresAt])
  @@index([tenantId, processId])
  @@map("response_cache")
}
```

**Process Model Addition (cache TTL config):**

```typescript
// Addition to ProcessConfig type (already in process_versions.config JSON)
interface ProcessConfig {
  // ... existing fields from Epic 3 ...

  // Caching (Epic 4)
  cacheTtlSeconds: number;    // Default: 900 (15 min), Range: 0-86400
  cacheEnabled: boolean;      // Default: true
}
```

**Error Response Types:**

```typescript
// src/lib/errors.ts

export enum ErrorCode {
  // 4xx Client Errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  RATE_LIMITED = "RATE_LIMITED",

  // 5xx Server Errors
  OUTPUT_VALIDATION_FAILED = "OUTPUT_VALIDATION_FAILED",
  LLM_TIMEOUT = "LLM_TIMEOUT",
  LLM_ERROR = "LLM_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export interface ErrorDetails {
  field?: string;
  expected?: string;
  received?: string;
  issues?: Array<{
    path: string[];
    message: string;
  }>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetails;
    retry_after?: number; // seconds
  };
}

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number,
    public details?: ErrorDetails,
    public retryAfter?: number
  ) {
    super(message);
  }

  toResponse(): ApiErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
        ...(this.retryAfter && { retry_after: this.retryAfter }),
      },
    };
  }
}
```

**Cache Entry Type:**

```typescript
// src/server/services/cache/types.ts

export interface CacheEntry {
  data: Record<string, unknown>;
  meta: {
    version: string;
    cachedAt: string; // ISO timestamp
    inputHash: string;
  };
}

export interface CacheService {
  get(tenantId: string, processId: string, inputHash: string): Promise<CacheEntry | null>;
  set(tenantId: string, processId: string, inputHash: string, data: CacheEntry, ttlSeconds: number): Promise<void>;
  invalidate(tenantId: string, processId: string): Promise<void>;
}
```

### APIs and Interfaces

Epic 4 enhances the existing `/api/v1/intelligence/:processId/generate` endpoint from Epic 3. No new endpoints are added.

**Enhanced Generate Endpoint Behavior:**

```
POST /api/v1/intelligence/:processId/generate
Authorization: Bearer key_abc123
Content-Type: application/json
Cache-Control: no-cache  // Optional: bypass cache

Request Body:
{
  "input": {
    "productName": "Wireless Headphones",
    "category": "Electronics"
  }
}

Success Response (200) - Cache Miss:
{
  "success": true,
  "data": { ... },
  "meta": {
    "version": "1.0.0",
    "cached": false,
    "latency_ms": 1245,
    "request_id": "req_xyz789"
  }
}

Success Response (200) - Cache Hit:
{
  "success": true,
  "data": { ... },
  "meta": {
    "version": "1.0.0",
    "cached": true,
    "latency_ms": 12,
    "request_id": "req_abc456"
  }
}
Headers: X-Cache: HIT

Validation Error (400):
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed",
    "details": {
      "issues": [
        { "path": ["productName"], "message": "Required" },
        { "path": ["category"], "message": "Expected string, received number" }
      ]
    }
  }
}

LLM Unavailable (503):
{
  "success": false,
  "error": {
    "code": "LLM_ERROR",
    "message": "Intelligence service temporarily unavailable",
    "retry_after": 30
  }
}
Headers: Retry-After: 30

Output Validation Failed (500):
{
  "success": false,
  "error": {
    "code": "OUTPUT_VALIDATION_FAILED",
    "message": "Failed to generate valid response after retry",
    "details": {
      "issues": [
        { "path": ["shortDescription"], "message": "Expected string, received undefined" }
      ]
    }
  }
}
```

**Response Headers (all responses):**

| Header | Value | Condition |
|--------|-------|-----------|
| `X-Request-Id` | `req_*` | Always |
| `X-Cache` | `HIT` or `MISS` | Success responses |
| `Retry-After` | seconds | 429, 503 errors |
| `X-RateLimit-*` | (Epic 7A) | Future |

### Workflows and Sequencing

#### Enhanced Intelligence Generation Flow

```
1. Request arrives at /api/v1/intelligence/:processId/generate
2. Extract Bearer token, validate API key (Epic 1)
3. Load ProcessVersion by processId + tenant + environment

4. [NEW - INPUT VALIDATION]
   a. Parse request body as JSON
   b. Convert process.inputSchema (JSON Schema) to Zod schema
   c. Validate input against Zod schema
   d. On failure:
      - Collect ALL validation errors (not just first)
      - Return 400 with field-level error details
      - Log validation failure
   e. On success: Continue with validated input

5. [NEW - CACHE LOOKUP]
   a. Check if caching enabled for this process (config.cacheEnabled)
   b. Check Cache-Control header for "no-cache"
   c. If caching enabled and no bypass:
      - Compute input hash: SHA256(tenantId + processId + sortedJSON(input))
      - Query response_cache table by (tenantId, processId, inputHash)
      - Check expiresAt > now()
   d. On cache hit:
      - Return cached response with meta.cached=true
      - Add X-Cache: HIT header
      - Skip LLM call
   e. On cache miss: Continue to LLM

6. [NEW - CIRCUIT BREAKER CHECK]
   a. Check circuit breaker state for LLM provider
   b. If circuit OPEN:
      - Return 503 immediately with retry_after
      - Don't attempt LLM call
   c. If circuit CLOSED or HALF-OPEN: Continue

7. Assemble prompt from ProcessVersion.config (Epic 3)
8. Call LLM Gateway with timeout (default 30s)
   - On timeout: Record failure, return 503 LLM_TIMEOUT
   - On error: Record failure, return 503 LLM_ERROR
   - Update circuit breaker state

9. [NEW - OUTPUT VALIDATION]
   a. Attempt to parse LLM response as JSON
   b. Convert process.outputSchema to Zod schema
   c. Validate parsed JSON against Zod schema
   d. On parse failure OR validation failure (attempt 1):
      - Construct stricter retry prompt
      - Add: "PREVIOUS ATTEMPT FAILED. Your response MUST be valid JSON matching: {schema}"
      - Call LLM again (attempt 2)
   e. On second failure:
      - Return 500 OUTPUT_VALIDATION_FAILED with details
      - Log failure with both attempts
   f. On success: Continue with validated output

10. [NEW - CACHE STORE]
    a. If caching enabled:
       - Compute TTL from config.cacheTtlSeconds (default 900)
       - Store in response_cache with expiresAt
       - Use UPSERT to handle race conditions

11. Log call metadata (console for Epic 4, database in Epic 6)
12. Return response with meta (version, cached=false, latency, request_id)
```

#### Cache Cleanup Job (pg-boss)

```typescript
// src/server/jobs/cache-cleanup.ts
// Runs hourly via pg-boss scheduler

export async function cleanupExpiredCache(): Promise<{ deleted: number }> {
  const result = await db.responseCache.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  });

  console.log(`[cache-cleanup] Deleted ${result.count} expired entries`);
  return { deleted: result.count };
}
```

#### Circuit Breaker State Machine

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

**Circuit Breaker Config:**
- Failure threshold: 5 consecutive failures
- Open timeout: 30 seconds
- Half-open allows 1 probe request

## Non-Functional Requirements

### Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| Cache hit response time | < 50ms P95 | Database lookup + JSON serialization only |
| Cache miss response time | < 2s P95 | LLM latency dominates; PRD success metric |
| Input validation | < 10ms | Zod validation is CPU-bound, must be fast |
| Output validation | < 5ms | JSON parse + Zod validation |
| Cache hit rate | 30-50% | Depends on input diversity; reduces LLM costs |
| Cache cleanup job | < 30s | Hourly cleanup should not impact performance |

**Cache Performance Notes:**
- PostgreSQL-based cache is adequate for MVP scale (< 100K requests/day)
- Index on `(tenant_id, process_id, input_hash)` ensures O(log n) lookups
- Index on `expires_at` enables efficient cleanup batch deletes
- Consider Redis upgrade if cache queries exceed 20ms P95 at scale

### Security

| Requirement | Implementation | FR Reference |
|-------------|----------------|--------------|
| Input sanitization | Zod validation rejects unexpected fields | FR-503 |
| No SQL injection | Prisma parameterized queries | Standard |
| Cache isolation | Cache keyed by tenantId, queries filter by tenant | FR-801, FR-806 |
| No sensitive data in errors | Error details show field paths, not values | Standard |
| Cache poisoning prevention | Cache key includes tenantId, processId | Security |

**Security Notes:**
- Input validation prevents malformed data from reaching LLM (cost protection)
- Error responses never leak internal implementation details
- Cache entries are tenant-scoped; cross-tenant cache access is impossible

### Reliability/Availability

| Requirement | Implementation | FR Reference |
|-------------|----------------|--------------|
| LLM unavailability handling | 503 with retry_after header | FR-510 |
| Circuit breaker | Fail fast after 5 consecutive failures | FR-510 |
| Retry on output failure | One automatic retry with stricter prompt | FR-501, FR-502 |
| Graceful degradation | Cache serves requests even if LLM is down | FR-512 |
| No partial responses | Either full valid response or clear error | FR-501 |
| Cache write failures | Silent failure, response still returned | Resilience |

**Circuit Breaker Behavior:**
- CLOSED: Normal operation, all requests go to LLM
- OPEN: After 5 consecutive failures, return 503 immediately for 30s
- HALF-OPEN: After timeout, allow 1 probe request to test recovery
- Prevents cascading failures during LLM provider outages

### Observability

| Signal | Implementation | Purpose |
|--------|----------------|---------|
| Validation failures | Log with request_id, tenant_id, error details | Debug input issues |
| Cache hits/misses | Log with request_id, input_hash | Monitor cache effectiveness |
| LLM retries | Log both attempts with prompts (redacted) | Debug output quality |
| Circuit breaker state changes | Log state transitions | Monitor LLM health |
| Cache cleanup stats | Log deleted count per run | Monitor cache growth |

**Structured Log Examples:**

```json
// Input validation failure
{
  "level": "warn",
  "message": "Input validation failed",
  "request_id": "req_abc123",
  "tenant_id": "ten_xyz789",
  "process_id": "proc_def456",
  "error_code": "VALIDATION_ERROR",
  "validation_errors": [
    { "path": ["productName"], "message": "Required" }
  ]
}

// Cache hit
{
  "level": "info",
  "message": "Cache hit",
  "request_id": "req_abc123",
  "tenant_id": "ten_xyz789",
  "process_id": "proc_def456",
  "input_hash": "sha256:abc...",
  "cache_age_seconds": 245
}

// Circuit breaker opened
{
  "level": "error",
  "message": "Circuit breaker opened",
  "provider": "anthropic",
  "failure_count": 5,
  "open_until": "2025-11-28T10:30:00Z"
}
```

## Dependencies and Integrations

### NPM Dependencies

All required dependencies are already installed from previous epics:

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `zod` | ^3.24.2 | Schema validation (input and output) | ✅ Installed |
| `ajv` | ^8.17.1 | JSON Schema validation (alternative/conversion) | ✅ Installed |
| `@prisma/client` | ^7.0.1 | Database access for cache table | ✅ Installed |
| `@anthropic-ai/sdk` | ^0.71.0 | LLM Gateway (from Epic 3) | ✅ Installed |

**No new dependencies required for Epic 4.**

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CACHE_DEFAULT_TTL_SECONDS` | Default cache TTL | 900 | No |
| `CIRCUIT_BREAKER_THRESHOLD` | Failures before open | 5 | No |
| `CIRCUIT_BREAKER_TIMEOUT_MS` | Open state duration | 30000 | No |
| `LLM_TIMEOUT_MS` | LLM call timeout | 30000 | No (from Epic 3) |

### Internal Dependencies

| Dependency | From Epic | Required For |
|------------|-----------|--------------|
| Process model | Epic 2 | Loading inputSchema, outputSchema |
| ProcessVersion model | Epic 2 | Loading config with cacheTtlSeconds |
| API Key validation | Epic 1 | Bearer token authentication |
| LLM Gateway | Epic 3 | Intelligence generation |
| ID generator | Epic 1 | Request ID generation |
| Tenant context | Epic 1 | Cache isolation |

### Database Changes

**New Table:** `response_cache`
- Must be added to `prisma/schema.prisma`
- Run `pnpm prisma db push` after schema update

**New Indexes:**
- `response_cache(tenant_id, process_id, input_hash)` - Unique constraint for lookups
- `response_cache(expires_at)` - For efficient cleanup queries

### pg-boss Integration

Epic 4 introduces the first pg-boss scheduled job:

```typescript
// Job registration in src/server/jobs/index.ts
import PgBoss from 'pg-boss';

const boss = new PgBoss(process.env.DATABASE_URL);

await boss.start();
await boss.schedule('cache-cleanup', '0 * * * *'); // Every hour

boss.work('cache-cleanup', async () => {
  const { deleted } = await cleanupExpiredCache();
  return { deleted };
});
```

**Note:** pg-boss tables will be auto-created on first run. No manual migration needed.

## Acceptance Criteria (Authoritative)

### Story 4.1: Input Schema Validation

1. All incoming API requests to `/api/v1/intelligence/:processId/generate` are validated against the process's `inputSchema`
2. Validation uses Zod schemas converted from JSON Schema definitions
3. Invalid requests return 400 status code before any LLM processing occurs
4. Error response includes `code: "VALIDATION_ERROR"` and field-level details
5. Field-level errors include `path` (array of field names) and `message` (human-readable)
6. All validation errors are collected and returned (not just the first error)
7. Valid requests proceed to processing with the validated input object
8. Unknown/extra fields are stripped from input (strict mode)
9. Type coercion is attempted for minor mismatches (string "123" → number 123)
10. Validation completes in < 10ms for typical payloads

### Story 4.2: Output Schema Enforcement

1. LLM responses are validated against the process's `outputSchema` before returning to caller
2. Validation uses Zod schemas converted from JSON Schema definitions
3. JSON parse failures trigger one automatic retry with stricter prompt
4. Schema validation failures trigger one automatic retry with stricter prompt
5. Retry prompt includes: "PREVIOUS ATTEMPT FAILED VALIDATION. Your response MUST be valid JSON matching: {schema description}"
6. After second failure, return 500 with `code: "OUTPUT_VALIDATION_FAILED"`
7. Error response includes field-level details showing which fields failed validation
8. Successful validation returns the parsed, typed output object
9. Type coercion is attempted for minor mismatches (e.g., string numbers → numbers)
10. Both LLM attempts are logged for debugging (prompt and raw response, redacted for PII)

### Story 4.3: Error Response Contract

1. All error responses follow the standard format: `{ success: false, error: { code, message, details?, retry_after? } }`
2. HTTP 400 returned for client errors: VALIDATION_ERROR (input invalid)
3. HTTP 401 returned for: UNAUTHORIZED (invalid/missing API key)
4. HTTP 403 returned for: FORBIDDEN (key lacks scope for this process)
5. HTTP 404 returned for: NOT_FOUND (process doesn't exist or not published)
6. HTTP 429 returned for: RATE_LIMITED (quota exceeded) - with `retry_after`
7. HTTP 500 returned for: OUTPUT_VALIDATION_FAILED (LLM output didn't match schema after retry)
8. HTTP 503 returned for: LLM_TIMEOUT, LLM_ERROR (provider unavailable) - with `retry_after`
9. All 429 and 503 responses include `Retry-After` HTTP header (seconds)
10. Error messages are user-friendly; no stack traces or internal details exposed

### Story 4.4: LLM Unavailability Handling

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

### Story 4.5: Response Caching

1. Successful responses are cached in `response_cache` table
2. Cache key is deterministic hash: SHA256(tenantId + processId + sortedJSON(input))
3. Cache lookup occurs before LLM call (after input validation)
4. Cache hit returns immediately with `meta.cached: true` and `X-Cache: HIT` header
5. Cache miss proceeds to LLM, then stores result with TTL
6. Cache entries include: response data, version, cachedAt timestamp, inputHash
7. Cache is tenant-isolated (queries always filter by tenantId)
8. `Cache-Control: no-cache` header bypasses cache lookup (forces fresh LLM call)
9. Cache write failures are silent (response still returned to caller)
10. Identical requests within TTL window return cached response (FR-512)

### Story 4.6: Configurable Cache TTL

1. Each process has configurable `cacheTtlSeconds` in ProcessVersion.config
2. Default TTL is 900 seconds (15 minutes) per FR-513
3. TTL range is 0 to 86400 seconds (0 = disabled, max = 24 hours)
4. Setting TTL to 0 disables caching for that process
5. TTL is validated on process save (reject values outside range)
6. Cache TTL is displayed in process settings UI
7. Changing TTL does not invalidate existing cache entries (they expire naturally)
8. pg-boss job runs hourly to delete expired cache entries
9. Cache cleanup job logs number of entries deleted per run
10. Process update/delete invalidates all cache entries for that process

---

## Traceability Mapping

| AC | FR | Spec Section | Component(s) | Test Approach |
|----|-----|--------------|--------------|---------------|
| 4.1.1-10 | FR-503, FR-504, FR-505 | Input Validation | validate-input.ts | Unit + integration |
| 4.2.1-10 | FR-501, FR-502 | Output Validation | validate-output.ts | Unit + integration (mocked LLM) |
| 4.3.1-10 | FR-506, FR-507, FR-508, FR-509 | Error Contract | errors.ts, error-handler.ts | Unit + integration |
| 4.4.1-10 | FR-510 | LLM Unavailability | circuit-breaker.ts, gateway.ts | Unit + integration (mocked) |
| 4.5.1-10 | FR-511, FR-512 | Response Caching | cache/service.ts, cache/hash.ts | Unit + integration |
| 4.6.1-10 | FR-513 | Configurable TTL | ProcessConfig, cache-cleanup.ts | Unit + integration |

---

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| JSON Schema to Zod conversion edge cases | Medium | Medium | Use well-tested library (zod-to-json-schema inverse); comprehensive test suite |
| Cache table grows large | Low | Medium | Hourly cleanup job; index on expires_at; monitor table size |
| Circuit breaker false positives | Medium | Low | Conservative threshold (5 failures); short open timeout (30s); logging for tuning |
| LLM output inconsistency causes frequent retries | Medium | Medium | Clear prompt engineering; monitor retry rate; adjust prompts per process |
| PostgreSQL cache performance at scale | Medium | Low | Adequate for MVP; indexes in place; Redis upgrade path documented |

### Assumptions

1. JSON Schema definitions from Epic 2 are valid and well-formed
2. Zod can represent all JSON Schema constructs used in process definitions
3. 15-minute default TTL is acceptable for most product intelligence use cases
4. LLM retry with stricter prompt improves success rate (validated in Epic 3 testing)
5. Hourly cache cleanup is sufficient (no real-time expiration needed)
6. Circuit breaker state can be stored in-memory (single instance MVP)

### Open Questions

1. **Q:** Should circuit breaker state persist across server restarts?
   **Recommendation:** No for MVP. In-memory is simpler. At scale, use Redis for shared state.

2. **Q:** Should we support per-process circuit breakers or global only?
   **Recommendation:** Global per provider for MVP. Per-process adds complexity without clear benefit.

3. **Q:** What happens to in-flight requests when circuit opens?
   **Recommendation:** Let them complete. Only new requests fail fast.

4. **Q:** Should cache invalidation be exposed via API?
   **Recommendation:** Not for MVP. Process update triggers invalidation automatically.

---

## Test Strategy Summary

### Test Levels

| Level | Framework | Coverage Focus |
|-------|-----------|----------------|
| Unit | Vitest | Schema conversion, hash computation, error formatting, circuit breaker logic |
| Integration | Vitest + Prisma | Cache service CRUD, validation pipeline, error middleware |
| E2E | Playwright | Full request flow with validation errors, cache hits |

### Key Test Scenarios

**Input Validation (Story 4.1):**
- Valid input passes validation
- Missing required field returns 400 with field path
- Wrong type returns 400 with expected/received
- Multiple errors collected and returned
- Extra fields stripped silently
- Type coercion works (string → number)

**Output Validation (Story 4.2):**
- Valid LLM output passes validation
- Invalid JSON triggers retry
- Invalid schema triggers retry
- Second failure returns 500
- Retry prompt is stricter

**Error Responses (Story 4.3):**
- Each error code maps to correct HTTP status
- Error format matches contract
- Retry-After header present on 429/503
- No sensitive data in error details

**Circuit Breaker (Story 4.4):**
- Closes after threshold failures
- Opens after timeout
- Half-open allows probe
- Successful probe closes circuit
- Failed probe re-opens

**Caching (Stories 4.5, 4.6):**
- Cache miss → store → cache hit
- Cache-Control: no-cache bypasses
- TTL=0 disables caching
- Expired entries not returned
- Cleanup job deletes expired
- Process update invalidates cache

### Mocking Strategy

- **LLM Gateway:** Mock `@anthropic-ai/sdk` for all tests
- **Database:** Use test database with Prisma for integration tests
- **Time:** Mock `Date.now()` for TTL/expiration tests
- **Circuit Breaker:** Inject clock for timeout testing

### Test Data

```typescript
// tests/fixtures/validation.ts
export const validInput = {
  productName: "Test Product",
  category: "Electronics",
  attributes: { color: "black" }
};

export const invalidInput = {
  // missing productName
  category: 123, // wrong type
};

export const validOutput = {
  shortDescription: "A test product",
  bulletPoints: ["Feature 1", "Feature 2"]
};

export const invalidOutput = {
  shortDescription: 123, // wrong type
  // missing bulletPoints
};
```
