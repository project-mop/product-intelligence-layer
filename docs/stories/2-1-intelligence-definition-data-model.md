# Story 2.1: Intelligence Definition Data Model

Status: done

## Story

As a **developer**,
I want **a tRPC router and service layer for intelligence definition CRUD operations**,
So that **users can create, read, update, delete, and duplicate intelligence definitions through the API**.

## Acceptance Criteria

1. **Process Router Exists**: tRPC router at `src/server/api/routers/process.ts` with CRUD procedures
2. **List Procedure**: `process.list` returns all non-deleted processes for the authenticated user's tenant with optional filtering by status and search
3. **Get Procedure**: `process.get` returns a single process with its versions, filtered by tenant
4. **Create Procedure**: `process.create` creates a new Process and initial ProcessVersion (SANDBOX environment) in a transaction
5. **Update Procedure**: `process.update` modifies process metadata (name, description, inputSchema, outputSchema)
6. **Duplicate Procedure**: `process.duplicate` deep copies a process with "(Copy)" suffix and creates a new SANDBOX version
7. **Delete Procedure**: `process.delete` performs soft delete (sets deletedAt timestamp)
8. **Tenant Isolation**: All procedures enforce tenant isolation via session context (no cross-tenant access)
9. **Input Validation**: All procedures use Zod schemas for input validation matching the tech spec
10. **Audit Logging**: Create, update, duplicate, and delete operations write audit log entries
11. **JSON Schema Validation**: inputSchema and outputSchema are validated as valid JSON Schema Draft 7

## Tasks / Subtasks

- [x] **Task 1: Create process router structure** (AC: 1, 8)
  - [x] Create `src/server/api/routers/process.ts`
  - [x] Add `processRouter` to `src/server/api/root.ts`
  - [x] Implement `protectedProcedure` pattern for all procedures (tenant from session)

- [x] **Task 2: Implement Zod schemas for input validation** (AC: 9, 11)
  - [x] Create `createProcessSchema` with name, description, inputSchema, outputSchema, config fields
  - [x] Create `updateProcessSchema` with optional fields
  - [x] Create `componentSchema` and `attributeSchema` for nested validation
  - [x] Add JSON Schema Draft 7 validation utility (using ajv package)

- [x] **Task 3: Implement list procedure** (AC: 2, 8)
  - [x] Accept optional `status` filter (SANDBOX, PRODUCTION)
  - [x] Accept optional `search` string for name/description matching
  - [x] Return processes ordered by `updatedAt` desc
  - [x] Include version count and latest version status in response

- [x] **Task 4: Implement get procedure** (AC: 3, 8)
  - [x] Accept `id` parameter
  - [x] Return process with all versions
  - [x] Throw `NOT_FOUND` if process doesn't exist or belongs to different tenant
  - [x] Include computed fields (version count, has production version)

- [x] **Task 5: Implement create procedure** (AC: 4, 8, 10)
  - [x] Generate `proc_*` ID using existing ID generator
  - [x] Create Process record with validated schemas
  - [x] Create initial ProcessVersion with `procv_*` ID and SANDBOX environment
  - [x] Set version to "1.0.0"
  - [x] Build initial config from input (goal, maxTokens, temperature defaults)
  - [x] Use transaction to ensure atomicity
  - [x] Write audit log entry: `process.created`

- [x] **Task 6: Implement update procedure** (AC: 5, 8, 10)
  - [x] Accept `id` and optional update fields
  - [x] Verify process belongs to tenant
  - [x] Update only provided fields
  - [x] Update `updatedAt` timestamp
  - [x] Write audit log entry: `process.updated`

- [x] **Task 7: Implement duplicate procedure** (AC: 6, 8, 10)
  - [x] Accept `id` and optional `newName` parameter
  - [x] Load source process with latest version config
  - [x] Create new Process with copied fields and "(Copy)" suffix if no newName
  - [x] Create new ProcessVersion (SANDBOX) with copied config
  - [x] Use transaction for atomicity
  - [x] Write audit log entry: `process.duplicated`

