# Story 4.5: Response Caching

Status: done

## Story

As a **system**,
I want **to cache successful intelligence responses based on deterministic input hash**,
So that **identical requests return instantly, reducing LLM costs and improving response times for repeated queries**.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] **Task 1: Create ResponseCache Prisma Model** (AC: 1, 6, 7)
  - [ ] Add `ResponseCache` model to `prisma/schema.prisma`:
    ```prisma
    model ResponseCache {
      id          String   @id @default(cuid())
      tenantId    String   @map("tenant_id")
      processId   String   @map("process_id")
      inputHash   String   @map("input_hash")
      response    Json     // Cached output data
      version     String   // Process version at cache time
      cachedAt    DateTime @default(now()) @map("cached_at")
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
  - [ ] Add relation fields to `Tenant` and `Process` models
  - [ ] Run `pnpm prisma db push` to apply schema changes

- [ ] **Task 2: Create Cache Hash Utility** (AC: 2)
  - [ ] Create `src/server/services/cache/hash.ts`
  - [ ] Implement `computeInputHash(tenantId, processId, input)`:
    ```typescript
    import { createHash } from "crypto";

    export function computeInputHash(
      tenantId: string,
      processId: string,
      input: Record<string, unknown>
    ): string {
      const normalized = JSON.stringify(input, Object.keys(input).sort());
      const payload = `${tenantId}:${processId}:${normalized}`;
      return createHash("sha256").update(payload).digest("hex").slice(0, 32);
    }
    ```
  - [ ] Ensure deterministic output for identical inputs (sorted keys)
  - [ ] Truncate to 32 chars for storage efficiency

- [ ] **Task 3: Create Cache Service Interface and Implementation** (AC: 1, 3, 4, 5, 6, 7, 9)
  - [ ] Create `src/server/services/cache/types.ts`:
    ```typescript
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
      set(tenantId: string, processId: string, inputHash: string, entry: CacheEntry, ttlSeconds: number): Promise<void>;
      invalidate(tenantId: string, processId: string): Promise<void>;
    }
    ```
  - [ ] Create `src/server/services/cache/service.ts`:
    - Implement `PostgresCacheService` class
    - `get()`: Query by (tenantId, processId, inputHash) where expiresAt > now()
    - `set()`: Upsert cache entry with expiresAt = now + ttlSeconds
    - `invalidate()`: Delete all entries for (tenantId, processId)
  - [ ] Handle cache write failures silently (try-catch, log, continue)
  - [ ] Create `src/server/services/cache/index.ts` to export service

- [ ] **Task 4: Integrate Cache Lookup in Intelligence API** (AC: 3, 4, 8)
  - [ ] Update `src/app/api/v1/intelligence/[processId]/generate/route.ts`:
    - After input validation, check if caching is enabled (processVersion.config.cacheEnabled)
    - Check for `Cache-Control: no-cache` header
    - If caching enabled and no bypass:
      - Compute input hash
      - Call `cacheService.get()`
    - On cache hit:
      - Return cached response with `meta.cached: true`
      - Add `X-Cache: HIT` response header
      - Skip LLM call
    - On cache miss: Continue to LLM generation

- [ ] **Task 5: Integrate Cache Storage After LLM Response** (AC: 5, 6, 9)
  - [ ] After successful output validation:
    - Check if caching is enabled for this process
    - Compute cache entry with response data, version, cachedAt
    - Call `cacheService.set()` with TTL from processVersion.config.cacheTtlSeconds
  - [ ] Cache write failures should not affect response to caller (silent failure)
  - [ ] Add `X-Cache: MISS` header for cache miss responses

- [ ] **Task 6: Add ProcessConfig Cache Fields** (AC: 5)
  - [ ] Verify ProcessConfig type includes cache fields (from Story 4.6 prep):
    ```typescript
    interface ProcessConfig {
      // ... existing fields
      cacheTtlSeconds: number;    // Default: 900 (15 min)
      cacheEnabled: boolean;      // Default: true
    }
    ```
  - [ ] Set default values in process creation logic
  - [ ] Note: Full TTL configuration UI is Story 4.6

- [ ] **Task 7: Write Unit Tests for Cache Hash** (AC: 2, 10)
  - [ ] Create `tests/unit/server/services/cache/hash.test.ts`
  - [ ] Test deterministic output for same inputs
  - [ ] Test different output for different inputs
  - [ ] Test key ordering doesn't affect hash
  - [ ] Test with nested objects
  - [ ] Test with arrays
  - [ ] Test with special characters

- [ ] **Task 8: Write Unit Tests for Cache Service** (AC: 1, 6, 7, 9)
  - [ ] Create `tests/unit/server/services/cache/service.test.ts`
  - [ ] Mock Prisma client
  - [ ] Test `get()` returns null for missing entry
  - [ ] Test `get()` returns entry when found and not expired
  - [ ] Test `get()` returns null for expired entry
  - [ ] Test `set()` creates new entry
  - [ ] Test `set()` updates existing entry (upsert)
  - [ ] Test `invalidate()` deletes entries for process
  - [ ] Test tenant isolation in queries
  - [ ] Test silent failure handling for write errors

- [ ] **Task 9: Write Integration Tests for Caching** (AC: 1-10)
  - [ ] Update `tests/integration/intelligence-api.test.ts`
  - [ ] Add "Story 4.5: Response Caching" describe block
  - [ ] Test cache miss → LLM call → cache store
  - [ ] Test cache hit returns immediately (X-Cache: HIT header)
  - [ ] Test `meta.cached` is true for cache hit, false for miss
  - [ ] Test `Cache-Control: no-cache` bypasses cache
  - [ ] Test cache is tenant-isolated (tenant A can't hit tenant B's cache)
  - [ ] Test identical requests within TTL return same response
  - [ ] Test different inputs produce different cache keys
  - [ ] Test cache write failure doesn't break response

- [ ] **Task 10: Verification** (AC: 1-10)
  - [ ] Run `pnpm typecheck` - zero errors
  - [ ] Run `pnpm lint` - zero new errors
  - [ ] Run `pnpm test:unit` - all tests pass
  - [ ] Run `pnpm test:integration` - all tests pass (Story 4.5 tests)
  - [ ] Run `pnpm build` - production build succeeds

## Dev Notes

**BEFORE WRITING TESTS:** Review testing strategy at `/docs/testing-strategy-mvp.md`
- Unit tests for hash computation and cache service logic
- Integration tests for full caching flow with real database
- 50% coverage minimum for MVP

### Technical Context

This story implements PostgreSQL-based response caching per ADR-001 (PostgreSQL for caching in MVP). The cache enables identical intelligence requests to return instantly without LLM calls, reducing costs and improving response times. The abstraction layer (CacheService interface) allows future upgrade to Redis if needed at scale.

**Key Architecture Decisions:**
- PostgreSQL-based cache per ADR-001 (adequate for MVP scale)
- SHA256 hash truncated to 32 chars for storage efficiency
- Deterministic key ordering via `Object.keys().sort()` for consistent hashing
- Upsert pattern handles race conditions between concurrent requests
- Silent write failures ensure response reliability

### Cache Flow

```
1. Request arrives with input
2. Input validation passes
3. Check processVersion.config.cacheEnabled
4. Check Cache-Control header for "no-cache"
5. If caching enabled and no bypass:
   a. Compute hash: SHA256(tenantId + processId + sortedJSON(input))
   b. Query response_cache by (tenantId, processId, inputHash) where expiresAt > now()
