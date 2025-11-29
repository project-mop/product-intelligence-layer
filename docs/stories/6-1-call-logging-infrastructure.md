# Story 6.1: Call Logging Infrastructure

Status: completed

## Story

As a **system**,
I want **to log every API call with comprehensive metadata**,
So that **users can review their usage and debug issues**.

## Acceptance Criteria

1. Every API call (success or failure) creates a log entry in the `call_logs` table (FR-401)
2. Log entry contains timestamp with timezone for when call was made (FR-401)
3. Log entry contains tenant_id for multi-tenant isolation (FR-401)
4. Log entry contains process_id referencing the intelligence definition (FR-401)
5. Log entry contains input snapshot - the actual request payload sent (FR-402)
6. Log entry contains output - the response returned to the client (FR-403)
7. Log entry contains latency_ms - time from request to response in milliseconds (FR-404)
8. Log entry contains status_code - HTTP status returned (FR-405)
9. Log entry contains error_code if request failed (FR-405)
10. Log entry contains model_used - which LLM model processed the request (FR-406)
11. Log entry contains endpoint_version - which process version was used (FR-407)
12. Logs are written asynchronously (non-blocking to response)
13. Log storage is indexed for efficient querying by tenant_id, process_id, timestamp
14. All call log fields are queryable for later UI/export features

## Tasks / Subtasks

- [ ] **Task 1: Create call_logs database schema** (AC: 1-11, 13, 14)
  - [ ] Add `CallLog` model to `prisma/schema.prisma`:
    ```prisma
    model CallLog {
      id                String    @id @default(cuid())
      tenantId          String    @map("tenant_id")
      processId         String    @map("process_id")
      processVersionId  String    @map("process_version_id")

      // Request/Response data
      inputHash         String    @map("input_hash")
      input             Json?     // Nullable for anonymization support
      output            Json?     // Response data

      // Metadata
      statusCode        Int       @map("status_code")
      errorCode         String?   @map("error_code")
      latencyMs         Int       @map("latency_ms")
      modelUsed         String?   @map("model_used")
      cached            Boolean   @default(false)

      // Timestamps
      createdAt         DateTime  @default(now()) @map("created_at")

      // Relations
      tenant            Tenant    @relation(fields: [tenantId], references: [id])
      process           Process   @relation(fields: [processId], references: [id])
      processVersion    ProcessVersion @relation(fields: [processVersionId], references: [id])

      @@index([tenantId, createdAt])
      @@index([tenantId, processId])
      @@index([tenantId, processId, createdAt])
      @@index([inputHash])
      @@map("call_logs")
    }
    ```
  - [ ] Add relations to existing models (Tenant, Process, ProcessVersion)
  - [ ] Run `pnpm prisma db push` to apply schema changes

- [ ] **Task 2: Create call log service** (AC: 1-12)
  - [ ] Create `src/server/services/callLog/index.ts`:
    ```typescript
    export * from "./call-log-service";
    export * from "./types";
    ```
  - [ ] Create `src/server/services/callLog/types.ts`:
    ```typescript
    export interface CallLogEntry {
      tenantId: string;
      processId: string;
      processVersionId: string;
      inputHash: string;
      input?: Record<string, unknown>;
      output?: Record<string, unknown>;
      statusCode: number;
      errorCode?: string;
      latencyMs: number;
      modelUsed?: string;
      cached: boolean;
    }

    export interface CallLogResult {
      id: string;
      createdAt: Date;
    }
    ```
  - [ ] Create `src/server/services/callLog/call-log-service.ts`:
    ```typescript
    import { db } from "@/server/db";
    import type { CallLogEntry, CallLogResult } from "./types";

    /**
     * Log an API call asynchronously (fire-and-forget pattern)
     * Errors are logged but do not propagate to caller
     */
    export async function logCallAsync(entry: CallLogEntry): Promise<void> {
      // Fire and forget - don't await, just catch errors
      db.callLog.create({
        data: {
          tenantId: entry.tenantId,
          processId: entry.processId,
          processVersionId: entry.processVersionId,
          inputHash: entry.inputHash,
          input: entry.input ?? undefined,
          output: entry.output ?? undefined,
          statusCode: entry.statusCode,
          errorCode: entry.errorCode ?? null,
          latencyMs: entry.latencyMs,
          modelUsed: entry.modelUsed ?? null,
          cached: entry.cached,
        },
      }).catch((error) => {
        console.error("[CallLog] Failed to write call log:", error);
      });
    }

    /**
     * Log an API call synchronously (for testing/specific use cases)
     */
    export async function logCallSync(entry: CallLogEntry): Promise<CallLogResult> {
      const result = await db.callLog.create({
        data: {
          tenantId: entry.tenantId,
          processId: entry.processId,
          processVersionId: entry.processVersionId,
          inputHash: entry.inputHash,
          input: entry.input ?? undefined,
          output: entry.output ?? undefined,
          statusCode: entry.statusCode,
          errorCode: entry.errorCode ?? null,
          latencyMs: entry.latencyMs,
          modelUsed: entry.modelUsed ?? null,
          cached: entry.cached,
        },
        select: {
          id: true,
          createdAt: true,
        },
      });

      return result;
    }
    ```

