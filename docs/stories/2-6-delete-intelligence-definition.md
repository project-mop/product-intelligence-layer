# Story 2.6: Delete Intelligence Definition

Status: done

## Story

As a **user**,
I want **to delete intelligence definitions I no longer need**,
So that **I can keep my workspace clean and organized**.

## Acceptance Criteria

1. **Delete Action Available**: "Delete" action is available on each intelligence card dropdown menu
2. **Confirmation Dialog**: Delete requires typing the exact intelligence name to confirm (prevents accidental deletion)
3. **Soft Delete Implementation**: Delete sets `deletedAt` timestamp (soft delete) rather than permanently removing the record
4. **List Exclusion**: Deleted intelligences are hidden from the default list view (excluded by `deletedAt: null` filter)
5. **Undo Toast**: After deletion, a toast notification appears with a 10-second undo option
6. **Undo Functionality**: If undo is clicked within 10 seconds, `deletedAt` is cleared and the intelligence is restored to visibility
7. **Future API Warning**: Intelligences with associated API endpoints show a warning before deletion (placeholder for Epic 3 - currently shows informational warning)

## Tasks / Subtasks

- [x] **Task 1: Add Delete Action to Intelligence Card** (AC: 1)
  - [x] Add "Delete" item to dropdown menu in `src/app/dashboard/processes/page.tsx`
  - [x] Add Trash icon from lucide-react
  - [x] Wire click handler to open delete confirmation dialog
  - [x] Style delete action with destructive/red variant
  - [x] Ensure delete action is accessible via keyboard navigation

- [x] **Task 2: Create Delete Confirmation Dialog Component** (AC: 2)
  - [x] Create `src/components/process/DeleteDialog.tsx` component
  - [x] Include text input for typing intelligence name to confirm
  - [x] Show intelligence name prominently for user reference
  - [x] Validate that typed name exactly matches (case-sensitive)
  - [x] Disable Delete button until name matches exactly
  - [x] Include Cancel and Delete buttons (Delete styled as destructive)
  - [x] Show loading state during deletion
  - [x] Show warning message about deletion consequences

- [x] **Task 3: Implement process.delete tRPC Mutation** (AC: 3, 4)
  - [x] Add `delete` mutation to `src/server/api/routers/process.ts`
  - [x] Input schema: `{ id: string }`
  - [x] Set `deletedAt` to current timestamp (soft delete)
  - [x] Ensure tenant isolation (only delete own processes)
  - [x] Return success response with deleted process info
  - Note: Already implemented in previous story (Story 2.5 prep)

- [x] **Task 4: Create Audit Log Entry** (AC: 3)
  - [x] Add audit log entry with action="process.deleted"
  - [x] Include processId in metadata for traceability
  - [x] Follow fire-and-forget pattern (non-blocking)
  - Note: Already implemented in process.delete mutation

- [x] **Task 5: Implement Undo Toast with Restore** (AC: 5, 6)
  - [x] On successful deletion, show toast with "Undo" action button
  - [x] Set toast duration to 10 seconds (10000ms)
  - [x] Implement undo click handler that calls restore mutation
  - [x] On undo success, refresh the process list

- [x] **Task 6: Implement process.restore tRPC Mutation** (AC: 6)
  - [x] Add `restore` mutation to `src/server/api/routers/process.ts`
  - [x] Input schema: `{ id: string }`
  - [x] Clear `deletedAt` timestamp (set to null)
  - [x] Ensure tenant isolation (only restore own processes)
  - [x] Add audit log entry with action="process.restored"
  - [x] Return restored process
  - Note: Already implemented in previous story (Story 2.5 prep)

- [x] **Task 7: Add API Warning in Delete Dialog** (AC: 7)
  - [x] Check if process has any associated ProcessVersions with SANDBOX or PRODUCTION status
  - [x] If published versions exist, show warning: "This intelligence has published API endpoints that will be disabled."
  - [x] Warning is informational only for MVP (actual endpoint disabling is Epic 3)

