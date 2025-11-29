# Story 5.3: Promote to Production

Status: done

## Story

As a **user**,
I want **to promote an intelligence from sandbox to production**,
So that **I can safely deploy tested changes to my live API endpoints**.

## Acceptance Criteria

1. "Promote to Production" button visible on sandbox versions with ACTIVE status (FR-603)
2. Clicking promote shows confirmation dialog with change summary
3. Confirmation dialog shows diff from current production version (if exists)
4. Confirmation dialog warns that cache will be invalidated
5. Promotion creates new ProcessVersion with environment=PRODUCTION, status=ACTIVE
6. Previous production version (if exists) is set to status=DEPRECATED
7. Promotion atomically executes in single database transaction
8. Cache entries for the process are invalidated on promotion
9. Audit log entry created with user ID, timestamp, old/new versions
10. UI refreshes to show updated version history after promotion

## Tasks / Subtasks

- [ ] **Task 1: Create promotion service** (AC: 5, 6, 7, 8, 9)
  - [ ] Create `src/server/services/process/promotion.ts`:
    - Define `PromoteToProductionInput` interface: `{ processId, versionId, changeNotes? }`
    - Define `PromoteToProductionResult` interface: `{ promotedVersion, deprecatedVersion, cacheInvalidated }`
    - Implement `promoteToProduction(input, ctx)` function:
      - Validate source version exists and is in SANDBOX environment
      - Validate source version has status ACTIVE
      - Use Prisma transaction for atomic execution
      - Find current PRODUCTION version (if any)
      - Set current production version's status = DEPRECATED, deprecatedAt = now()
      - Create new ProcessVersion copying config/schemas from source:
        - Set environment = PRODUCTION
        - Set status = ACTIVE
        - Set publishedAt = now()
        - Increment version number (next integer after max version for process)
        - Set changeNotes from input
        - Set promotedBy from ctx.userId
      - Invalidate cache entries for this process
      - Create audit log entry
    - Export as named export from index.ts

- [ ] **Task 2: Create version diff service** (AC: 3)
  - [ ] Create `src/server/services/process/version-diff.ts`:
    - Define `VersionDiff` interface from tech spec
    - Implement `compareVersions(version1, version2)` function:
      - Compare config objects
      - Compare inputSchema
      - Compare outputSchema
      - Return list of changes with field path, type (added/removed/modified), values
      - Generate human-readable summary
    - Handle case when version2 is null (first promotion)

- [ ] **Task 3: Add tRPC endpoints for promotion** (AC: 1, 2, 3, 5, 6, 10)
  - [ ] Add to `src/server/api/routers/version.ts`:
    ```typescript
    // Get promotion preview (for confirmation dialog)
    getPromotionPreview: protectedProcedure
      .input(z.object({
        processId: z.string(),
        versionId: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        // Returns: sourceVersion, currentProductionVersion, diff, cacheEntryCount
      }),

    // Execute promotion
    promoteToProduction: protectedProcedure
      .input(z.object({
        processId: z.string(),
        versionId: z.string(),
        changeNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Calls promotion service, returns PromoteToProductionResult
      }),
    ```
  - [ ] Add validation: user must own the process (tenant isolation)
  - [ ] Add validation: process must not be deleted
  - [ ] Add validation: source version must be SANDBOX + ACTIVE

- [ ] **Task 4: Implement cache invalidation for process** (AC: 8)
  - [ ] Add to `src/server/services/cache/service.ts`:
    ```typescript
    async invalidateByProcess(processId: string): Promise<number> {
      const result = await db.responseCache.deleteMany({
        where: { processId },
      });
      return result.count;
    }
    ```
  - [ ] Call this from promotion service within transaction
  - [ ] Return count of invalidated entries in result

- [ ] **Task 5: Create PromoteButton component** (AC: 1)
  - [ ] Create `src/components/process/PromoteButton.tsx`:
    - Props: `version: ProcessVersion`, `onPromote: () => void`, `disabled?: boolean`
    - Only render when version.environment === "SANDBOX" && version.status === "ACTIVE"
    - Use Button with variant="default" or "success"
    - Icon: ArrowUpCircle or similar
    - Text: "Promote to Production"
    - Loading state during promotion