- [ ] **Task 3: Integrate call logging into intelligence API route** (AC: 1-12)
  - [ ] Modify `src/app/api/v1/intelligence/[processId]/generate/route.ts`:
    - Add timing capture at request start
    - Capture all required metadata during processing
    - Call `logCallAsync()` after response is prepared (before return)
  - [ ] Modify `src/app/api/v1/sandbox/intelligence/[processId]/generate/route.ts`:
    - Same integration for sandbox endpoint
  - [ ] Example integration pattern:
    ```typescript
    // At request start
    const requestStartTime = Date.now();

    // ... processing ...

    // Before returning response
    const latencyMs = Date.now() - requestStartTime;

    logCallAsync({
      tenantId: ctx.tenantId,
      processId: params.processId,
      processVersionId: processVersion.id,
      inputHash: computeInputHash(ctx.tenantId, params.processId, input),
      input: input, // Will support anonymization in Story 6.5
      output: result.data,
      statusCode: 200,
      errorCode: undefined,
      latencyMs,
      modelUsed: result.meta?.model ?? "unknown",
      cached: result.meta?.cached ?? false,
    });
    ```

- [ ] **Task 4: Log error cases** (AC: 5, 8, 9)
  - [ ] Add call logging to error handlers in API routes
  - [ ] Log 400 errors (validation failures):
    ```typescript
    logCallAsync({
      // ... common fields ...
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      output: { error: { code: "VALIDATION_ERROR", message: "..." } },
      latencyMs,
      cached: false,
    });
    ```
  - [ ] Log 401/403 errors (auth failures):
    ```typescript
    logCallAsync({
      // ... common fields (may have partial context) ...
      statusCode: 401,
      errorCode: "UNAUTHORIZED",
      output: { error: { code: "UNAUTHORIZED" } },
      latencyMs,
      cached: false,
    });
    ```
  - [ ] Log 429 errors (rate limit):
    ```typescript
    logCallAsync({
      // ... common fields ...
      statusCode: 429,
      errorCode: "RATE_LIMITED",
      output: { error: { code: "RATE_LIMITED", retry_after: N } },
      latencyMs,
      cached: false,
    });
    ```
  - [ ] Log 500/503 errors (server/LLM errors):
    ```typescript
    logCallAsync({
      // ... common fields ...
      statusCode: 503,
      errorCode: "LLM_ERROR",
      output: { error: { code: "LLM_ERROR", message: "..." } },
      latencyMs,
      cached: false,
    });
    ```

- [ ] **Task 5: Add model_used tracking to LLM gateway** (AC: 10)
  - [ ] Modify `src/server/services/llm/types.ts`:
    - Ensure `GenerateResult` includes `model` field
  - [ ] Modify `src/server/services/llm/anthropic.ts`:
    - Return actual model name from Claude response
  - [ ] Verify model name flows through to call log