- [x] **Task 8: Implement delete procedure** (AC: 7, 8, 10)
  - [x] Accept `id` parameter
  - [x] Verify process belongs to tenant
  - [x] Set `deletedAt` timestamp (soft delete)
  - [x] Write audit log entry: `process.deleted`

- [x] **Task 9: Add restore procedure (bonus)** (AC: 7)
  - [x] Accept `id` parameter
  - [x] Clear `deletedAt` timestamp
  - [x] Write audit log entry: `process.restored`

- [x] **Task 10: Write integration tests** (AC: 1-11)
  - [x] Test `process.list` returns tenant-scoped results
  - [x] Test `process.list` filtering by status and search
  - [x] Test `process.get` returns process with versions
  - [x] Test `process.get` throws NOT_FOUND for other tenant's process
  - [x] Test `process.create` creates process + version in transaction
  - [x] Test `process.create` validates JSON schemas
  - [x] Test `process.update` modifies only specified fields
  - [x] Test `process.duplicate` creates copy with new IDs
  - [x] Test `process.delete` performs soft delete
  - [x] Test tenant isolation across all procedures
  - [x] Test audit log entries are created

- [x] **Task 11: Verification** (AC: 1-11)
  - [x] Run `pnpm typecheck` - zero errors
  - [x] Run `pnpm lint` - zero new errors
  - [x] Run `pnpm test:unit` - all pass (102 tests)
  - [x] Run `pnpm test:integration` - all pass (51 new tests for process router)

## Dev Notes

**BEFORE WRITING TESTS:** Review testing strategy at `/docs/testing-strategy-mvp.md`
- Integration tests for tRPC routers are the preferred approach
- Use existing factory patterns from `tests/support/factories/`
- 50% coverage minimum for MVP

### Technical Context

This story implements the **tRPC router layer** for intelligence CRUD operations. The data model (Process, ProcessVersion) already exists in Prisma schema from Epic 1 and was verified in Story 2.0.

**Key Architecture Decisions:**
- ADR-003: tRPC for internal dashboard operations (type-safe end-to-end)
- All queries must filter by `tenantId` from session (never trust client input)
- JSON schemas stored in JSONB columns for flexible field definitions

### Existing Schema Reference

From `prisma/schema.prisma`:

```prisma
model Process {
  id           String    @id // proc_* prefix
  tenantId     String
  name         String
  description  String?
  inputSchema  Json     // JSON Schema for input validation
  outputSchema Json     // JSON Schema for output validation
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?

  // Relations
  tenant        Tenant           @relation(...)
  versions      ProcessVersion[]
  ...
}

model ProcessVersion {
  id           String      @id // procv_* prefix
  processId    String
  version      String      // Semantic version "1.0.0"
  config       Json        // ProcessConfig type
  environment  Environment // SANDBOX | PRODUCTION
  publishedAt  DateTime?
  deprecatedAt DateTime?
  createdAt    DateTime    @default(now())

  // Relations
  process  Process @relation(...)
  ...
}
```

**Note:** Schema uses `Environment` enum (SANDBOX, PRODUCTION) not `ProcessVersionStatus` (DRAFT, SANDBOX, PRODUCTION, DEPRECATED). The "draft" state is represented by SANDBOX environment with `publishedAt = null`.

### ProcessConfig TypeScript Interface

Create in `src/server/services/process/types.ts`:

```typescript
export interface ProcessConfig {
  // LLM Settings
  systemPrompt: string;
  additionalInstructions?: string;
  maxTokens: number;         // default: 1024
  temperature: number;       // default: 0.3

  // Schema descriptions for prompt assembly
  inputSchemaDescription: string;
  outputSchemaDescription: string;

  // Goal/purpose (FR-105)
  goal: string;

  // Components hierarchy (FR-104) - optional
  components?: ComponentDefinition[];

  // Caching defaults
  cacheTtlSeconds: number;   // default: 900 (15 min)
  cacheEnabled: boolean;     // default: true

  // Rate limiting defaults
  requestsPerMinute: number; // default: 60
}

export interface ComponentDefinition {
  name: string;
  type: string;
  attributes?: AttributeDefinition[];
  subcomponents?: ComponentDefinition[];
}

export interface AttributeDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required: boolean;
}
```