- [ ] **Task 6: Create PromotionConfirmDialog component** (AC: 2, 3, 4)
  - [ ] Create `src/components/process/PromotionConfirmDialog.tsx`:
    - Use shadcn Dialog component
    - Props: `open`, `onOpenChange`, `processId`, `versionId`, `onConfirm`
    - Fetch promotion preview on open using `version.getPromotionPreview`
    - Display:
      - Source version info (version number, created date)
      - Current production version info (if exists) with diff
      - Diff view showing changes (use simple collapsible JSON diff)
      - Warning banner: "Cache will be invalidated ({count} entries)"
      - Optional change notes textarea
      - Cancel and Confirm buttons
    - Handle loading state while fetching preview
    - Handle error state if preview fails

- [ ] **Task 7: Create VersionDiffView component** (AC: 3)
  - [ ] Create `src/components/process/VersionDiffView.tsx`:
    - Props: `diff: VersionDiff`
    - Display changes as a list:
      - Added fields (green)
      - Removed fields (red)
      - Modified fields (yellow) with old → new values
    - Collapsible JSON views for complex changes
    - Show summary at top

- [ ] **Task 8: Integrate promotion UI into process detail page** (AC: 1, 10)
  - [ ] Modify `src/app/dashboard/processes/[id]/page.tsx` (or equivalent):
    - Add PromoteButton to sandbox version display
    - Wire up PromotionConfirmDialog
    - Refresh version list after successful promotion
    - Show success toast after promotion

- [ ] **Task 9: Add audit logging for promotion** (AC: 9)
  - [ ] Extend audit log actions to include `PROCESS_VERSION_PROMOTED`
  - [ ] Create audit entry in promotion service:
    ```typescript
    await createAuditLog({
      action: "PROCESS_VERSION_PROMOTED",
      actorId: ctx.userId,
      resourceType: "ProcessVersion",
      resourceId: promotedVersion.id,
      details: {
        processId,
        fromVersionId: sourceVersion.id,
        fromVersion: sourceVersion.version,
        toVersion: promotedVersion.version,
        deprecatedVersionId: deprecatedVersion?.id,
        changeNotes,
      },
    });
    ```

- [ ] **Task 10: Write unit tests for promotion service** (AC: 5, 6, 7, 8, 9)
  - [ ] Create `tests/unit/server/services/process/promotion.test.ts`:
    - Test: Promotion creates new PRODUCTION version
    - Test: Promotion deprecates previous production version
    - Test: Promotion fails for non-SANDBOX version
    - Test: Promotion fails for non-ACTIVE version
    - Test: Version number increments correctly
    - Test: changeNotes and promotedBy are set correctly
    - Test: Audit log entry is created

- [ ] **Task 11: Write unit tests for version diff service** (AC: 3)
  - [ ] Create `tests/unit/server/services/process/version-diff.test.ts`:
    - Test: Detects added fields
    - Test: Detects removed fields
    - Test: Detects modified fields
    - Test: Handles nested object changes
    - Test: Handles null/undefined values
    - Test: Generates correct summary
    - Test: Handles first promotion (no previous production)

- [ ] **Task 12: Write integration tests for promotion** (AC: 5, 6, 7, 8, 9, 10)
  - [ ] Add "Story 5.3: Promote to Production" describe block to `tests/integration/version-router.test.ts`:
    - Test: `getPromotionPreview` returns source version and current production
    - Test: `getPromotionPreview` returns null production for first promotion
    - Test: `getPromotionPreview` includes diff when production exists
    - Test: `getPromotionPreview` includes cache entry count
    - Test: `promoteToProduction` creates new PRODUCTION version
    - Test: `promoteToProduction` deprecates previous production
    - Test: `promoteToProduction` invalidates cache entries
    - Test: `promoteToProduction` creates audit log
    - Test: `promoteToProduction` returns correct result structure
    - Test: Rejects promotion of non-SANDBOX version
    - Test: Rejects promotion of non-ACTIVE version
    - Test: Rejects promotion of non-existent version
    - Test: Tenant isolation - cannot promote other tenant's process