- [x] **Task 8: Write Tests** (AC: 1-7)
  - [x] Integration tests for `process.delete` mutation
    - [x] Test successful soft delete (deletedAt set)
    - [x] Test tenant isolation (cannot delete other tenant's process)
    - [x] Test 404 for non-existent process
    - [x] Test audit log entry created
  - [x] Integration tests for `process.restore` mutation
    - [x] Test successful restore (deletedAt cleared)
    - [x] Test tenant isolation (cannot restore other tenant's process)
    - [x] Test 404 for non-existent process
    - [x] Test audit log entry created
  - [x] Note: Unit tests for DeleteDialog deferred per MVP 50% coverage guidance
  - Note: Integration tests already exist from previous implementation

- [x] **Task 9: Verification** (AC: 1-7)
  - [x] Run `pnpm typecheck` - zero errors
  - [x] Run `pnpm lint` - zero new errors
  - [x] Run `pnpm test:unit` - all tests pass (212 tests)
  - [x] Run `pnpm test:integration` - all tests pass (105 tests)
  - [x] Run `pnpm build` - production build succeeds

## Dev Notes

**BEFORE WRITING TESTS:** Review testing strategy at `/docs/testing-strategy-mvp.md`
- Integration tests for delete/restore mutations via tRPC caller
- 50% coverage minimum for MVP

### Technical Context

This story implements the delete functionality for intelligence definitions. It uses soft delete (setting `deletedAt` timestamp) rather than permanent deletion, allowing for recovery within the 30-day retention period and supporting the undo feature.

**Key Architecture Decisions:**
- ADR-003: tRPC for internal dashboard operations (type-safe end-to-end)
- Soft delete pattern: Set `deletedAt` timestamp, never permanently delete in user actions
- List queries already filter by `deletedAt: null` (established in Story 2.1)
- 30-day retention before hard delete (handled by future pg-boss cleanup job)

### Delete Flow

From `tech-spec-epic-2.md`:

```
1. User clicks "Delete" on intelligence card
2. Modal: "Type the intelligence name to confirm"
3. User types name exactly
4. Server: delete mutation
   - Set deletedAt timestamp (soft delete)
   - Disable associated API endpoints (Epic 3)
5. Write AuditLog: "process.deleted"
6. Toast: "Intelligence deleted" with 10s undo option
7. If undo clicked:
   - Server: restore mutation
   - Clear deletedAt
   - Write AuditLog: "process.restored"
```

### tRPC Procedures Required

| Procedure | Type | Input | Output | Notes |
|-----------|------|-------|--------|-------|
| `process.delete` | mutation | `{id}` | `{success, process}` | NEW - soft delete |
| `process.restore` | mutation | `{id}` | `{process}` | NEW - undo soft delete |

### Learnings from Previous Story

**From Story 2.5: Duplicate Intelligence Definition (Status: done)**

- **DuplicateDialog pattern**: `src/components/process/DuplicateDialog.tsx` - follow this pattern for DeleteDialog (React Hook Form + Zod + shadcn Dialog)
- **Dropdown menu pattern**: `src/app/dashboard/processes/page.tsx:173-178` - follow this pattern for Delete action
- **Process router patterns**: `src/server/api/routers/process.ts` - duplicate mutation shows tenant isolation pattern
- **Toast notifications**: Uses sonner toast via shadcn - see `DuplicateDialog.tsx:73` for success toast pattern
- **Audit logging**: Fire-and-forget pattern at `process.ts:556-567`
- **Test patterns**: Integration tests at `tests/integration/process-router.test.ts`

**Files to Reuse:**
- `src/app/dashboard/processes/page.tsx` - Add Delete to dropdown (follow Duplicate pattern)
- `src/server/api/routers/process.ts` - Add delete/restore mutations
- `src/components/ui/dialog.tsx` - Base dialog component
- `src/components/ui/input.tsx` - Name confirmation input field
- `src/components/ui/button.tsx` - Action buttons (use destructive variant for Delete)

**Patterns to Follow:**
- Dropdown menu item pattern from Duplicate action
- tRPC mutation pattern from duplicate (tenant isolation with `ctx.tenantId`)
- Audit log pattern from existing mutations
- Integration test pattern from process-router.test.ts
- Toast pattern from DuplicateDialog (sonner)

[Source: docs/stories/2-5-duplicate-intelligence-definition.md#File-List]

### Project Structure Notes

New files to create:

```
src/components/process/
└── DeleteDialog.tsx              # NEW - Delete confirmation dialog with name typing
```

Files to modify:

```
src/app/dashboard/processes/
└── page.tsx                      # ADD Delete action to dropdown menu, state management

src/server/api/routers/
└── process.ts                    # ADD delete and restore mutations

tests/integration/
└── process-router.test.ts        # ADD delete/restore mutation tests
```

### Implementation Notes

**Soft Delete Pattern:**
```typescript
// Delete sets deletedAt timestamp
await db.process.update({
  where: { id: input.id, tenantId: ctx.tenantId },
  data: { deletedAt: new Date() },
});

// Restore clears deletedAt timestamp
await db.process.update({
  where: { id: input.id, tenantId: ctx.tenantId },
  data: { deletedAt: null },
});

// List queries already filter by deletedAt: null
// See process.list procedure
```

**Name Confirmation Pattern:**
```typescript
// Dialog should validate exact match (case-sensitive)
const isNameMatch = typedName === processToDelete.name;
// Delete button disabled until isNameMatch === true
```

**Toast with Undo:**
```typescript
// After successful delete
toast.success("Intelligence deleted", {
  duration: 10000, // 10 seconds
  action: {
    label: "Undo",
    onClick: () => restoreMutation.mutate({ id: deletedProcess.id }),
  },
});
```

### References

- [Source: docs/tech-spec-epic-2.md#Story-2.6-Delete-Intelligence-Definition] - Acceptance criteria
- [Source: docs/tech-spec-epic-2.md#Delete-Intelligence-Flow] - Detailed delete workflow
- [Source: docs/epics.md#Story-2.6-Delete-Intelligence-Definition] - Epic story definition (FR-110)
- [Source: docs/architecture.md#tRPC-Patterns] - tRPC mutation patterns
- [Source: docs/architecture.md#Database-Patterns] - Soft delete pattern
- [Source: docs/testing-strategy-mvp.md] - Testing patterns
- [Source: docs/stories/2-5-duplicate-intelligence-definition.md#File-List] - Previous story files

## Dev Agent Record

### Context Reference

- docs/stories/2-6-delete-intelligence-definition.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Backend delete/restore mutations were already implemented from Story 2.5 preparation
- Integration tests for delete/restore already exist in tests/integration/process-router.test.ts

### Completion Notes List

- Implemented DeleteDialog component following DuplicateDialog pattern
- Added Trash2 icon and destructive styling for Delete dropdown action
- Delete confirmation requires exact case-sensitive name match
- Toast notification with 10-second undo option using sonner
- API warning shown for processes with published versions (informational for MVP)
- All acceptance criteria satisfied

### File List

**New Files:**
- src/components/process/DeleteDialog.tsx

**Modified Files:**
- src/app/dashboard/processes/page.tsx

**Pre-existing (no changes needed):**
- src/server/api/routers/process.ts (delete/restore mutations already implemented)
- tests/integration/process-router.test.ts (delete/restore tests already exist)

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-27 | SM Agent (Bob) | Initial story creation from Epic 2 tech spec |
| 2025-11-27 | Dev Agent (Amelia) | Implemented delete UI (DeleteDialog, dropdown action, undo toast) |
| 2025-11-27 | Dev Agent (Amelia) | Senior Developer Review notes appended |

## Senior Developer Review (AI)

### Reviewer
Zac

### Date
2025-11-27

### Outcome
**APPROVE**

**Justification:** All 7 acceptance criteria are fully implemented with evidence. All 9 tasks are verified complete. All tests pass (212 unit + 105 integration). Type checking passes with zero errors. Production build succeeds. Code follows established patterns and architecture. No security vulnerabilities identified.

### Summary

Story 2.6 implements delete functionality for intelligence definitions using soft delete pattern. The implementation includes:
- Delete action in dropdown menu with Trash2 icon and destructive styling
- Confirmation dialog requiring exact name match (case-sensitive)
- 10-second toast with undo capability via restore mutation
- API warning for processes with published versions
- Comprehensive integration test coverage

### Key Findings

No HIGH, MEDIUM, or LOW severity issues found. Implementation is clean and follows all established patterns.

### Acceptance Criteria Coverage

| AC# | Description | Status | Evidence |
|-----|-------------|--------|----------|
| AC1 | Delete Action Available | IMPLEMENTED | `page.tsx:184-190` - Delete DropdownMenuItem with Trash2 icon |
| AC2 | Confirmation Dialog | IMPLEMENTED | `DeleteDialog.tsx:146-161` - Exact case-sensitive name match required |
| AC3 | Soft Delete Implementation | IMPLEMENTED | `process.ts:605-608` - Sets deletedAt timestamp |
| AC4 | List Exclusion | IMPLEMENTED | `process.ts:229-232` - deletedAt: null filter in list query |
| AC5 | Undo Toast | IMPLEMENTED | `DeleteDialog.tsx:93-101` - Toast with 10000ms duration |
| AC6 | Undo Functionality | IMPLEMENTED | `DeleteDialog.tsx:110-118` - restore mutation clears deletedAt |
| AC7 | Future API Warning | IMPLEMENTED | `DeleteDialog.tsx:137-144` - Alert for SANDBOX/PRODUCTION versions |

**Summary: 7 of 7 acceptance criteria fully implemented**

### Task Completion Validation

| Task | Marked As | Verified As | Evidence |
|------|-----------|-------------|----------|
| Task 1: Add Delete Action | Complete | VERIFIED | `page.tsx:184-190` |
| Task 2: Create DeleteDialog | Complete | VERIFIED | `DeleteDialog.tsx:1-185` |
| Task 3: process.delete mutation | Complete | VERIFIED | `process.ts:577-623` |
| Task 4: Audit Log Entry | Complete | VERIFIED | `process.ts:610-620` |
| Task 5: Undo Toast | Complete | VERIFIED | `DeleteDialog.tsx:93-101` |
| Task 6: process.restore mutation | Complete | VERIFIED | `process.ts:630-676` |
| Task 7: API Warning | Complete | VERIFIED | `DeleteDialog.tsx:73-85, 137-144` |
| Task 8: Tests | Complete | VERIFIED | `process-router.test.ts:790-1005` |
| Task 9: Verification | Complete | VERIFIED | All commands pass |

**Summary: 9 of 9 completed tasks verified, 0 questionable, 0 falsely marked complete**

### Test Coverage and Gaps

- **Integration Tests:** 11 tests for delete/restore mutations (6 delete + 5 restore)
- **Test Coverage:** delete mutation, restore mutation, tenant isolation, 404 handling, audit logging
- **Unit Tests:** DeleteDialog unit tests deferred per MVP 50% coverage guidance (acceptable)

### Architectural Alignment

- Follows ADR-003: tRPC for internal dashboard operations
- Follows soft delete pattern from architecture.md
- Uses established patterns from DuplicateDialog
- Proper tenant isolation in all mutations

### Security Notes

- Tenant isolation properly implemented (all queries filter by tenantId from session)
- Input validation via Zod schemas
- No SQL injection risk (Prisma parameterized queries)
- No XSS risk (React escaping)

### Best-Practices and References

- React Hook Form + Zod pattern: https://react-hook-form.com/get-started#SchemaValidation
- sonner toast API: https://sonner.emilkowal.ski/
- Soft delete pattern: Standard industry practice for recoverable deletes

### Action Items

**Code Changes Required:**
None - story is approved with no required changes.

**Advisory Notes:**
- Note: Consider adding E2E tests for the complete delete/undo flow when Playwright coverage is expanded
- Note: The 30-day hard delete cleanup job (pg-boss) is planned for future implementation