6. If cache HIT:
   - Return cached response with meta.cached=true, X-Cache: HIT
   - Skip LLM call entirely
7. If cache MISS:
   - Proceed to LLM generation
   - After successful output validation:
     - Store in response_cache with expiresAt = now + cacheTtlSeconds
     - Return response with meta.cached=false, X-Cache: MISS
```

### Hash Computation

The input hash must be deterministic across requests. Key requirements:
- Sort object keys before JSON serialization
- Include tenantId and processId in hash payload
- Truncate SHA256 to 32 chars (128 bits) for storage efficiency

```typescript
// Identical payloads produce identical hashes
computeInputHash("ten_123", "proc_456", { b: 2, a: 1 })
// same as
computeInputHash("ten_123", "proc_456", { a: 1, b: 2 })
```

### Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Cache hit response time | < 50ms P95 | Database lookup + JSON serialization only |
| Cache miss response time | < 2s P95 | LLM latency dominates |
| Hash computation | < 1ms | Crypto hash of small payload |

### Learnings from Previous Story

**From Story 4.4: LLM Unavailability Handling (Status: done)**

- **Circuit Breaker Integration**: Circuit breaker is now in place at `src/server/services/llm/circuit-breaker.ts`
  - Cache lookups should occur BEFORE circuit breaker check to avoid unnecessary failures
  - If cache hit, skip both circuit breaker check and LLM call
- **LLMError with retryAfter**: `LLMError` now carries `retryAfter` property
- **Error Handler**: `src/server/middleware/error-handler.ts` handles all error types correctly
- **Singleton Pattern**: LLM gateway uses singleton pattern - cache service should follow same pattern

**Services to Extend:**
- `src/app/api/v1/intelligence/[processId]/generate/route.ts` - Add cache lookup/store

**Services to Create:**
- `src/server/services/cache/hash.ts` - Hash computation
- `src/server/services/cache/service.ts` - Cache service implementation
- `src/server/services/cache/types.ts` - Cache types
- `src/server/services/cache/index.ts` - Exports

[Source: docs/stories/4-4-llm-unavailability-handling.md#Dev-Agent-Record]

### Project Structure Notes

Files to create:

```
src/server/services/cache/hash.ts          # CREATE - Hash computation
src/server/services/cache/types.ts         # CREATE - Cache types
src/server/services/cache/service.ts       # CREATE - Cache service
src/server/services/cache/index.ts         # CREATE - Exports
prisma/schema.prisma                       # MODIFY - Add ResponseCache model
```

Files to modify:

```
src/app/api/v1/intelligence/[processId]/generate/route.ts  # MODIFY - Add cache integration
tests/integration/intelligence-api.test.ts                  # MODIFY - Add Story 4.5 tests
```

Tests to create:

```
tests/unit/server/services/cache/hash.test.ts     # CREATE - Hash unit tests
tests/unit/server/services/cache/service.test.ts  # CREATE - Service unit tests
```

### Dependencies

**NPM packages (already installed):**
- `crypto` - Node.js built-in for SHA256 hashing
- `@prisma/client` - Database access

**Internal dependencies:**
- Process model from Epic 2 (inputSchema, config)
- ProcessVersion model from Epic 2 (config.cacheTtlSeconds, config.cacheEnabled)
- Intelligence API route from Epic 3
- Error handler from Story 4.3
- Circuit breaker from Story 4.4

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CACHE_DEFAULT_TTL_SECONDS` | Default cache TTL | 900 | No |

