# Story 4.6: Configurable Cache TTL

Status: complete

## Story

As a **user**,
I want **to configure the cache TTL for each intelligence process**,
So that **I can balance freshness vs. cost for my use case, choosing faster cached responses when data changes infrequently or always-fresh responses when data changes frequently**.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] **Task 1: Add Cache TTL Configuration to ProcessConfig Type** (AC: 1, 2, 3)
  - [ ] Update `src/server/services/process/types.ts` to include:
    ```typescript
    interface ProcessConfig {
      // ... existing fields
      cacheTtlSeconds: number;    // Default: 900 (15 min), Range: 0-86400
      cacheEnabled: boolean;      // Default: true
    }
    ```
  - [ ] Ensure defaults are set in process creation logic
  - [ ] Document the configuration options

- [ ] **Task 2: Add Zod Validation Schema for Cache TTL** (AC: 3, 5)
  - [ ] Create/update validation schema in `src/server/services/process/schema.ts`:
    ```typescript
    const cacheTtlSchema = z.number()
      .int()
      .min(0, "Cache TTL must be at least 0 (disabled)")
      .max(86400, "Cache TTL cannot exceed 24 hours (86400 seconds)")
      .default(900);
    ```
  - [ ] Add `cacheEnabled` field with default true
  - [ ] Apply validation in process create/update mutations

- [ ] **Task 3: Update Process tRPC Router for Cache Config** (AC: 1, 5)
  - [ ] Modify `src/server/api/routers/process.ts`:
    - Add `cacheTtlSeconds` and `cacheEnabled` to create mutation input
    - Add `cacheTtlSeconds` and `cacheEnabled` to update mutation input
    - Validate TTL range (0-86400) in both mutations
    - Return 400 error for values outside range
  - [ ] Ensure defaults are applied when not provided

- [ ] **Task 4: Create Cache TTL UI Component** (AC: 6)
  - [ ] Create `src/components/process/CacheTtlSettings.tsx`:
    ```typescript
    interface CacheTtlSettingsProps {
      cacheTtlSeconds: number;
      cacheEnabled: boolean;
      onChange: (config: { cacheTtlSeconds: number; cacheEnabled: boolean }) => void;
      disabled?: boolean;
    }
    ```
  - [ ] Include:
    - Toggle switch for enable/disable caching
    - Number input or slider for TTL (0-86400 seconds)
    - Human-readable display (e.g., "15 minutes", "1 hour", "24 hours")
    - Preset buttons for common values (5min, 15min, 1hr, 6hr, 24hr)
    - Visual indicator when caching is disabled (TTL=0)
  - [ ] Use shadcn/ui components (Switch, Input, Label)

- [ ] **Task 5: Integrate Cache Settings into Process Form** (AC: 6)
  - [ ] Update `src/components/process/ProcessForm.tsx` or equivalent:
    - Add CacheTtlSettings component to form
    - Wire up form state management
    - Include in form submission payload
  - [ ] Add to process edit page/modal
  - [ ] Display current TTL on process list/detail view

- [ ] **Task 6: Update Cache Service to Use Process TTL** (AC: 1, 4, 7)
  - [ ] Modify `src/server/services/cache/service.ts`:
    - Read `cacheTtlSeconds` from processVersion.config
    - Pass TTL to `set()` method when storing cache entry
    - Check `cacheEnabled` flag before caching
    - When TTL=0 or cacheEnabled=false, skip cache operations entirely
  - [ ] Verify existing cache lookup/store respects these settings

- [ ] **Task 7: Create pg-boss Cache Cleanup Job** (AC: 8, 9)
  - [ ] Create `src/server/jobs/cache-cleanup.ts`:
    ```typescript
    import { db } from "~/server/db";
    import { logger } from "~/lib/logger";

    export async function cleanupExpiredCache(): Promise<{ deleted: number }> {
      const result = await db.responseCache.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      });

      logger.info("[cache-cleanup] Deleted expired entries", {
        deleted: result.count,
        timestamp: new Date().toISOString()
      });

      return { deleted: result.count };
    }
    ```
  - [ ] Register job in `src/server/jobs/index.ts`:
    ```typescript
    import PgBoss from 'pg-boss';

    const boss = new PgBoss(process.env.DATABASE_URL);

    await boss.start();
    await boss.schedule('cache-cleanup', '0 * * * *'); // Every hour

    boss.work('cache-cleanup', async () => {
      const { deleted } = await cleanupExpiredCache();
      return { deleted };
    });
    ```
  - [ ] Add pg-boss initialization to server startup

