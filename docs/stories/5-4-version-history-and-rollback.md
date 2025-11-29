# Story 5.4: Version History and Rollback

Status: done

## Story

As a **user**,
I want **to view version history and roll back to previous versions**,
So that **I can recover from bad deployments and track changes over time**.

## Acceptance Criteria

1. Version history page accessible from process detail view (FR-302)
2. Version history shows list with: version number, date, environment, status, change notes
3. Each version row shows "Current" badge if it's the active version for its environment
4. Clicking a version shows full configuration details
5. "Compare" button allows selecting two versions for side-by-side diff
6. Diff view highlights: added fields (green), removed fields (red), modified fields (yellow)
7. "Restore this version" button available on any non-current version (FR-305)
8. Rollback creates new sandbox version copying config from target version (FR-309)
9. Rollback sets changeNotes to "Restored from version X"
10. Version numbers auto-increment (never reuse numbers)

## Tasks / Subtasks

- [x] **Task 1: Create version history tRPC endpoints** (AC: 1, 2, 3, 4)
  - [ ] Add to `src/server/api/routers/version.ts`:
    ```typescript
    // Get version history for a process
    getHistory: protectedProcedure
      .input(z.object({
        processId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        // Returns VersionHistoryEntry[] with computed fields
      }),

    // Get single version details with full config
    getVersionDetails: protectedProcedure
      .input(z.object({
        processId: z.string(),
        versionId: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        // Returns full ProcessVersion with config, schemas
      }),
    ```
  - [ ] Implement tenant isolation: verify user owns the process
  - [ ] Compute `isCurrent`, `canPromote`, `canRollback` fields for each entry
  - [ ] Order versions by version number descending (newest first)

- [x] **Task 2: Create version diff service** (AC: 5, 6) - REUSED from Story 5.3
  - [ ] Create `src/server/services/process/version-diff.ts`:
    ```typescript
    export interface VersionDiff {
      version1: number;
      version2: number;
      changes: DiffChange[];
      summary: string;
    }

    export interface DiffChange {
      field: string;       // Dot notation path (e.g., "config.systemPrompt")
      type: "added" | "removed" | "modified";
      oldValue?: unknown;
      newValue?: unknown;
    }

    export function compareVersions(
      v1: ProcessVersion,
      v2: ProcessVersion
    ): VersionDiff {
      // Deep compare config, inputSchema, outputSchema
      // Return list of changes with field paths
    }
    ```
  - [ ] Handle nested object comparison for config objects
  - [ ] Handle array differences (inputSchema, outputSchema fields)
  - [ ] Generate human-readable summary (e.g., "3 fields modified, 1 added")
  - [ ] Handle null/undefined values correctly

- [x] **Task 3: Add version diff tRPC endpoint** (AC: 5)
  - [ ] Add to version router:
    ```typescript
    diff: protectedProcedure
      .input(z.object({
        processId: z.string(),
        version1Id: z.string(),
        version2Id: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        // Load both versions, call compareVersions
        // Returns VersionDiff
      }),
    ```
  - [ ] Validate both versions belong to the same process
  - [ ] Validate user has access to the process

- [x] **Task 4: Create rollback service** (AC: 7, 8, 9, 10)
  - [ ] Create `src/server/services/process/rollback.ts`:
    ```typescript
    export interface RollbackInput {
      processId: string;
      targetVersionId: string;
      changeNotes?: string;
    }

    export interface RollbackResult {
      newVersion: ProcessVersion;
      sourceVersion: ProcessVersion;
    }

    export async function rollbackToVersion(
      input: RollbackInput,
      ctx: { tenantId: string; userId: string }
    ): Promise<RollbackResult> {
      // 1. Load target version
      // 2. Calculate next version number
      // 3. Create new sandbox version copying config/schemas
      // 4. Set status = ACTIVE, environment = SANDBOX
      // 5. Deprecate previous sandbox version (if any)
      // 6. Create audit log entry
      // 7. Return new version
    }
    ```
  - [ ] Auto-generate changeNotes if not provided: "Restored from version X"
  - [ ] Execute in transaction for atomicity
  - [ ] Never modify or delete the source version (immutable history)

