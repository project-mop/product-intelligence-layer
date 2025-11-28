# Story 3.5: View JSON Schema

Status: done

## Story

As a **developer integrating the API**,
I want **to view the JSON schema for any intelligence**,
So that **I can understand the expected input and output formats for my integration**.

## Acceptance Criteria

1. **Schema Viewer Access**: Schema viewer is accessible from the process detail page (`/dashboard/processes/:id`)
2. **Input Schema Display**: Displays input schema with formatted JSON and syntax highlighting
3. **Output Schema Display**: Displays output schema with formatted JSON and syntax highlighting
4. **Copy Functionality**: One-click copy button for each schema (input and output separately)
5. **Download Option**: Download each schema as a `.json` file with descriptive filename
6. **Field Descriptions**: Schema display includes field descriptions from the process definition
7. **REST API Endpoint**: Public REST endpoint at `/api/v1/intelligence/:processId/schema` returns both schemas

## Tasks / Subtasks

- [x] **Task 1: Create Schema API Endpoint** (AC: 7) - ALREADY IMPLEMENTED
  - [x] Create `src/app/api/v1/intelligence/[processId]/schema/route.ts`
  - [x] Implement GET handler with Bearer token authentication
  - [x] Validate API key using `validateApiKey` from auth service
  - [x] Assert process access using `assertProcessAccess`
  - [x] Load ProcessVersion by processId, tenantId, and environment from API key
  - [x] Return response shape: `{ success: true, data: { processId, name, version, inputSchema, outputSchema } }`
  - [x] Handle 401 (unauthorized), 403 (forbidden), 404 (not found) errors
  - [x] Add request ID tracking in response headers

- [x] **Task 2: Create SchemaViewer Component** (AC: 2, 3, 6)
  - [x] Create `src/components/process/SchemaViewer.tsx`
  - [x] Props: `{ schema: object, title: string, processName: string, schemaType: string }`
  - [x] Use react-syntax-highlighter for JSON syntax highlighting (already installed from Story 3.3)
  - [x] Display schema with proper indentation (2 spaces)
  - [x] Show field descriptions as tooltips with info icon
  - [x] Use shadcn/ui Card component as container
  - [x] Add collapsible sections for nested objects with PropertyNode component

- [x] **Task 3: Create Schema Action Buttons** (AC: 4, 5)
  - [x] Add copy button with clipboard icon using shadcn/ui Button
  - [x] Implement copy to clipboard using `navigator.clipboard.writeText`
  - [x] Show toast notification on successful copy (reuse from Story 3.3)
  - [x] Add download button with download icon
  - [x] Implement download as JSON file with filename format: `{process-name}-{input|output}-schema.json`
  - [x] Use `URL.createObjectURL` and `<a download>` pattern for file download

- [x] **Task 4: Create Schema Page/Tab** (AC: 1, 2, 3)
  - [x] Created dedicated schema page at `src/app/dashboard/processes/[id]/schema/page.tsx`
  - [x] Layout: Side-by-side panels for input (left) and output (right) schemas on desktop
  - [x] Responsive: Stack vertically on mobile using `grid-cols-1 lg:grid-cols-2`
  - [x] Added "Schema" button with FileJson icon to process detail page
  - [x] Load process data via tRPC `process.get` procedure

- [x] **Task 5: Add tRPC Procedure for Dashboard Schema Access** (AC: 1, 2, 3)
  - [x] Reused existing `process.get` which already returns inputSchema and outputSchema
  - [x] Tenant isolation ensured via session context in protectedProcedure

- [x] **Task 6: Write Unit Tests** (AC: 2, 3, 4, 5)
  - [x] Test SchemaViewer renders JSON with syntax highlighting
  - [x] Test copy button calls clipboard API with correct content
  - [x] Test download button triggers file download with correct filename
  - [x] Test field descriptions display when present in schema
  - [x] Test view mode toggle between structured and raw views