- [ ] **Task 8: Implement Cache Invalidation on Process Update/Delete** (AC: 10)
  - [ ] Modify process update mutation:
    - After successful update, call `cacheService.invalidate(tenantId, processId)`
    - Log the invalidation event
  - [ ] Modify process delete mutation:
    - Before/after soft delete, invalidate all cache entries
    - Ensure cleanup happens even for soft-deleted processes
  - [ ] Handle errors gracefully (invalidation failure shouldn't block update)

- [ ] **Task 9: Add Environment Variable for Default TTL** (AC: 2)
  - [ ] Add to `.env.example`:
    ```
    CACHE_DEFAULT_TTL_SECONDS=900
    ```
  - [ ] Update `src/env.js` to validate the variable:
    ```typescript
    CACHE_DEFAULT_TTL_SECONDS: z.number().int().min(0).max(86400).default(900),
    ```
  - [ ] Use this default when creating new processes

- [ ] **Task 10: Write Unit Tests for TTL Validation** (AC: 3, 5)
  - [ ] Create `tests/unit/server/services/process/cache-config.test.ts`
  - [ ] Test TTL validation:
    - Valid values: 0, 1, 900, 86400
    - Invalid values: -1, 86401, NaN, undefined
  - [ ] Test default values applied correctly
  - [ ] Test cacheEnabled toggle logic

- [ ] **Task 11: Write Unit Tests for Cache Cleanup Job** (AC: 8, 9)
  - [ ] Create `tests/unit/server/jobs/cache-cleanup.test.ts`
  - [ ] Mock Prisma client
  - [ ] Test expired entries are deleted
  - [ ] Test non-expired entries are preserved
  - [ ] Test logging output includes count

- [ ] **Task 12: Write Integration Tests for Cache TTL** (AC: 1-10)
  - [ ] Update `tests/integration/intelligence-api.test.ts`:
    - Add "Story 4.6: Configurable Cache TTL" describe block
  - [ ] Test cases:
    - Process with TTL=0 skips caching entirely
    - Process with custom TTL respects that duration
    - Process with cacheEnabled=false skips caching
    - Cache entries expire after TTL
    - Changing TTL doesn't invalidate existing cache
    - Process update invalidates cache
    - Process delete invalidates cache
  - [ ] Test pg-boss job execution (may need to mock pg-boss)

- [ ] **Task 13: Write Integration Tests for Process Router Cache Config** (AC: 1, 5)
  - [ ] Update `tests/integration/process-router.test.ts`:
  - [ ] Test create with custom cacheTtlSeconds
  - [ ] Test create with invalid TTL returns 400
  - [ ] Test update cacheTtlSeconds
  - [ ] Test update with invalid TTL returns 400
  - [ ] Test defaults are applied when not provided

- [ ] **Task 14: Verification** (AC: 1-10)
  - [ ] Run `pnpm typecheck` - zero errors
  - [ ] Run `pnpm lint` - zero new errors
  - [ ] Run `pnpm test:unit` - all tests pass
  - [ ] Run `pnpm test:integration` - all tests pass (Story 4.6 tests)
  - [ ] Run `pnpm build` - production build succeeds
  - [ ] Manual verification:
    - Create process with default TTL
    - Edit process to set custom TTL
    - Verify cache behavior matches TTL setting
    - Verify TTL=0 disables caching

## Dev Notes

**BEFORE WRITING TESTS:** Review testing strategy at `/docs/testing-strategy-mvp.md`
- Unit tests for TTL validation and cleanup job logic
- Integration tests for full TTL flow with real database
- 50% coverage minimum for MVP

### Technical Context

This story completes the caching functionality from Story 4.5 by adding user-configurable TTL settings. The cache infrastructure is already in place; this story focuses on:
1. Exposing TTL configuration to users via UI
2. Validating TTL values
3. Implementing the pg-boss cleanup job
4. Adding cache invalidation on process changes

**Key Architecture Decisions:**
- pg-boss for scheduled jobs per ADR-004 (PostgreSQL-based, no additional infrastructure)
- TTL stored in ProcessVersion.config JSON column (existing pattern)
- Hourly cleanup job is adequate for MVP (per tech spec)
- Cache invalidation on process update prevents stale data

### Learnings from Previous Story

**From Story 4.5: Response Caching (Status: done)**

- **Cache Service Created**: `src/server/services/cache/service.ts` with PostgresCacheService class
  - `get(tenantId, processId, inputHash)` - Query with expiration check
  - `set(tenantId, processId, inputHash, entry, ttlSeconds)` - Upsert with TTL
  - `invalidate(tenantId, processId)` - Delete all entries for process
- **Hash Utility**: `src/server/services/cache/hash.ts` - `computeInputHash()` function
- **Cache Types**: `src/server/services/cache/types.ts` - CacheEntry, CacheService interfaces
- **ResponseCache Model**: Added to Prisma schema with:
  - Unique constraint on (tenantId, processId, inputHash)
  - Index on expiresAt for efficient cleanup
  - Index on (tenantId, processId) for lookups
- **Process Config Fields**: ProcessConfig already includes `cacheTtlSeconds` and `cacheEnabled`
- **Integration Point**: Cache integrated into `/api/v1/intelligence/[processId]/generate` route

**Files Created in Story 4.5:**
- `src/server/services/cache/hash.ts`
- `src/server/services/cache/types.ts`
- `src/server/services/cache/service.ts`
- `src/server/services/cache/index.ts`
- `tests/unit/server/services/cache/hash.test.ts`
- `tests/unit/server/services/cache/service.test.ts`

**Files to Reuse:**
- `cacheService.invalidate()` - Already implemented, use for process update/delete
- Cache types and interfaces - Extend as needed

[Source: docs/stories/4-5-response-caching.md#Dev-Notes]

### Project Structure Notes

Files to create:

```
src/server/jobs/cache-cleanup.ts           # CREATE - pg-boss cleanup job
src/server/jobs/index.ts                   # CREATE - Job registration
src/components/process/CacheTtlSettings.tsx # CREATE - UI component
tests/unit/server/jobs/cache-cleanup.test.ts # CREATE - Job unit tests
tests/unit/server/services/process/cache-config.test.ts # CREATE - Config validation tests
```

Files to modify:

```
src/server/services/process/types.ts       # MODIFY - Ensure config types
src/server/services/process/schema.ts      # MODIFY - Add TTL validation
src/server/api/routers/process.ts          # MODIFY - Add cache config to mutations
src/components/process/ProcessForm.tsx     # MODIFY - Add cache settings UI
src/server/services/cache/service.ts       # VERIFY - TTL/enabled checks
src/env.js                                 # MODIFY - Add CACHE_DEFAULT_TTL_SECONDS
.env.example                               # MODIFY - Add default TTL variable
tests/integration/intelligence-api.test.ts  # MODIFY - Add Story 4.6 tests
tests/integration/process-router.test.ts   # MODIFY - Add cache config tests
```

### Dependencies

**NPM packages to install:**
- `pg-boss` (^12.3.0) - PostgreSQL-based job queue

**Internal dependencies:**
- Cache service from Story 4.5
- Process model and router from Epic 2
- shadcn/ui components (Switch, Input, Label)
- Error handling from Story 4.3

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CACHE_DEFAULT_TTL_SECONDS` | Default cache TTL for new processes | 900 | No |
| `DATABASE_URL` | Database connection (for pg-boss) | - | Yes |

### pg-boss Setup Notes

pg-boss uses the same PostgreSQL database - no additional infrastructure needed:

1. Tables auto-created on first `boss.start()` call
2. Cron syntax: `'0 * * * *'` = hourly at minute 0
3. Jobs are persisted and survive server restarts
4. Failed jobs can be retried (configurable)

```typescript
// Initialization pattern
const boss = new PgBoss(env.DATABASE_URL);
await boss.start();

// Schedule (idempotent - safe to call on every startup)
await boss.schedule('cache-cleanup', '0 * * * *');

// Worker
boss.work('cache-cleanup', async (job) => {
  const result = await cleanupExpiredCache();
  return result; // Returned data is stored with job completion
});
```

### UI Component Guidance

Cache TTL Settings component should:
- Use shadcn/ui Switch for enable/disable
- Use shadcn/ui Input (type="number") for TTL seconds
- Show human-readable time format
- Provide quick-select presets

```typescript
// Preset values (in seconds)
const TTL_PRESETS = [
  { label: "5 minutes", value: 300 },
  { label: "15 minutes", value: 900 },
  { label: "1 hour", value: 3600 },
  { label: "6 hours", value: 21600 },
  { label: "24 hours", value: 86400 },
];

// Helper for display
function formatTtl(seconds: number): string {
  if (seconds === 0) return "Disabled";
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
  return `${Math.floor(seconds / 86400)} days`;
}
```

### Testing Strategy

**Mock Strategy:**
- Mock pg-boss for unit tests
- Use real pg-boss (or skip) for integration tests
- Mock Date.now() for expiration tests

**Key Test Scenarios:**
- TTL=0 disables caching completely
- Custom TTL is respected
- Invalid TTL values rejected with 400
- Cache invalidation on process update
- Cleanup job deletes only expired entries

### References

- [Source: docs/tech-spec-epic-4.md#Story-4.6-Configurable-Cache-TTL] - Acceptance criteria
- [Source: docs/tech-spec-epic-4.md#Process-Model-Addition] - ProcessConfig cache fields
- [Source: docs/tech-spec-epic-4.md#Cache-Cleanup-Job] - pg-boss job pattern
- [Source: docs/architecture.md#ADR-004-pg-boss-for-Background-Jobs] - pg-boss decision
- [Source: docs/architecture.md#ADR-001-PostgreSQL-for-Caching] - PostgreSQL caching
- [Source: docs/architecture.md#Configuration-Options-per-Process] - ProcessConfig structure
- [Source: docs/epics.md#Story-4.6-Configurable-Cache-TTL] - Epic story definition
- [Source: docs/testing-strategy-mvp.md] - Testing patterns
- [Source: docs/stories/4-5-response-caching.md] - Previous story context

## Dev Agent Record

### Context Reference

- docs/stories/4-6-configurable-cache-ttl.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-28 | SM Agent | Initial story creation from Epic 4 tech spec |