- [x] **Task 5: Add rollback tRPC endpoint** (AC: 7, 8)
  - [ ] Add to version router:
    ```typescript
    rollback: protectedProcedure
      .input(z.object({
        processId: z.string(),
        targetVersionId: z.string(),
        changeNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Calls rollback service
        // Returns RollbackResult
      }),
    ```
  - [ ] Validate user owns the process
  - [ ] Validate target version exists and belongs to process
  - [ ] Validate target version is not already the current sandbox version

- [x] **Task 6: Create VersionHistory page component** (AC: 1, 2, 3)
  - [ ] Create `src/app/dashboard/processes/[id]/versions/page.tsx`:
    - Fetch version history using `version.getHistory`
    - Display table with columns: Version, Environment, Status, Created, Change Notes
    - Show "Current" badge for active versions per environment
    - Add pagination for processes with many versions
    - Link to process detail page breadcrumb

- [x] **Task 7: Create VersionHistoryTable component** (AC: 2, 3)
  - [ ] Create `src/components/process/VersionHistoryTable.tsx`:
    - Props: `versions: VersionHistoryEntry[]`, `onSelect`, `onCompare`, `onRollback`
    - Display version number prominently
    - Environment badge (sandbox=yellow, production=green)
    - Status badge (active=green, deprecated=gray, draft=blue)
    - "Current" indicator for active versions
    - Row click expands to show change notes
    - Action buttons: View Details, Compare, Restore

- [x] **Task 8: Create VersionDetailDrawer component** (AC: 4)
  - [ ] Create `src/components/process/VersionDetailDrawer.tsx`:
    - Props: `version: ProcessVersion`, `open`, `onClose`
    - Display full version configuration:
      - Version number and timestamps
      - Environment and status
      - System prompt (collapsible, syntax highlighted)
      - Input schema (JSON viewer)
      - Output schema (JSON viewer)
      - Change notes
      - Promoted by (if applicable)
    - Actions: Compare with..., Restore, Close

- [x] **Task 9: Create VersionCompareDialog component** (AC: 5, 6)
  - [ ] Create `src/components/process/VersionCompareDialog.tsx`:
    - Props: `processId`, `version1Id`, `version2Id`, `open`, `onClose`
    - Fetch diff using `version.diff`
    - Side-by-side layout showing both versions
    - Highlight changes with colors:
      - Added fields: green background
      - Removed fields: red background
      - Modified fields: yellow background with old→new values
    - Show summary at top: "X added, Y removed, Z modified"
    - Allow swapping version1 and version2

- [x] **Task 10: Create VersionDiffView component** (AC: 6) - REUSED from Story 5.3
  - [ ] Create `src/components/process/VersionDiffView.tsx`:
    - Props: `diff: VersionDiff`
    - Group changes by section (config, inputSchema, outputSchema)
    - Show field path with type indicator
    - Collapsible JSON views for complex values
    - Use monospace font for values

- [x] **Task 11: Create RollbackConfirmDialog component** (AC: 7, 8, 9)
  - [ ] Create `src/components/process/RollbackConfirmDialog.tsx`:
    - Props: `version`, `open`, `onConfirm`, `onCancel`
    - Show warning: "This will create a new sandbox version based on v{X}"
    - Explain: "You can test in sandbox, then promote to production"
    - Optional change notes textarea (pre-filled with "Restored from version X")
    - Cancel and Confirm buttons
    - Loading state during rollback

- [x] **Task 12: Integrate version history into process detail page** (AC: 1)
  - [ ] Modify `src/app/dashboard/processes/[id]/page.tsx`:
    - Add "Version History" tab or link
    - Show mini version indicator (e.g., "v3 sandbox, v2 production")
    - Quick link to full version history page