- [ ] **Task 6: Create callLog tRPC router** (AC: 13, 14)
  - [ ] Create `src/server/api/routers/callLog.ts`:
    ```typescript
    import { z } from "zod";
    import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

    export const callLogRouter = createTRPCRouter({
      // List call logs with pagination and filtering
      list: protectedProcedure
        .input(z.object({
          processId: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          statusCode: z.number().optional(),
        }))
        .query(async ({ ctx, input }) => {
          const logs = await ctx.db.callLog.findMany({
            where: {
              tenantId: ctx.tenantId,
              processId: input.processId,
              createdAt: {
                gte: input.startDate,
                lte: input.endDate,
              },
              statusCode: input.statusCode,
            },
            orderBy: { createdAt: "desc" },
            take: input.limit + 1,
            cursor: input.cursor ? { id: input.cursor } : undefined,
            select: {
              id: true,
              processId: true,
              statusCode: true,
              errorCode: true,
              latencyMs: true,
              cached: true,
              modelUsed: true,
              createdAt: true,
            },
          });

          let nextCursor: string | undefined;
          if (logs.length > input.limit) {
            const nextItem = logs.pop();
            nextCursor = nextItem?.id;
          }

          return { logs, nextCursor };
        }),

      // Get single call log with full details
      get: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
          const log = await ctx.db.callLog.findFirst({
            where: {
              id: input.id,
              tenantId: ctx.tenantId,
            },
          });

          if (!log) {
            throw new TRPCError({ code: "NOT_FOUND" });
          }

          return log;
        }),

      // Get call log statistics for a process
      stats: protectedProcedure
        .input(z.object({
          processId: z.string(),
          days: z.number().min(1).max(90).default(7),
        }))
        .query(async ({ ctx, input }) => {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - input.days);

          const logs = await ctx.db.callLog.groupBy({
            by: ["statusCode"],
            where: {
              tenantId: ctx.tenantId,
              processId: input.processId,
              createdAt: { gte: startDate },
            },
            _count: true,
            _avg: { latencyMs: true },
          });

          return logs;
        }),
    });
    ```
  - [ ] Add router to `src/server/api/root.ts`

- [ ] **Task 7: Add factory for call logs** (AC: 1-11)
  - [ ] Create `tests/support/factories/call-log.factory.ts`:
    ```typescript
    import { db } from "@/server/db";
    import { generateId } from "@/lib/id";

    interface CallLogFactoryParams {
      tenantId: string;
      processId: string;
      processVersionId: string;
      inputHash?: string;
      input?: Record<string, unknown>;
      output?: Record<string, unknown>;
      statusCode?: number;
      errorCode?: string;
      latencyMs?: number;
      modelUsed?: string;
      cached?: boolean;
    }

    export const callLogFactory = {
      build(params: CallLogFactoryParams) {
        return {
          id: generateId("req"),
          tenantId: params.tenantId,
          processId: params.processId,
          processVersionId: params.processVersionId,
          inputHash: params.inputHash ?? "test_hash_" + Math.random(),
          input: params.input ?? { test: "input" },
          output: params.output ?? { success: true, data: {} },
          statusCode: params.statusCode ?? 200,
          errorCode: params.errorCode ?? null,
          latencyMs: params.latencyMs ?? 150,
          modelUsed: params.modelUsed ?? "claude-3-5-haiku-20241022",
          cached: params.cached ?? false,
          createdAt: new Date(),
        };
      },

      async create(params: CallLogFactoryParams) {
        return db.callLog.create({
          data: this.build(params),
        });
      },

      async createMany(params: CallLogFactoryParams, count: number) {
        const logs = [];
        for (let i = 0; i < count; i++) {
          logs.push(await this.create(params));
        }
        return logs;
      },

      async createError(params: CallLogFactoryParams & { errorCode: string }) {
        return this.create({
          ...params,
          statusCode: params.statusCode ?? 500,
          errorCode: params.errorCode,
          output: params.output ?? { error: { code: params.errorCode } },
        });
      },
    };
    ```
  - [ ] Export from `tests/support/factories/index.ts`

- [ ] **Task 8: Write unit tests for call log service** (AC: 1, 12)
  - [ ] Create `tests/unit/server/services/call-log-service.test.ts`:
    - Test: logCallAsync calls db.callLog.create
    - Test: logCallAsync catches and logs errors (non-blocking)
    - Test: logCallSync returns created log entry
    - Test: All required fields are passed to database

- [ ] **Task 9: Write integration tests for call logging** (AC: 1-14)
  - [ ] Create `tests/integration/call-log-router.test.ts`:
    - Test: list returns logs filtered by tenant
    - Test: list supports pagination with cursor
    - Test: list filters by processId
    - Test: list filters by date range
    - Test: list filters by status code
    - Test: get returns single log with all fields
    - Test: get rejects access to other tenant's logs
    - Test: stats returns aggregated data
    - Test: Tenant isolation - cannot see other tenant's logs