- [x] **Task 7: Write Integration Tests** (AC: 7)
  - [x] Test `/api/v1/intelligence/:processId/schema` returns correct schema structure
  - [x] Test endpoint returns 401 for missing/invalid API key
  - [x] Test endpoint returns 403 for API key without process scope
  - [x] Test endpoint returns 404 for non-existent process
  - [x] Test tenant isolation (cannot access other tenant's schemas)
  - [x] Test schema includes all fields from ProcessVersion config

- [x] **Task 8: Write Component Tests** (AC: 1, 2, 3, 4, 5)
  - [x] Created SchemaViewer.test.tsx with 26 tests
  - [x] Test Schema page renders both input and output schemas
  - [x] Test copy and download functionality in component context
  - [x] Test structured vs raw view toggle

- [x] **Task 9: Verification** (AC: 1-7)
  - [x] Run `pnpm typecheck` - zero errors
  - [x] Run `pnpm lint` - zero new errors
  - [x] Run `pnpm test:unit` - all 390 tests pass
  - [x] Run `pnpm test:integration` - all 207 tests pass
  - [x] Run `pnpm build` - production build succeeds

## Dev Notes

**BEFORE WRITING TESTS:** Review testing strategy at `/docs/testing-strategy-mvp.md`
- Unit tests for SchemaViewer component, copy/download utilities
- Integration tests for REST API endpoint with real database
- 50% coverage minimum for MVP

### Technical Context

This story provides developers with the ability to view, copy, and download JSON schemas for intelligences. This is essential for API integration as developers need to understand the expected request and response formats.

**Key Architecture Decisions:**
- REST endpoint for public API access (per ADR-003)
- Bearer token authentication using existing API key infrastructure (Epic 1)
- Reuse syntax highlighting from Story 3.3 (react-syntax-highlighter)
- Dashboard access via tRPC for authenticated users

### API Response Format

From `tech-spec-epic-3.md`:

```
GET /api/v1/intelligence/:processId/schema
Authorization: Bearer key_abc123

Response (200):
{
  "success": true,
  "data": {
    "processId": "proc_abc123",
    "name": "Product Description Generator",
    "version": "1.0.0",
    "inputSchema": { ... },
    "outputSchema": { ... }
  }
}
```

### Schema Display Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ JSON Schema                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────┐  ┌─────────────────────────────────┐   │
│ │ Input Schema        [📋] [⬇️]   │  │ Output Schema       [📋] [⬇️]   │   │
│ ├─────────────────────────────────┤  ├─────────────────────────────────┤   │
│ │ {                               │  │ {                               │   │
│ │   "type": "object",             │  │   "type": "object",             │   │
│ │   "properties": {               │  │   "properties": {               │   │
│ │     "productName": {            │  │     "shortDescription": {       │   │
│ │       "type": "string",         │  │       "type": "string",         │   │
│ │       "description": "..."      │  │       "maxLength": 150          │   │
│ │     },                          │  │     },                          │   │
│ │     ...                         │  │     ...                         │   │
│ │   }                             │  │   }                             │   │
│ │ }                               │  │ }                               │   │
│ └─────────────────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Learnings from Previous Story

**From Story 3.4: Intelligence List Dashboard (Status: done)**

- **shadcn/ui Components**: Card, Badge, Button already in use - reuse for schema viewer
- **Toast Notifications**: Pattern established for copy feedback via shadcn/ui toast
- **tRPC Protected Procedure**: Pattern for session-based tenant isolation
- **Process Router**: `process.get` already returns process details - may include schemas
- **Loading States**: Skeleton components for loading
- **364 Unit Tests, 183 Integration Tests**: Test patterns well established

**Files/Services to Reuse:**
- `src/server/api/routers/process.ts` - Existing process router to extend
- `src/server/services/auth/api-key.ts` - API key validation for REST endpoint
- `src/components/ui/` - shadcn/ui components (Card, Button)
- `src/lib/utils.ts` - cn() utility for class merging
- `tests/support/factories/process.factory.ts` - Process factory for tests
- `tests/support/factories/process-version.factory.ts` - ProcessVersion factory
- `react-syntax-highlighter` - Already installed for JSON highlighting (Story 3.3)

**Patterns to Follow:**
- Use `protectedProcedure` for tRPC dashboard queries
- Filter by `tenantId` from session context
- REST endpoints use `validateApiKey` and `assertProcessAccess`
- Use shadcn/ui components consistently
- Follow existing page layout patterns from dashboard

[Source: docs/stories/3-4-intelligence-list-dashboard.md#Dev-Agent-Record]

### Project Structure Notes

New files to create:

```
src/app/api/v1/intelligence/[processId]/
└── schema/
    └── route.ts                    # NEW - REST schema endpoint

src/components/process/
└── SchemaViewer.tsx                # NEW - Schema viewer component

src/app/(dashboard)/processes/[id]/
└── schema/
    └── page.tsx                    # NEW - Schema page (or add tab to detail page)

tests/unit/
└── components/
    └── SchemaViewer.test.tsx       # NEW - Component tests

tests/integration/
└── schema-endpoint.test.ts         # NEW - REST endpoint tests
```

Files to modify:

```
src/server/api/routers/process.ts   # MODIFY - Add getSchemas procedure if needed
src/app/(dashboard)/processes/[id]/page.tsx  # MODIFY - Add schema navigation/tab
```

### Dependencies

**NPM packages:**
- `react-syntax-highlighter` - Already installed from Story 3.3
- shadcn/ui components: Card, Button (already installed)

**Internal dependencies:**
- Process/ProcessVersion models from Epic 2
- API key validation from Epic 1 (Story 1.4)
- shadcn/ui components from Epic 2
- Toast notifications from Story 3.3
- tRPC router infrastructure from Epic 1

### References

- [Source: docs/tech-spec-epic-3.md#Story-3.5-View-JSON-Schema] - Acceptance criteria
- [Source: docs/tech-spec-epic-3.md#APIs-and-Interfaces] - REST endpoint spec
- [Source: docs/architecture.md#Project-Structure] - File organization
- [Source: docs/architecture.md#Public-API-Patterns] - REST API patterns
- [Source: docs/epics.md#Story-3.5-View-JSON-Schema] - Epic story definition
- [Source: docs/testing-strategy-mvp.md] - Testing patterns

## Dev Agent Record

### Context Reference

- docs/stories/3-5-view-json-schema.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

Implementation plan:
1. Task 1 (Schema API Endpoint) was already implemented prior to this story
2. Created SchemaViewer component with:
   - Structured view with collapsible PropertyNode components
   - Raw JSON view with syntax highlighting
   - Toggle between structured and raw views
   - Copy and download buttons integrated
   - Field description tooltips using shadcn/ui Tooltip
3. Created schema page at `/dashboard/processes/[id]/schema`
4. Added Schema button to process detail page with FileJson icon
5. Wrote comprehensive tests (26 unit tests for SchemaViewer, 30 integration tests for schema endpoint)

### Completion Notes List

- Task 1: Schema endpoint was already fully implemented at `src/app/api/v1/intelligence/[processId]/schema/route.ts`
- Task 2-3: Created SchemaViewer component with copy/download integrated, structured view with collapsible sections, raw JSON view with syntax highlighting
- Task 4: Created dedicated schema page with side-by-side layout on desktop, stacked on mobile
- Task 5: Reused existing process.get which returns inputSchema and outputSchema
- Task 6-8: Added 26 unit tests for SchemaViewer, expanded integration tests to 30 for schema endpoint coverage
- Task 9: All verification passed - typecheck, lint, 390 unit tests, 207 integration tests, build

### File List

**New Files:**
- `src/components/process/SchemaViewer.tsx` - Schema viewer component with copy/download
- `src/app/dashboard/processes/[id]/schema/page.tsx` - Dedicated schema page
- `src/components/ui/collapsible.tsx` - shadcn/ui Collapsible component (installed)
- `tests/unit/components/process/SchemaViewer.test.tsx` - 26 unit tests for SchemaViewer

**Modified Files:**
- `src/app/dashboard/processes/[id]/page.tsx` - Added Schema button with FileJson icon
- `tests/integration/intelligence-api.test.ts` - Added 8 new tests for schema endpoint (401, 403, 404, tenant isolation)

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-28 | SM Agent (Bob) | Initial story creation from Epic 3 tech spec |
| 2025-11-28 | Dev Agent (Amelia) | Implemented all tasks, all tests passing, ready for review |