- [x] **Task 13: Add audit logging for rollback** (AC: 8)
  - [ ] Extend audit log actions to include `PROCESS_VERSION_ROLLBACK`
  - [ ] Create audit entry in rollback service:
    ```typescript
    await createAuditLog({
      action: "PROCESS_VERSION_ROLLBACK",
      actorId: ctx.userId,
      resourceType: "ProcessVersion",
      resourceId: newVersion.id,
      details: {
        processId,
        sourceVersionId: targetVersion.id,
        sourceVersion: targetVersion.version,
        newVersion: newVersion.version,
        changeNotes,
      },
    });
    ```

- [x] **Task 14: Write unit tests for version diff service** (AC: 5, 6) - Already done in Story 5.3
  - [ ] Create `tests/unit/server/services/process/version-diff.test.ts`:
    - Test: Detects added fields in config
    - Test: Detects removed fields in config
    - Test: Detects modified fields in config
    - Test: Handles nested object changes correctly
    - Test: Handles array differences in schemas
    - Test: Handles null/undefined values
    - Test: Generates correct summary text
    - Test: Returns empty changes for identical versions

- [x] **Task 15: Write unit tests for rollback service** (AC: 7, 8, 9, 10)
  - [ ] Create `tests/unit/server/services/process/rollback.test.ts`:
    - Test: Creates new sandbox version from target
    - Test: Copies config and schemas exactly
    - Test: Sets environment to SANDBOX, status to ACTIVE
    - Test: Increments version number correctly
    - Test: Sets default changeNotes when not provided
    - Test: Uses custom changeNotes when provided
    - Test: Deprecates previous sandbox version (if exists)
    - Test: Creates audit log entry
    - Test: Rejects rollback to non-existent version
    - Test: Tenant isolation - cannot rollback other tenant's versions

- [x] **Task 16: Write integration tests for version history** (AC: 1-10)
  - [ ] Add "Story 5.4: Version History and Rollback" describe block to `tests/integration/version-router.test.ts`:
    - Test: `getHistory` returns all versions for process
    - Test: `getHistory` orders by version descending
    - Test: `getHistory` includes computed fields (isCurrent, canPromote, canRollback)
    - Test: `getHistory` respects pagination
    - Test: `getVersionDetails` returns full config
    - Test: `diff` returns changes between two versions
    - Test: `diff` handles first version (no previous)
    - Test: `rollback` creates new sandbox version
    - Test: `rollback` preserves source version unchanged
    - Test: `rollback` deprecates old sandbox version
    - Test: `rollback` creates audit log
    - Test: Tenant isolation - cannot view/rollback other tenant's versions

- [x] **Task 17: Update factories for version history testing** - Already sufficient from previous stories
  - [ ] Verify `processVersionFactory` supports:
    - Creating multiple versions for same process
    - Creating versions with different statuses (ACTIVE, DEPRECATED)
    - Creating versions with change notes
    - Creating versions with promotedBy

- [x] **Task 18: Verification** (AC: 1-10)
  - [ ] Run `pnpm typecheck` - zero errors
  - [ ] Run `pnpm lint` - zero new errors
  - [ ] Run `pnpm test:unit` - all tests pass
  - [ ] Run `pnpm test:integration` - Story 5.4 tests pass
  - [ ] Run `pnpm build` - production build succeeds
  - [ ] Manual verification:
    - [ ] Navigate to process → version history shows all versions
    - [ ] Version list shows correct environment/status badges
    - [ ] "Current" badge shows for active versions
    - [ ] Click version → detail drawer opens with full config
    - [ ] Select two versions → compare shows diff correctly
    - [ ] Diff highlights added/removed/modified fields
    - [ ] Click "Restore" on old version → confirmation dialog
    - [ ] Confirm rollback → new sandbox version created
    - [ ] Rollback preserves original version in history
    - [ ] Version numbers increment correctly

## Dev Notes

**BEFORE WRITING TESTS:** Review testing strategy → `/docs/testing-strategy-mvp.md`
- Unit tests for version diff service and rollback service
- Integration tests for tRPC endpoints
- 50% coverage minimum for MVP

### Technical Context

