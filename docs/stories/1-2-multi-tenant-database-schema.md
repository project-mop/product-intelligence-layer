# Story 1.2: Multi-Tenant Database Schema

Status: done

## Story

As a **platform operator**,
I want **a database schema that isolates tenant data**,
So that **no customer can access another customer's data**.

## Acceptance Criteria

1. Tenants table exists with unique identifiers using `ten_` prefix
2. All tenant-scoped tables have `tenantId` foreign key
3. Row-level security strategy is documented (implementation in future story)
4. All tables have audit timestamp columns (`createdAt`, `updatedAt`)
5. Database migrations run successfully against local PostgreSQL
6. Core entity models match architecture.md data architecture specification

## Tasks / Subtasks

- [x] **Task 1: Create Tenant Model** (AC: 1, 4)
  - [x] Add Tenant model with `id` (ten_* prefix), `name`, `createdAt`, `updatedAt`, `deletedAt`
  - [x] Create ID generation utility in `src/lib/id.ts` with prefix support

- [x] **Task 2: Update User Model for Multi-Tenancy** (AC: 2, 4)
  - [x] Add `tenantId` foreign key to User model
  - [x] Establish relation between User and Tenant

- [x] **Task 3: Create Core Tenant-Scoped Models** (AC: 2, 4, 6)
  - [x] Create Process model with tenant isolation
  - [x] Create ProcessVersion model with environment enum
  - [x] Create ApiKey model with scopes and key_hash
  - [x] Create CallLog model for request logging
  - [x] Create ResponseCache model with TTL
  - [x] Create RateLimit model for quota tracking
  - [x] Remove placeholder Post model from T3 scaffold

- [x] **Task 4: Define Enums and Indexes** (AC: 6)
  - [x] Create Environment enum (SANDBOX, PRODUCTION)
  - [x] Add indexes on frequently queried columns (tenantId, inputHash, expiresAt)

- [x] **Task 5: Verify Schema** (AC: 5)
  - [x] Run `pnpm prisma db push` successfully
  - [x] Run `pnpm prisma generate` to update client
  - [x] Verify no TypeScript errors with `pnpm typecheck`

- [x] **Task 6: Document RLS Strategy** (AC: 3)
  - [x] Document PostgreSQL RLS approach for future implementation
  - [x] Note that application-level filtering is MVP approach

## Dev Notes

### Technical Context

This story implements the data architecture from `docs/architecture.md` section "Data Architecture > Core Entities".

**Key Design Decisions:**

1. **Prefixed IDs:** All entities use self-documenting prefixes (`ten_`, `usr_`, `proc_`, etc.) per architecture spec
2. **Soft Deletes:** Use `deletedAt` timestamp pattern for recoverable deletes
3. **JSON Columns:** Flexible schema storage for `inputSchema`, `outputSchema`, `config`, `scopes`
4. **Tenant Isolation:** Every tenant-scoped table has `tenantId` FK

**Covered FRs:**
- FR-801: Isolated prompt logic (via tenantId on Process)
- FR-802: Isolated config stores (via tenantId on all entities)
- FR-806: No cross-tenant access (via foreign keys and future RLS)

### RLS Implementation Note

PostgreSQL Row-Level Security (RLS) provides database-level enforcement of tenant isolation. For MVP, we use application-level filtering (all queries include `tenantId` in WHERE clause). RLS can be added as a defense-in-depth layer without schema changes. See `docs/rls-strategy.md` for full documentation.

### References

- [Source: docs/architecture.md#Data-Architecture]
- [Source: docs/architecture.md#ID-Format]
- [Source: docs/epics.md#Story-1.2]

## Dev Agent Record

### Context Reference

- `docs/stories/1-2-multi-tenant-database-schema.context.xml`

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Removed placeholder Post model from T3 scaffold, updated page.tsx and post.tsx components
- ID generation utility uses crypto.randomBytes for secure random generation

### Completion Notes List

- Created comprehensive multi-tenant Prisma schema with 10 models
- Implemented ID generation utility with typed prefix support
- Created Environment enum for SANDBOX/PRODUCTION environments
- Added strategic indexes for performance on frequently queried columns
- Documented RLS strategy for future security hardening
- Updated T3 scaffold components to remove Post model dependencies

### File List

- NEW: src/lib/id.ts (ID generation utility)
- NEW: docs/rls-strategy.md (RLS implementation guide)
- MODIFIED: prisma/schema.prisma (complete multi-tenant schema)
- MODIFIED: src/server/api/routers/post.ts (removed Post-related procedures)
- MODIFIED: src/app/_components/post.tsx (simplified to HelloMessage/SecretMessage)
- MODIFIED: src/app/page.tsx (updated for new components)

## Test Verification Record

**Test Date:** 2025-11-25
**Tested By:** TEA (Master Test Architect)

### Test Results

| Test | Command | Result |
|------|---------|--------|
| TypeScript Compilation | `pnpm typecheck` | ✅ PASS - Zero errors |
| ESLint | `pnpm lint` | ✅ PASS - Zero warnings |
| Prisma Schema Sync | `pnpm prisma db push` | ✅ PASS - Database in sync |
| Production Build | `pnpm build` | ✅ PASS - Compiled successfully |

### Acceptance Criteria Verification

| AC | Description | Status |
|----|-------------|--------|
| 1 | Tenants table with `ten_` prefix | ✅ Verified in schema |
| 2 | All tenant-scoped tables have `tenantId` FK | ✅ Verified in schema |
| 3 | RLS strategy documented | ✅ See `docs/rls-strategy.md` |
| 4 | Audit timestamps on all tables | ✅ Verified in schema |
| 5 | Migrations run successfully | ✅ `prisma db push` successful |
| 6 | Models match architecture spec | ✅ Verified against `architecture.md` |

### Notes

- Build warning about Next.js ESLint plugin is cosmetic (ESLint 9 flat config compatibility)
- Database schema is in sync with Prisma schema
- All 10 models created with proper tenant isolation
