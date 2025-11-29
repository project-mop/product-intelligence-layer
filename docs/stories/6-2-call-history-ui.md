# Story 6.2: Call History UI

Status: Complete

## Story

As a **user**,
I want **to view call history for my intelligences in the dashboard**,
So that **I can monitor usage and debug issues**.

## Acceptance Criteria

1. Given I select an intelligence, when I click "Call History" or navigate to the logs tab, then I see a table of recent calls with: timestamp, status, latency, truncated input/output (FR-408)
2. Given I click on a specific call, when the detail view opens, then I see full input, full output, all metadata
3. I can filter by: date range, status (success/error), latency threshold
4. Pagination handles large result sets efficiently using cursor-based pagination
5. Real-time updates for new calls via optional manual refresh button
6. Call history table shows: timestamp, status code indicator (color-coded), latency, model used, cached indicator
7. Detail view shows: full request/response JSON with syntax highlighting, copy buttons for input/output
8. Empty state shows helpful message when no calls exist for a process
9. Error state shows clear message when data fails to load with retry option
10. Loading states show skeleton UI while data is being fetched

## Tasks / Subtasks

- [ ] **Task 1: Create call history page route** (AC: 1, 8)
  - [ ] Create `src/app/(dashboard)/dashboard/processes/[id]/logs/page.tsx`:
    - Page component that loads process and displays call history
    - Breadcrumb navigation: Dashboard > Processes > {Process Name} > Call History
    - Handle process not found case (redirect to 404)
  - [ ] Add navigation link to call history from process detail page
  - [ ] Create `src/app/(dashboard)/dashboard/processes/[id]/logs/loading.tsx` for skeleton UI

- [ ] **Task 2: Create CallHistoryTable component** (AC: 1, 4, 6)
  - [ ] Create `src/components/callLog/CallHistoryTable.tsx`:
    ```typescript
    interface CallHistoryTableProps {
      processId: string;
      initialFilters?: CallLogFilters;
    }

    interface CallLogFilters {
      startDate?: Date;
      endDate?: Date;
      statusCode?: number;
      minLatencyMs?: number;
    }
    ```
  - [ ] Use shadcn Table component with sortable columns
  - [ ] Columns: Timestamp, Status, Latency, Model, Cached, Actions
  - [ ] Status column: color-coded badges (green=2xx, yellow=4xx, red=5xx)
  - [ ] Latency column: formatted as "245ms" with color coding (green <500ms, yellow <2s, red >=2s)
  - [ ] Cached column: badge icon if response was cached
  - [ ] Truncated input/output preview on hover (using Tooltip)
  - [ ] "View Details" action button per row

- [ ] **Task 3: Implement cursor-based pagination** (AC: 4)
  - [ ] Create pagination controls component `src/components/callLog/CallLogPagination.tsx`
  - [ ] Use `api.callLog.list` with cursor parameter
  - [ ] Show "Load More" button pattern (not numbered pages)
  - [ ] Display total count if available, or "Showing X logs"
  - [ ] Handle reaching end of data gracefully

- [ ] **Task 4: Create filter controls** (AC: 3)
  - [ ] Create `src/components/callLog/CallLogFilters.tsx`:
    - Date range picker (using shadcn DateRangePicker or similar)
    - Status filter dropdown: All, Success (2xx), Client Error (4xx), Server Error (5xx)
    - Latency threshold input: "Show calls slower than X ms"
  - [ ] Filters update URL query params for shareable links
  - [ ] Apply filters to `api.callLog.list` query
  - [ ] Show active filter count badge
  - [ ] Clear all filters button

- [ ] **Task 5: Create call detail modal/sheet** (AC: 2, 7)
  - [ ] Create `src/components/callLog/CallLogDetail.tsx`:
    - Use shadcn Sheet (slide-in panel) for detail view
    - Load full log via `api.callLog.get`
  - [ ] Display sections:
    - Header: Timestamp, Status Code, Latency, Model, Cached
    - Request Input: JSON with syntax highlighting
    - Response Output: JSON with syntax highlighting
    - Error Details: Show errorCode and errorMessage if present
    - Metadata: Process ID, Version ID, Input Hash
  - [ ] Add copy buttons for input and output JSON
  - [ ] Use `react-syntax-highlighter` or similar for JSON formatting

- [ ] **Task 6: Add refresh functionality** (AC: 5)
  - [ ] Add "Refresh" button to table header
  - [ ] Show last refreshed timestamp
  - [ ] Implement refetch using tRPC query invalidation
  - [ ] Show subtle loading indicator during refresh

- [ ] **Task 7: Create empty and error states** (AC: 8, 9, 10)
  - [ ] Empty state component:
    - Icon, message: "No calls yet"
    - CTA: Link to API documentation or test endpoint
  - [ ] Error state component:
    - Error message display
    - Retry button
  - [ ] Loading skeleton:
    - Table skeleton with 5-10 rows
    - Animate with pulse effect