### Testing Strategy

**Mock Strategy:**
- Mock Prisma client for unit tests
- Use real database for integration tests
- Mock `Date.now()` for TTL expiration tests

**Test Data:**
```typescript
// tests/fixtures/cache.ts
export const sampleInput = {
  productName: "Test Product",
  category: "Electronics",
  attributes: { color: "black" }
};

export const sampleCachedResponse = {
  data: {
    shortDescription: "A test product",
    bulletPoints: ["Feature 1", "Feature 2"]
  },
  meta: {
    version: "1.0.0",
    cachedAt: "2025-11-28T10:00:00Z",
    inputHash: "abc123def456..."
  }
};
```

### References

- [Source: docs/tech-spec-epic-4.md#Story-4.5-Response-Caching] - Acceptance criteria
- [Source: docs/tech-spec-epic-4.md#Data-Models-and-Contracts] - ResponseCache model
- [Source: docs/tech-spec-epic-4.md#Cache-Entry-Type] - Cache types
- [Source: docs/architecture.md#ADR-001-PostgreSQL-for-Caching] - PostgreSQL caching decision
- [Source: docs/architecture.md#Input-Hash-Calculation] - Hash computation pattern
- [Source: docs/architecture.md#Intelligence-Generation-Flow] - Flow integration point
- [Source: docs/epics.md#Story-4.5-Response-Caching] - Epic story definition
- [Source: docs/testing-strategy-mvp.md] - Testing patterns
- [Source: docs/stories/4-4-llm-unavailability-handling.md#Dev-Agent-Record] - Previous story learnings

## Dev Agent Record

### Context Reference

- [docs/stories/4-5-response-caching.context.xml](./4-5-response-caching.context.xml)

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-28 | SM Agent | Initial story creation from Epic 4 tech spec |