### tRPC Procedures Overview

| Procedure | Type | Input | Output | Notes |
|-----------|------|-------|--------|-------|
| `list` | query | `{status?, search?}` | `Process[]` | List with optional filtering |
| `get` | query | `{id}` | `Process & {versions}` | Single with versions |
| `create` | mutation | `CreateProcessInput` | `{process, version}` | Creates process + initial version |
| `update` | mutation | `{id, ...fields}` | `Process` | Update metadata |
| `duplicate` | mutation | `{id, newName?}` | `{process, version}` | Deep copy |
| `delete` | mutation | `{id}` | `{success}` | Soft delete |
| `restore` | mutation | `{id}` | `Process` | Restore soft-deleted |

### JSON Schema Validation

For validating inputSchema and outputSchema as valid JSON Schema Draft 7:

```typescript
import Ajv from "ajv";

const ajv = new Ajv({ strict: false });

export function validateJsonSchema(schema: unknown): boolean {
  try {
    ajv.compile(schema as object);
    return true;
  } catch {
    return false;
  }
}
```

Add `ajv` to dependencies if needed.

### Learnings from Previous Story

**From Story 2.0: Development Seed Data (Status: done)**

- **Factories**: `processFactory` and `processVersionFactory` available in `tests/support/factories/`
- **ID Generation**: Use `generateProcessId()` and `generateProcessVersionId()` from `src/lib/id.ts`
- **Seed Data**: Test data available via `pnpm db:seed` for manual testing
- **Schema Note**: No `categories` field on Process model (mentioned in tech spec but not in actual schema)
- **Environment Enum**: Use SANDBOX/PRODUCTION not DRAFT/SANDBOX/PRODUCTION/DEPRECATED

**Files to Reference:**
- `src/server/api/routers/apiKey.ts` - Pattern for tRPC router structure
- `src/server/api/routers/auditLog.ts` - Audit logging integration pattern
- `tests/integration/api-key-router.test.ts` - Integration test patterns
- `tests/support/factories/process.factory.ts` - Process factory