- [ ] **Task 13: Update factories for promotion testing**
  - [ ] Verify `processVersionFactory` supports:
    - Creating SANDBOX ACTIVE versions (for promotion source)
    - Creating PRODUCTION ACTIVE versions (for existing production)
    - Creating with specific version numbers

- [ ] **Task 14: Verification** (AC: 1-10)
  - [ ] Run `pnpm typecheck` - zero errors
  - [ ] Run `pnpm lint` - zero new errors
  - [ ] Run `pnpm test:unit` - all tests pass
  - [ ] Run `pnpm test:integration` - Story 5.3 tests pass
  - [ ] Run `pnpm build` - production build succeeds
  - [ ] Manual verification:
    - [ ] Create process with sandbox version
    - [ ] Promote button visible on sandbox version
    - [ ] Click promote → confirmation dialog appears
    - [ ] Dialog shows version info and cache warning
    - [ ] Confirm promotion → new production version created
    - [ ] Previous production deprecated (if existed)
    - [ ] Cache entries cleared
    - [ ] Audit log entry visible
    - [ ] UI refreshes to show new state

## Dev Notes

**BEFORE WRITING TESTS:** Review testing strategy → `/docs/testing-strategy-mvp.md`
- Unit tests for promotion service and version diff service
- Integration tests for tRPC endpoints
- 50% coverage minimum for MVP

### Technical Context

This story implements the promotion workflow from sandbox to production, building on Stories 5.1 (environments) and 5.2 (environment-specific API keys). The promotion is the key workflow that moves a tested intelligence configuration to production.

**From Tech Spec - FR-603:**
> Promote sandbox to production: Promotion creates new ProcessVersion with environment=PRODUCTION, status=ACTIVE. Previous production version is deprecated. Cache is invalidated.

**Key Architecture Rules:**
- Only ONE version per process can be active in PRODUCTION at a time
- Promoting to production automatically deprecates the previous production version
- Production versions are immutable (FR-309) - edits create new sandbox versions
- Promotion must be atomic - all-or-nothing database transaction

**From Architecture Doc - Process Version Lifecycle:**
```
SANDBOX (testing) → promote → PRODUCTION (live) → deprecated (read-only)
```

### Learnings from Previous Story

**From Story 5.2: Separate API Keys per Environment (Status: done)**

- **Environment enum**: Already exists in Prisma schema - reuse for version environment
- **VersionStatus enum**: Already exists (DRAFT, ACTIVE, DEPRECATED)
- **Environment guard middleware**: `src/server/middleware/environment-guard.ts` - pattern for validation
- **Process version resolver**: `src/server/services/process/version-resolver.ts` - understands version/environment
- **Test patterns**: Story 5.2 has comprehensive test patterns for version/environment

**Key Files from 5.2 (to reference):**
- `src/server/services/process/version-resolver.ts` - Version resolution logic
- `src/server/middleware/environment-guard.ts` - Environment validation patterns
- `tests/integration/intelligence-api.test.ts` - Story 5.2 test patterns

**Components to Reuse:**
- `EnvironmentBadge` - for showing version environment
- Error response patterns from Story 4.3