This story implements version history viewing and rollback capabilities, completing the version management features of Epic 5. It builds on Stories 5.1-5.3 which established environment separation and the promotion workflow. The key principle is **immutable version history**: rollback creates a NEW version rather than modifying existing ones.

**From Tech Spec - FR-302, FR-305, FR-309:**
> - FR-302: View version history - list all versions with metadata
> - FR-305: Roll back to previous version - restore config from any historical version
> - FR-309: Immutable versions in production - versions cannot be modified, only deprecated

**Key Architecture Rules:**
- Version numbers are monotonically increasing integers (1, 2, 3...)
- Version numbers are NEVER reused, even after rollback
- Rollback creates a new sandbox version with copied config
- The original version remains unchanged in history
- Production versions are immutable - changes create new sandbox versions

**From Tech Spec - Version Lifecycle:**
```
Rollback Flow:
1. User selects historical version (e.g., v2)
2. System creates new sandbox version (e.g., v5) with v2's config
3. v2 remains unchanged in history
4. User can test v5 in sandbox, then promote to production
```

### Learnings from Previous Story

**From Story 5.3: Promote to Production (Status: done)**

- **Promotion service pattern**: `src/server/services/process/promotion.ts` - follow same transaction and audit log patterns
- **Version diff service**: Already created in 5.3 at `src/server/services/process/version-diff.ts` - REUSE this
- **VersionDiffView component**: Already created in 5.3 at `src/components/process/VersionDiffView.tsx` - REUSE this
- **Process version queries**: Version resolution patterns in `src/server/services/process/version-resolver.ts`
- **UI patterns**: PromotionConfirmDialog pattern for confirmation dialogs
- **Cache invalidation**: `invalidateByProcess` in cache service - may be needed on rollback

**Key Files from 5.3 (to reference/reuse):**
- `src/server/services/process/promotion.ts` - Transaction and audit patterns
- `src/server/services/process/version-diff.ts` - **REUSE** for comparing versions
- `src/components/process/VersionDiffView.tsx` - **REUSE** for diff display
- `src/components/process/PromotionConfirmDialog.tsx` - Pattern for confirmation dialogs
- `tests/integration/process-router.test.ts` - Story 5.3 test patterns

**Components to Reuse:**
- `VersionDiffView` - for showing changes between versions
- `EnvironmentBadge` - for showing version environment
- Dialog patterns from PromotionConfirmDialog