[Source: docs/stories/2-0-development-seed-data.md#Completion-Notes-List]

### Project Structure Notes

New files to create:

```
src/server/
├── api/routers/
│   └── process.ts           # NEW - Process CRUD router
└── services/process/
    ├── types.ts             # NEW - ProcessConfig interfaces
    └── index.ts             # NEW - Service layer (optional, can inline in router)

tests/integration/
└── process-router.test.ts   # NEW - Integration tests
```

Alignment with unified project structure:
- Router location follows existing pattern (`src/server/api/routers/`)
- Service types follow existing pattern (`src/server/services/{domain}/types.ts`)

### References

- [Source: docs/tech-spec-epic-2.md#APIs-and-Interfaces] - tRPC procedures and input schemas
- [Source: docs/tech-spec-epic-2.md#Data-Models-and-Contracts] - ProcessConfig interface
- [Source: docs/architecture.md#tRPC-Patterns] - tRPC patterns and conventions
- [Source: docs/architecture.md#Permission-Checking-Patterns] - Tenant isolation patterns
- [Source: docs/testing-strategy-mvp.md] - Testing patterns for routers
- [Source: docs/stories/2-0-development-seed-data.md#File-List] - Factory patterns

## Dev Agent Record

### Context Reference

- `docs/stories/2-1-intelligence-definition-data-model.context.xml`

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Implemented tRPC router following existing apiKey router pattern
- Used AJV package for JSON Schema Draft 7 validation
- All procedures use protectedProcedure with tenant isolation via ctx.session.user.tenantId
- Comprehensive integration test suite with 51 tests covering all ACs

### Completion Notes List

- **Process Router Implementation**: Created complete CRUD router at `src/server/api/routers/process.ts` with 7 procedures (list, get, create, update, duplicate, delete, restore)
- **ProcessConfig Types**: Created TypeScript interfaces in `src/server/services/process/types.ts` with default values
- **JSON Schema Validation**: Added AJV package dependency for validating inputSchema/outputSchema as valid JSON Schema Draft 7
- **Audit Logging**: All mutation operations (create, update, duplicate, delete, restore) fire audit logs using fire-and-forget pattern
- **Tenant Isolation**: All procedures enforce tenant isolation via session context, tested with explicit isolation tests
- **Integration Tests**: 51 comprehensive tests covering all ACs including tenant isolation, soft delete, input validation, and audit logging

### File List

**New Files:**
- `src/server/api/routers/process.ts` - Process tRPC router with CRUD operations
- `src/server/services/process/types.ts` - ProcessConfig, ComponentDefinition, AttributeDefinition interfaces
- `tests/integration/process-router.test.ts` - 51 integration tests for process router

**Modified Files:**
- `src/server/api/root.ts` - Added processRouter to appRouter
- `package.json` - Added ajv dependency

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-26 | SM Agent (Bob) | Initial story creation from Epic 2 tech spec |
| 2025-11-26 | Dev Agent (Amelia) | Implemented process router with all CRUD procedures, types, and 51 integration tests |
| 2025-11-26 | Dev Agent (Amelia) | Senior Developer Review completed - APPROVED |

---

## Senior Developer Review (AI)

### Reviewer
Zac (via Dev Agent - Amelia)

### Date
2025-11-26

### Outcome
**APPROVE** - All acceptance criteria implemented with comprehensive test coverage. Implementation follows architectural patterns and security requirements.

### Summary
Story 2.1 delivers a complete tRPC router for intelligence definition CRUD operations. The implementation demonstrates excellent adherence to the tech spec, proper tenant isolation, comprehensive Zod input validation with JSON Schema Draft 7 support via AJV, and fire-and-forget audit logging. All 11 acceptance criteria are fully satisfied with 51 integration tests providing thorough coverage.

### Key Findings

**No HIGH or MEDIUM severity issues found.**

**LOW Severity:**
- Note: The File List in Dev Agent Record mentions `src/server/services/process/index.ts` was planned but not created - this is acceptable as service layer logic is currently inlined in the router (appropriate for MVP complexity level)

### Acceptance Criteria Coverage

| AC# | Description | Status | Evidence |
|-----|-------------|--------|----------|
| 1 | Process Router Exists | ✅ IMPLEMENTED | `src/server/api/routers/process.ts:167-634` |
| 2 | List Procedure | ✅ IMPLEMENTED | `process.ts:173-239` - tenant filtering, search, status filter, updatedAt ordering |
| 3 | Get Procedure | ✅ IMPLEMENTED | `process.ts:246-285` - includes versions, computed fields, NOT_FOUND handling |
| 4 | Create Procedure | ✅ IMPLEMENTED | `process.ts:292-368` - transaction, proc_*/procv_* IDs, SANDBOX env, v1.0.0 |
| 5 | Update Procedure | ✅ IMPLEMENTED | `process.ts:375-438` - partial updates only for provided fields |
| 6 | Duplicate Procedure | ✅ IMPLEMENTED | `process.ts:445-527` - deep copy, "(Copy)" suffix, new SANDBOX version |
| 7 | Delete Procedure | ✅ IMPLEMENTED | `process.ts:534-580` - soft delete with deletedAt timestamp |
| 8 | Tenant Isolation | ✅ IMPLEMENTED | All procedures use `ctx.session.user.tenantId`, tested in isolation tests |
| 9 | Input Validation | ✅ IMPLEMENTED | `process.ts:122-165` - Zod schemas for all inputs |
| 10 | Audit Logging | ✅ IMPLEMENTED | Fire-and-forget pattern for create/update/duplicate/delete/restore |
| 11 | JSON Schema Validation | ✅ IMPLEMENTED | `process.ts:22-48` - AJV validation for Draft 7 compliance |

**Summary: 11 of 11 acceptance criteria fully implemented**

### Task Completion Validation

| Task | Marked As | Verified As | Evidence |
|------|-----------|-------------|----------|
| Task 1: Create process router structure | ✅ Complete | ✅ VERIFIED | `process.ts` exists, registered in `root.ts:18` |
| Task 2: Implement Zod schemas | ✅ Complete | ✅ VERIFIED | `process.ts:44-165` - all schemas implemented |
| Task 3: Implement list procedure | ✅ Complete | ✅ VERIFIED | `process.ts:173-239` - filtering, search, ordering |
| Task 4: Implement get procedure | ✅ Complete | ✅ VERIFIED | `process.ts:246-285` - versions included |
| Task 5: Implement create procedure | ✅ Complete | ✅ VERIFIED | `process.ts:292-368` - transaction, defaults |
| Task 6: Implement update procedure | ✅ Complete | ✅ VERIFIED | `process.ts:375-438` - partial updates |
| Task 7: Implement duplicate procedure | ✅ Complete | ✅ VERIFIED | `process.ts:445-527` - deep copy |
| Task 8: Implement delete procedure | ✅ Complete | ✅ VERIFIED | `process.ts:534-580` - soft delete |
| Task 9: Add restore procedure | ✅ Complete | ✅ VERIFIED | `process.ts:587-633` - clears deletedAt |
| Task 10: Write integration tests | ✅ Complete | ✅ VERIFIED | `process-router.test.ts` - 51 tests passing |
| Task 11: Verification | ✅ Complete | ✅ VERIFIED | typecheck: 0 errors, lint: 0 errors (4 warnings in other files), tests: 102 unit + 134 integration passing |

**Summary: 11 of 11 completed tasks verified, 0 questionable, 0 false completions**

### Test Coverage and Gaps

**Tests Present:**
- 51 integration tests covering all CRUD operations
- Tenant isolation explicitly tested for all procedures
- Unauthenticated request rejection tested
- JSON Schema validation tested (valid and invalid)
- Soft delete and restore cycle tested
- Audit log creation verified for all mutations
- Input validation edge cases (empty name, long name, invalid schema)

**Test Quality:** Excellent - follows Arrange-Act-Assert pattern, uses factories, proper assertions

**No significant test gaps identified.**

### Architectural Alignment

- ✅ Uses `protectedProcedure` for all endpoints (per architecture.md)
- ✅ Tenant isolation via session context (per architecture.md Permission Checking Patterns)
- ✅ Resource-based router naming (`processRouter`)
- ✅ ID prefixes: `proc_*` and `procv_*` (per architecture.md ID Format)
- ✅ Fire-and-forget audit logging pattern
- ✅ Soft delete with `deletedAt` column
- ✅ JSON columns for schemas stored as Prisma Json type

### Security Notes

- ✅ No SQL injection risk - Prisma parameterized queries
- ✅ Tenant isolation enforced - all queries filter by tenantId from session
- ✅ Input validation via Zod prevents malformed data
- ✅ JSON Schema validation prevents invalid schema structures
- ✅ No sensitive data exposure in error messages

### Best-Practices and References

- [tRPC Documentation](https://trpc.io/docs) - Router patterns followed correctly
- [Zod Documentation](https://zod.dev/) - Schema validation implemented per best practices
- [AJV Documentation](https://ajv.js.org/) - JSON Schema Draft 7 validation
- Architecture follows T3 stack conventions as documented in architecture.md

### Action Items

**Code Changes Required:**
None - implementation is complete and correct.

**Advisory Notes:**
- Note: Consider adding `src/server/services/process/index.ts` service layer in future if business logic grows beyond simple CRUD
- Note: The tech spec mentions a `categories` field on Process but it's not in the actual Prisma schema - this was correctly identified in Story 2.0 learnings and implementation aligns with actual schema