- [ ] **Task 8: Add stats summary header** (AC: 1)
  - [ ] Create `src/components/callLog/CallLogStats.tsx`:
    - Use `api.callLog.stats` query
    - Display: Total calls, Success rate %, Avg latency
    - Last 7 days by default (configurable)
    - Small inline charts if time permits (optional)

- [ ] **Task 9: Write unit tests for components** (AC: all)
  - [ ] Create `tests/unit/components/callLog/CallHistoryTable.test.tsx`:
    - Test: Renders table with mock data
    - Test: Status badges show correct colors
    - Test: Latency is formatted correctly
    - Test: Cached indicator shows for cached responses
    - Test: Click row opens detail modal
  - [ ] Create `tests/unit/components/callLog/CallLogFilters.test.tsx`:
    - Test: Filters render correctly
    - Test: Date range picker works
    - Test: Status filter changes query
    - Test: Clear filters resets all values
  - [ ] Create `tests/unit/components/callLog/CallLogDetail.test.tsx`:
    - Test: Displays all log fields
    - Test: JSON is syntax highlighted
    - Test: Copy buttons work (navigator.clipboard mock)

- [ ] **Task 10: Write integration tests** (AC: 1-4)
  - [ ] Add "Story 6.2: Call History UI" describe block to `tests/integration/call-log-router.test.ts`:
    - Test: list returns logs for authenticated user
    - Test: list respects date range filters
    - Test: list respects status code filter
    - Test: list pagination works with cursor
    - Test: get returns full log detail
    - Test: stats returns correct aggregations
    - Test: Tenant isolation - cannot see other tenant's logs

- [ ] **Task 11: Add navigation and integration** (AC: 1)
  - [ ] Add "Call History" tab/link to process detail page
  - [ ] Add route to dashboard navigation if showing global logs view
  - [ ] Ensure back navigation works correctly

- [ ] **Task 12: Verification** (AC: 1-10)
  - [ ] Run `pnpm typecheck` - zero errors
  - [ ] Run `pnpm lint` - zero new errors
  - [ ] Run `pnpm test:unit` - all tests pass
  - [ ] Run `pnpm test:integration` - Story 6.2 tests pass
  - [ ] Run `pnpm build` - production build succeeds
  - [ ] Manual verification:
    - [ ] Navigate to process → Call History
    - [ ] Table shows recent calls with correct formatting
    - [ ] Click row → detail sheet opens with full data
    - [ ] Apply date filter → table updates
    - [ ] Apply status filter → table updates
    - [ ] Pagination loads more results
    - [ ] Refresh button fetches new data
    - [ ] Empty state displays when no logs
    - [ ] Error state displays on API failure

## Dev Notes

**BEFORE WRITING TESTS:** Review testing strategy → `/docs/testing-strategy-mvp.md`
- Unit tests for React components with RTL
- Integration tests for tRPC router (already in Story 6.1)
- 50% coverage minimum for MVP

### Technical Context

This story builds the UI for viewing call logs created by Story 6.1. The backend infrastructure (CallLog model, callLog service, callLog tRPC router) is already complete.

**From PRD - FR-408:**
> FR-408: View call history in UI

**Key Components to Build:**
- Call history page at `/dashboard/processes/[id]/logs`
- Table component with filtering and pagination
- Detail view (slide-in sheet)
- Stats summary header

### Learnings from Previous Story

**From Story 6.1: Call Logging Infrastructure (Status: completed)**

- **CallLog model**: Already exists in `prisma/schema.prisma` with all required fields
- **callLog service**: `src/server/services/callLog/call-log-service.ts` provides `logCallAsync` and `logCallSync`
- **callLog tRPC router**: `src/server/api/routers/callLog.ts` provides:
  - `list`: Paginated list with cursor, filtering by processId, date range, statusCode
  - `get`: Full detail of single log
  - `stats`: Aggregated stats by status code with totals
- **Test factory**: `tests/support/factories/call-log.factory.ts` available for creating test data

**Key Patterns Established:**
- Cursor-based pagination pattern in `list` procedure
- Tenant isolation via `ctx.session.user.tenantId`
- Date range filtering with `gte`/`lte`