- [ ] **Task 10: Write integration tests for API route logging** (AC: 1-12)
  - [ ] Add "Story 6.1: Call Logging Infrastructure" describe block to `tests/integration/intelligence-api.test.ts`:
    - Test: Successful API call creates log entry
    - Test: Log entry contains correct tenant_id, process_id
    - Test: Log entry contains input and output
    - Test: Log entry contains latency_ms > 0
    - Test: Log entry contains model_used
    - Test: Log entry contains correct statusCode (200)
    - Test: Log entry contains cached flag
    - Test: Failed validation creates log with error_code
    - Test: Rate limit error creates log with 429 status
    - Test: Sandbox endpoint also logs calls

- [ ] **Task 11: Verification** (AC: 1-14)
  - [ ] Run `pnpm typecheck` - zero errors
  - [ ] Run `pnpm lint` - zero new errors
  - [ ] Run `pnpm test:unit` - all tests pass
  - [ ] Run `pnpm test:integration` - Story 6.1 tests pass
  - [ ] Run `pnpm build` - production build succeeds
  - [ ] Manual verification:
    - [ ] Make API call → verify log entry created in database
    - [ ] Make failed API call → verify error log entry created
    - [ ] Check log contains all required fields (timestamp, tenant, process, input, output, latency, model, version)
    - [ ] Verify async logging doesn't block API response

## Dev Notes

**BEFORE WRITING TESTS:** Review testing strategy `/docs/testing-strategy-mvp.md`
- Unit tests for call log service (fast, mocked)
- Integration tests for tRPC router and API route logging (real DB)
- 50% coverage minimum for MVP

### Technical Context

This story establishes the foundational call logging infrastructure for Epic 6 (Observability & Logging). It creates the data model and service layer that will be used by subsequent stories:
- Story 6.2 (Call History UI) - will query this data
- Story 6.3 (90-Day Log Retention) - will clean up this data
- Story 6.4 (Log Export) - will export this data
- Story 6.5 (Input Anonymization) - will modify input storage behavior
- Story 6.6 (Export API Results) - will export this data

**From PRD - FR-401 through FR-407:**
> - FR-401: Log every API call with timestamp
> - FR-402: Store input snapshot for each call (with optional anonymization toggle)
> - FR-403: Store output for each call
> - FR-404: Record latency for each call
> - FR-405: Record errors for failed calls
> - FR-406: Record model used for each call
> - FR-407: Record endpoint version for each call

**Key Architecture Rules:**
- Logs are written asynchronously (fire-and-forget) to avoid blocking API responses
- All logs are tenant-scoped for multi-tenant isolation
- Input storage supports future anonymization toggle (Story 6.5)
- Log table is indexed for efficient querying by UI and export features

**From Architecture - Data Architecture:**
```
call_logs
├── id (req_*)
├── tenant_id → tenants
├── process_id → processes
├── process_version_id → process_versions
├── input_hash
├── output (JSON)
├── latency_ms
├── cached
├── error_code
├── created_at
```

### Learnings from Previous Story

**From Story 5.5: Version Pinning and Deprecation (Status: done)**

- **Version resolution patterns**: `src/server/services/process/version-resolver.ts` - use this to get version info for logging
- **API route structure**: Both production and sandbox routes at `src/app/api/v1/[sandbox/]intelligence/[processId]/generate/route.ts`
- **Test patterns**: Integration tests in `tests/integration/` with real database
- **Error handling**: Standard error codes in `src/lib/errors.ts`

**Key Files from Epic 5 (to reference):**
- `src/app/api/v1/intelligence/[processId]/generate/route.ts` - **MODIFY** to add logging
- `src/app/api/v1/sandbox/intelligence/[processId]/generate/route.ts` - **MODIFY** to add logging
- `src/server/services/llm/anthropic.ts` - Verify model name is returned
- `src/server/services/cache/hash.ts` - Use `computeInputHash()` for input_hash field