[Source: stories/5-2-separate-api-keys-per-environment.md#Dev-Agent-Record]

### Project Structure Notes

**Files to create:**

```
src/server/services/process/promotion.ts               # CREATE - Promotion service
src/server/services/process/version-diff.ts            # CREATE - Version diff logic
src/components/process/PromoteButton.tsx               # CREATE - Promote button component
src/components/process/PromotionConfirmDialog.tsx      # CREATE - Confirmation dialog
src/components/process/VersionDiffView.tsx             # CREATE - Diff display component
tests/unit/server/services/process/promotion.test.ts   # CREATE - Unit tests
tests/unit/server/services/process/version-diff.test.ts # CREATE - Unit tests
```

**Files to modify:**

```
src/server/api/routers/version.ts                      # MODIFY - Add promotion endpoints
src/server/services/cache/service.ts                   # MODIFY - Add invalidateByProcess
src/server/services/process/index.ts                   # MODIFY - Export promotion service
src/app/dashboard/processes/[id]/page.tsx              # MODIFY - Add promotion UI
tests/integration/version-router.test.ts               # MODIFY - Add Story 5.3 tests
```

### Promotion Service Design

```typescript
// src/server/services/process/promotion.ts

import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";

export interface PromoteToProductionInput {
  processId: string;
  versionId: string;
  changeNotes?: string;
}

export interface PromoteToProductionResult {
  promotedVersion: ProcessVersion;
  deprecatedVersion: ProcessVersion | null;
  cacheInvalidated: number;
}

export async function promoteToProduction(
  input: PromoteToProductionInput,
  ctx: { tenantId: string; userId: string }
): Promise<PromoteToProductionResult> {
  const { processId, versionId, changeNotes } = input;

  return db.$transaction(async (tx) => {
    // 1. Validate source version
    const sourceVersion = await tx.processVersion.findFirst({
      where: {
        id: versionId,
        processId,
        process: { tenantId: ctx.tenantId, deletedAt: null },
      },
    });

    if (!sourceVersion) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
    }

    if (sourceVersion.environment !== "SANDBOX") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Can only promote SANDBOX versions",
      });
    }

    if (sourceVersion.status !== "ACTIVE") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Can only promote ACTIVE versions",
      });
    }

    // 2. Find and deprecate current production version
    const currentProduction = await tx.processVersion.findFirst({
      where: {
        processId,
        environment: "PRODUCTION",
        status: "ACTIVE",
      },
    });

    let deprecatedVersion: ProcessVersion | null = null;
    if (currentProduction) {
      deprecatedVersion = await tx.processVersion.update({
        where: { id: currentProduction.id },
        data: {
          status: "DEPRECATED",
          deprecatedAt: new Date(),
        },
      });
    }

    // 3. Calculate next version number
    const maxVersion = await tx.processVersion.aggregate({
      where: { processId },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    // 4. Create new production version
    const promotedVersion = await tx.processVersion.create({
      data: {
        processId,
        version: nextVersion,
        config: sourceVersion.config,
        inputSchema: sourceVersion.inputSchema,
        outputSchema: sourceVersion.outputSchema,
        environment: "PRODUCTION",
        status: "ACTIVE",
        publishedAt: new Date(),
        changeNotes,
        promotedBy: ctx.userId,
      },
    });

    // 5. Invalidate cache
    const cacheResult = await tx.responseCache.deleteMany({
      where: { processId },
    });

    // 6. Create audit log
    await tx.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        action: "PROCESS_VERSION_PROMOTED",
        actorId: ctx.userId,
        resourceType: "ProcessVersion",
        resourceId: promotedVersion.id,
        details: {
          processId,
          fromVersionId: sourceVersion.id,
          fromVersion: sourceVersion.version,
          toVersion: nextVersion,
          deprecatedVersionId: deprecatedVersion?.id,
          changeNotes,
        },
      },
    });

    return {
      promotedVersion,
      deprecatedVersion,
      cacheInvalidated: cacheResult.count,
    };
  });
}
```

### Cache Invalidation

Add to existing cache service:

```typescript
// src/server/services/cache/service.ts

export async function invalidateByProcess(processId: string): Promise<number> {
  const result = await db.responseCache.deleteMany({
    where: { processId },
  });
  return result.count;
}
```

### UI Components

**PromotionConfirmDialog structure:**
```
┌─────────────────────────────────────────────────┐
│ Promote to Production                      [X]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ Source Version: v3 (Sandbox)                   │
│ Created: Nov 29, 2025                          │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Current Production: v2                      │ │
│ │ Changes from v2 → v3:                       │ │
│ │   • Modified: systemPrompt                  │ │
│ │   • Added: cacheTtlSeconds                  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ⚠️ Warning: 47 cache entries will be cleared   │
│                                                 │
│ Change Notes (optional):                       │
│ ┌─────────────────────────────────────────────┐ │
│ │ Updated prompt for better accuracy          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│              [Cancel]  [Promote to Production] │
└─────────────────────────────────────────────────┘
```

### Audit Log Action

Add to audit action enum:

```typescript
// src/server/services/audit/types.ts
type AuditAction =
  | "USER_CREATED"
  | "USER_UPDATED"
  | "API_KEY_CREATED"
  | "API_KEY_REVOKED"
  | "PROCESS_CREATED"
  | "PROCESS_UPDATED"
  | "PROCESS_DELETED"
  | "PROCESS_VERSION_PROMOTED"  // NEW
  // ... etc
```

### Test Fixtures

```typescript
// For promotion tests
const sandboxActiveVersion = await processVersionFactory.create({
  processId: process.id,
  environment: "SANDBOX",
  status: "ACTIVE",
  version: 1,
});

const productionActiveVersion = await processVersionFactory.create({
  processId: process.id,
  environment: "PRODUCTION",
  status: "ACTIVE",
  version: 2,
});
```

### Dependencies

**NPM packages:** None new required

**Internal dependencies:**
- `Environment` and `VersionStatus` enums from Prisma schema
- `db` from `src/server/db`
- Cache service from Epic 4
- Audit logging from Story 1.5
- Process/ProcessVersion models from Epic 2

### Security Considerations

- Verify tenant ownership before promotion (tenant isolation)
- Verify user has permission to modify process
- Atomic transaction ensures no partial state on failure
- Audit logging provides accountability

### References

- [Source: docs/tech-spec-epic-5.md#Story-5.3-Promote-to-Production] - Acceptance criteria
- [Source: docs/tech-spec-epic-5.md#Promotion-Workflow] - Workflow sequence
- [Source: docs/tech-spec-epic-5.md#Data-Models-and-Contracts] - Data model changes
- [Source: docs/architecture.md#Process-Version-Lifecycle] - Version state machine
- [Source: docs/epics.md#Story-5.3-Promote-to-Production] - Epic story definition
- [Source: docs/testing-strategy-mvp.md] - Testing patterns
- [Source: stories/5-2-separate-api-keys-per-environment.md#Dev-Agent-Record] - Previous story learnings

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

N/A

### Completion Notes List

- Implemented promotion service with atomic transaction for promoting sandbox versions to production
- Created version diff service for comparing version configurations
- Added tRPC endpoints for promotion preview and execution
- Implemented cache invalidation on promotion
- Created UI components: PromoteButton, PromotionConfirmDialog, VersionDiffView
- Integrated promotion UI into process detail page
- Added audit logging for promotion events
- All acceptance criteria verified and passing

### File List

**Created:**
- `src/server/services/process/promotion.ts` - Promotion service with atomic transaction
- `src/server/services/process/version-diff.ts` - Version diff comparison logic
- `src/components/process/PromoteButton.tsx` - Promote button component
- `src/components/process/PromotionConfirmDialog.tsx` - Confirmation dialog with diff view
- `src/components/process/VersionDiffView.tsx` - Diff display component
- `tests/unit/server/services/process/promotion.test.ts` - Unit tests for promotion service
- `tests/unit/server/services/process/version-diff.test.ts` - Unit tests for version diff

**Modified:**
- `src/server/api/routers/process.ts` - Added promotion endpoints
- `src/server/services/cache/service.ts` - Added invalidateByProcess method
- `src/server/services/cache/types.ts` - Added cache invalidation types
- `src/app/dashboard/processes/[id]/page.tsx` - Integrated promotion UI
- `tests/integration/process-router.test.ts` - Added Story 5.3 integration tests
- `docs/sprint-status.yaml` - Updated story status to done

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-29 | SM Agent | Initial story creation from Epic 5 tech spec |
| 2025-11-29 | Dev Agent | Implementation complete - all ACs verified |