[Source: stories/5-3-promote-to-production.md#Dev-Agent-Record]

### Project Structure Notes

**Files to create:**

```
src/server/services/process/rollback.ts               # CREATE - Rollback service
src/app/dashboard/processes/[id]/versions/page.tsx    # CREATE - Version history page
src/components/process/VersionHistoryTable.tsx        # CREATE - Version list table
src/components/process/VersionDetailDrawer.tsx        # CREATE - Version detail drawer
src/components/process/VersionCompareDialog.tsx       # CREATE - Version comparison dialog
src/components/process/RollbackConfirmDialog.tsx      # CREATE - Rollback confirmation
tests/unit/server/services/process/rollback.test.ts   # CREATE - Rollback unit tests
```

**Files to modify:**

```
src/server/api/routers/version.ts                     # MODIFY - Add history, diff, rollback endpoints
src/server/services/process/index.ts                  # MODIFY - Export rollback service
src/app/dashboard/processes/[id]/page.tsx             # MODIFY - Add version history link
tests/integration/version-router.test.ts              # MODIFY - Add Story 5.4 tests
```

**Files to reuse (from Story 5.3):**

```
src/server/services/process/version-diff.ts           # REUSE - Already exists
src/components/process/VersionDiffView.tsx            # REUSE - Already exists
```

### Rollback Service Design

```typescript
// src/server/services/process/rollback.ts

import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";

export interface RollbackInput {
  processId: string;
  targetVersionId: string;
  changeNotes?: string;
}

export interface RollbackResult {
  newVersion: ProcessVersion;
  sourceVersion: ProcessVersion;
  deprecatedVersion: ProcessVersion | null;
}

export async function rollbackToVersion(
  input: RollbackInput,
  ctx: { tenantId: string; userId: string }
): Promise<RollbackResult> {
  const { processId, targetVersionId, changeNotes } = input;

  return db.$transaction(async (tx) => {
    // 1. Load target version (the one to restore from)
    const targetVersion = await tx.processVersion.findFirst({
      where: {
        id: targetVersionId,
        processId,
        process: { tenantId: ctx.tenantId, deletedAt: null },
      },
    });

    if (!targetVersion) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
    }

    // 2. Find and deprecate current sandbox version (if any)
    const currentSandbox = await tx.processVersion.findFirst({
      where: {
        processId,
        environment: "SANDBOX",
        status: "ACTIVE",
      },
    });

    let deprecatedVersion: ProcessVersion | null = null;
    if (currentSandbox && currentSandbox.id !== targetVersionId) {
      deprecatedVersion = await tx.processVersion.update({
        where: { id: currentSandbox.id },
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

    // 4. Create new sandbox version from target
    const newVersion = await tx.processVersion.create({
      data: {
        processId,
        version: nextVersion,
        config: targetVersion.config,
        inputSchema: targetVersion.inputSchema,
        outputSchema: targetVersion.outputSchema,
        environment: "SANDBOX",
        status: "ACTIVE",
        publishedAt: new Date(),
        changeNotes: changeNotes || `Restored from version ${targetVersion.version}`,
        promotedBy: ctx.userId,
      },
    });

    // 5. Create audit log entry
    await tx.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        action: "PROCESS_VERSION_ROLLBACK",
        actorId: ctx.userId,
        resourceType: "ProcessVersion",
        resourceId: newVersion.id,
        details: {
          processId,
          sourceVersionId: targetVersion.id,
          sourceVersion: targetVersion.version,
          newVersion: nextVersion,
          deprecatedVersionId: deprecatedVersion?.id,
          changeNotes: newVersion.changeNotes,
        },
      },
    });

    return {
      newVersion,
      sourceVersion: targetVersion,
      deprecatedVersion,
    };
  });
}
```

### Version History Types

```typescript
// src/server/services/process/types.ts (extend existing)

export interface VersionHistoryEntry {
  id: string;
  version: number;
  environment: "SANDBOX" | "PRODUCTION";
  status: "DRAFT" | "ACTIVE" | "DEPRECATED";
  createdAt: Date;
  publishedAt: Date | null;
  deprecatedAt: Date | null;
  changeNotes: string | null;
  promotedBy: string | null;

  // Computed fields
  isCurrent: boolean;       // Is this the active version for its environment?
  canPromote: boolean;      // Can be promoted to production?
  canRollback: boolean;     // Can be restored as new version?
}
```

### UI Component Layout

**Version History Page:**
```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Process Detail                                    │
│                                                             │
│ Version History: Product Analyzer                           │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Version │ Environment │ Status │ Created    │ Actions   │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ v5      │ 🟡 Sandbox │ Active │ Nov 29 10:22│ [▼] [↻]  │ │
│ │ v4      │ 🟢 Prod    │ Active │ Nov 29 09:15│ [▼] [↻]  │ │
│ │ v3      │ 🟢 Prod    │ Deprecated│Nov 28    │ [▼] [↻]  │ │
│ │ v2      │ 🟡 Sandbox │ Deprecated│Nov 27    │ [▼] [↻]  │ │
│ │ v1      │ 🟡 Sandbox │ Deprecated│Nov 26    │ [▼] [↻]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Compare Selected]                                          │
└─────────────────────────────────────────────────────────────┘

[▼] = View Details    [↻] = Restore
```

**Version Compare Dialog:**
```
┌─────────────────────────────────────────────────────────────┐
│ Compare Versions                                        [X] │
├─────────────────────────────────────────────────────────────┤
│ v2 (Nov 27)                    v4 (Nov 29)                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Summary: 2 modified, 1 added                                │
│                                                             │
│ config.systemPrompt:                                        │
│ ┌──────────────────────┐  ┌──────────────────────┐         │
│ │ "Analyze products..."│→ │ "Analyze products    │         │
│ │                      │  │  with improved..."   │         │
│ └──────────────────────┘  └──────────────────────┘         │
│                                                             │
│ config.cacheTtlSeconds:                                     │
│   900 → 1800                                                │
│                                                             │
│ config.temperature: (added)                                 │
│   - → 0.3                                                   │
│                                                             │
│                                          [Swap] [Close]     │
└─────────────────────────────────────────────────────────────┘
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
  | "PROCESS_VERSION_PROMOTED"
  | "PROCESS_VERSION_ROLLBACK"  // NEW
  // ... etc
```

### Dependencies

**NPM packages:** None new required (deep-diff optional but not needed)

**Internal dependencies:**
- `Environment` and `VersionStatus` enums from Prisma schema
- `db` from `src/server/db`
- Version diff service from Story 5.3 (reuse)
- Audit logging from Story 1.5
- Process/ProcessVersion models from Epic 2

### Security Considerations

- Verify tenant ownership before showing version history
- Verify user has permission to rollback
- Rollback transaction ensures atomicity
- Audit logging provides accountability
- Original versions remain immutable

### References

- [Source: docs/tech-spec-epic-5.md#Story-5.4-Version-History-and-Rollback] - Acceptance criteria
- [Source: docs/tech-spec-epic-5.md#Rollback-Workflow] - Workflow sequence
- [Source: docs/tech-spec-epic-5.md#Data-Models-and-Contracts] - Data model types
- [Source: docs/architecture.md#Process-Version-Lifecycle] - Version state machine
- [Source: docs/epics.md#Story-5.4-Version-History-and-Rollback] - Epic story definition
- [Source: docs/testing-strategy-mvp.md] - Testing patterns
- [Source: stories/5-3-promote-to-production.md#Dev-Agent-Record] - Previous story learnings

## Dev Agent Record

### Context Reference

- `docs/stories/5-4-version-history-and-rollback.context.xml` - Generated 2025-11-29

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - clean implementation

### Completion Notes List

1. All tRPC endpoints added to process.ts router (getHistory, getVersionDetails, diff, rollback)
2. Rollback service created with proper transaction handling and audit logging
3. All 5 UI components created (page, table, drawer, compare dialog, rollback dialog)
4. Version history link integrated into process detail page
5. 9 unit tests for rollback service (all passing)
6. 24 integration tests for Story 5.4 endpoints (all passing)
7. Reused version-diff service and VersionDiffView component from Story 5.3
8. Added shadcn/ui sheet and checkbox components
9. Typecheck, lint, tests, and build all pass

### File List

**Created:**
- `src/server/services/process/rollback.ts` - Rollback service with transaction and audit
- `src/app/dashboard/processes/[id]/versions/page.tsx` - Version history page
- `src/components/process/VersionHistoryTable.tsx` - Version list with badges
- `src/components/process/VersionDetailDrawer.tsx` - Full version config drawer
- `src/components/process/VersionCompareDialog.tsx` - Side-by-side diff dialog
- `src/components/process/RollbackConfirmDialog.tsx` - Rollback confirmation
- `tests/unit/server/services/process/rollback.test.ts` - Rollback unit tests
- `src/components/ui/sheet.tsx` - shadcn Sheet component
- `src/components/ui/checkbox.tsx` - shadcn Checkbox component

**Modified:**
- `src/server/api/routers/process.ts` - Added getHistory, getVersionDetails, diff, rollback endpoints
- `src/app/dashboard/processes/[id]/page.tsx` - Added "View History" button
- `tests/integration/process-router.test.ts` - Added Story 5.4 test suite (24 tests)

**Reused from Story 5.3:**
- `src/server/services/process/version-diff.ts` - Version comparison logic
- `src/components/process/VersionDiffView.tsx` - Diff display component

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-29 | SM Agent | Initial story creation from Epic 5 tech spec |
| 2025-11-29 | Dev Agent (Claude Opus 4.5) | Implementation complete - all ACs satisfied |