[Source: stories/6-1-call-logging-infrastructure.md#Dev-Agent-Record]

### Project Structure Notes

**Files to create:**

```
src/app/(dashboard)/dashboard/processes/[id]/logs/
├── page.tsx                                    # Call history page
└── loading.tsx                                 # Skeleton loader

src/components/callLog/
├── CallHistoryTable.tsx                        # Main table component
├── CallLogFilters.tsx                          # Filter controls
├── CallLogPagination.tsx                       # Pagination controls
├── CallLogDetail.tsx                           # Detail sheet/modal
├── CallLogStats.tsx                            # Stats summary header
├── CallLogEmptyState.tsx                       # Empty state
└── CallLogErrorState.tsx                       # Error state

tests/unit/components/callLog/
├── CallHistoryTable.test.tsx                   # Table tests
├── CallLogFilters.test.tsx                     # Filter tests
└── CallLogDetail.test.tsx                      # Detail view tests
```

**Files to modify:**

```
src/app/(dashboard)/dashboard/processes/[id]/page.tsx  # Add link to logs
tests/integration/call-log-router.test.ts              # Add Story 6.2 tests (if needed)
```

### UI Component Specifications

**CallHistoryTable Columns:**

| Column | Width | Content | Sorting |
|--------|-------|---------|---------|
| Timestamp | 180px | Relative time (e.g., "2 min ago") with full date tooltip | Default desc |
| Status | 80px | Badge: 200 (green), 4xx (yellow), 5xx (red) | Yes |
| Latency | 100px | "245ms" with color coding | Yes |
| Model | 150px | Model name or "—" if null | No |
| Cached | 60px | Check icon if true | No |
| Actions | 80px | "View" button | No |

**Status Code Color Mapping:**

```typescript
const statusColors = {
  success: "bg-green-100 text-green-800",  // 2xx
  redirect: "bg-blue-100 text-blue-800",   // 3xx
  clientError: "bg-yellow-100 text-yellow-800", // 4xx
  serverError: "bg-red-100 text-red-800",  // 5xx
};
```

**Latency Color Thresholds:**

```typescript
const latencyColors = {
  fast: "text-green-600",    // < 500ms
  moderate: "text-yellow-600", // 500ms - 2000ms
  slow: "text-red-600",      // >= 2000ms
};
```

### shadcn/ui Components to Use

Install/verify these components are available:
- `Table` - Main table structure
- `Badge` - Status indicators
- `Button` - Actions and filters
- `Sheet` - Detail slide-in panel
- `DatePicker` or `Calendar` - Date range filtering
- `Select` - Status filter dropdown
- `Input` - Latency threshold input
- `Skeleton` - Loading states
- `Tooltip` - Hover information
- `ScrollArea` - JSON content scrolling

### Dependencies

**NPM packages (may need to install):**
- `date-fns` - Date formatting (likely already installed)
- `react-syntax-highlighter` - JSON syntax highlighting

**Internal dependencies:**
- `api.callLog.list` - tRPC query
- `api.callLog.get` - tRPC query
- `api.callLog.stats` - tRPC query

### Security Considerations

- All queries are tenant-scoped via `ctx.session.user.tenantId`
- Input/output data may contain sensitive customer information
- No data export functionality in this story (that's Story 6.4)

### References

- [Source: docs/architecture.md#Data-Architecture] - call_logs schema
- [Source: docs/epics.md#Story-6.2-Call-History-UI] - Epic story definition
- [Source: docs/testing-strategy-mvp.md] - Testing patterns
- [Source: stories/6-1-call-logging-infrastructure.md] - Previous story (backend)
- [Source: src/server/api/routers/callLog.ts] - Existing tRPC router

## Dev Agent Record

### Context Reference

- docs/stories/6-2-call-history-ui.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Code Review Record

### Review Date: 2025-11-29

### Reviewer: Dev Agent (Amelia)

### Review Outcome: ✅ APPROVED

### AC Validation Summary

| AC | Description | Status |
|----|-------------|--------|
| AC 1 | Table with timestamp, status, latency | ✅ PASS |
| AC 2 | Detail view shows full input/output | ✅ PASS |
| AC 3 | Filter by date range, status, latency | ✅ PASS |
| AC 4 | Cursor-based pagination | ✅ PASS |
| AC 5 | Manual refresh button | ✅ PASS |
| AC 6 | Status/latency color-coded | ✅ PASS |
| AC 7 | JSON syntax highlighting, copy buttons | ✅ PASS |
| AC 8 | Empty state | ✅ PASS |
| AC 9 | Error state with retry | ✅ PASS |
| AC 10 | Loading skeleton UI | ✅ PASS |

### Test Results

- Unit tests: 37 passed, 1 skipped (documented Radix/React 19 JSDOM issue)
- Integration tests: Story 6.2 tests present in call-log-router.test.ts
- TypeScript: Compiles without errors

### Code Quality Notes

**Strengths:**
- Clean component architecture with single responsibility
- Full TypeScript type safety
- AC traceability via JSDoc comments
- URL state sync for shareable filtered views
- Comprehensive test coverage

**Minor Observations:**
- Task checkboxes not marked complete (cosmetic)
- CallLogPagination.tsx not created separately - pagination integrated into CallHistoryTable (acceptable simplification)

### Files Reviewed

```
src/app/dashboard/processes/[id]/logs/page.tsx
src/app/dashboard/processes/[id]/logs/loading.tsx
src/components/callLog/CallHistoryTable.tsx
src/components/callLog/CallLogFilters.tsx
src/components/callLog/CallLogDetail.tsx
src/components/callLog/CallLogStats.tsx
src/components/callLog/CallLogEmptyState.tsx
src/components/callLog/CallLogErrorState.tsx
src/components/callLog/CallLogSkeleton.tsx
tests/unit/components/callLog/*.test.tsx
tests/integration/call-log-router.test.ts
```

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-29 | SM Agent | Initial story creation from Epic 6 |
| 2025-11-29 | Dev Agent | Code review completed - APPROVED |