[Source: stories/5-5-version-pinning-and-deprecation.md#Dev-Agent-Record]

### Project Structure Notes

**Files to create:**

```
prisma/schema.prisma                                    # MODIFY - Add CallLog model
src/server/services/callLog/index.ts                    # CREATE - Service exports
src/server/services/callLog/types.ts                    # CREATE - Type definitions
src/server/services/callLog/call-log-service.ts         # CREATE - Core service
src/server/api/routers/callLog.ts                       # CREATE - tRPC router
tests/support/factories/call-log.factory.ts             # CREATE - Test factory
tests/unit/server/services/call-log-service.test.ts     # CREATE - Unit tests
tests/integration/call-log-router.test.ts               # CREATE - Router integration tests
```

**Files to modify:**

```
src/app/api/v1/intelligence/[processId]/generate/route.ts      # MODIFY - Add logging
src/app/api/v1/sandbox/intelligence/[processId]/generate/route.ts  # MODIFY - Add logging
src/server/api/root.ts                                         # MODIFY - Add callLog router
tests/support/factories/index.ts                               # MODIFY - Export callLog factory
tests/integration/intelligence-api.test.ts                     # MODIFY - Add Story 6.1 tests
```

### Call Log Entry Structure

```typescript
interface CallLogEntry {
  // Identity
  id: string;                    // req_* prefixed ID
  tenantId: string;              // Tenant isolation
  processId: string;             // Which intelligence
  processVersionId: string;      // Which version

  // Request/Response
  inputHash: string;             // SHA256 hash for cache key reference
  input: Json | null;            // Request payload (nullable for anonymization)
  output: Json | null;           // Response payload

  // Metadata
  statusCode: number;            // HTTP status (200, 400, 401, 429, 500, 503)
  errorCode: string | null;      // VALIDATION_ERROR, UNAUTHORIZED, LLM_ERROR, etc.
  latencyMs: number;             // Response time in milliseconds
  modelUsed: string | null;      // claude-3-5-haiku-20241022, etc.
  cached: boolean;               // Was response from cache?

  // Timestamps
  createdAt: DateTime;           // When call was made
}
```

### Async Logging Pattern

```typescript
// Fire-and-forget pattern - don't block response
logCallAsync(entry).catch(() => {}); // Already handled internally

// API route pattern
export async function POST(request: Request, { params }) {
  const startTime = Date.now();

  try {
    // ... process request ...
    const result = await generateIntelligence(...);
    const latencyMs = Date.now() - startTime;

    // Log success (non-blocking)
    logCallAsync({
      tenantId,
      processId,
      processVersionId,
      inputHash,
      input,
      output: result.data,
      statusCode: 200,
      latencyMs,
      modelUsed: result.meta.model,
      cached: result.meta.cached,
    });

    return NextResponse.json(result);
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    // Log error (non-blocking)
    logCallAsync({
      tenantId,
      processId,
      processVersionId,
      inputHash,
      input,
      output: { error: errorResponse },
      statusCode: errorStatus,
      errorCode: error.code,
      latencyMs,
      cached: false,
    });

    return NextResponse.json(errorResponse, { status: errorStatus });
  }
}
```

### Database Indexes

The following indexes optimize common query patterns:

| Index | Purpose |
|-------|---------|
| `(tenantId, createdAt)` | List recent logs for tenant |
| `(tenantId, processId)` | Filter logs by process |
| `(tenantId, processId, createdAt)` | Filter by process with date range |
| `(inputHash)` | Reference cache entries |

### Dependencies

**NPM packages:** None new required

**Internal dependencies:**
- `db` from `src/server/db`
- `computeInputHash` from `src/server/services/cache/hash.ts`
- `generateId` from `src/lib/id` (for test factory)
- Process/ProcessVersion models from Epic 2
- LLM Gateway from Story 3.2

### Security Considerations

- All log queries include tenant_id filter (mandatory)
- Input data may contain sensitive customer information - will support anonymization in Story 6.5
- Logs contain business data - ensure proper access controls
- Error logs do not leak stack traces or internal details to stored output

### References

- [Source: docs/Product_Intelligence_Layer_PRD.md#5.4-Call-History-&-Logging] - FR-401 through FR-407
- [Source: docs/architecture.md#Data-Architecture] - call_logs schema
- [Source: docs/architecture.md#Intelligence-Generation-Flow] - Where logging integrates
- [Source: docs/epics.md#Story-6.1-Call-Logging-Infrastructure] - Epic story definition
- [Source: docs/testing-strategy-mvp.md] - Testing patterns
- [Source: stories/5-5-version-pinning-and-deprecation.md#Dev-Agent-Record] - Previous story learnings

## Dev Agent Record

### Context Reference

- docs/stories/6-1-call-logging-infrastructure.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-29 | SM Agent | Initial story creation from Epic 6 |
