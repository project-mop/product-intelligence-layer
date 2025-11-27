# Story 3.1: Endpoint URL Generation

Status: done

## Story

As a **user**,
I want **a unique API endpoint URL generated when I save my intelligence definition**,
So that **I can immediately start calling my intelligence API**.

## Acceptance Criteria

1. **URL Generation on Save**: Saving a complete intelligence definition generates a unique endpoint URL based on the process ID
2. **URL Format**: Endpoint URL format follows pattern `/api/v1/intelligence/:processId/generate` where processId is the `proc_*` ID
3. **Prominent Display**: The endpoint URL is displayed prominently on the process detail page after saving
4. **One-Click Copy**: A copy button copies the full URL (with base domain) to clipboard with toast confirmation
5. **Callable When Published**: Endpoint is immediately callable once process has a published version (SANDBOX or PRODUCTION status)
6. **Draft State Handling**: Draft-only processes show the endpoint URL but return 404 if called until a version is published

## Tasks / Subtasks

- [x] **Task 1: Create API Route Structure** (AC: 1, 2)
  - [x] Create `src/app/api/v1/intelligence/[processId]/generate/route.ts` with POST handler
  - [x] Create `src/app/api/v1/intelligence/[processId]/schema/route.ts` with GET handler
  - [x] Implement basic route parameter extraction (`params.processId`)
  - [x] Return placeholder 501 Not Implemented for LLM logic (Story 3.2)
  - [x] Follow REST API patterns from architecture.md (not tRPC)

- [x] **Task 2: Implement Bearer Token Authentication Middleware** (AC: 5, 6)
  - [x] Reused existing `src/server/services/auth/api-key-validator.ts` for public API auth
  - [x] Extract Bearer token from Authorization header
  - [x] Hash token and lookup in database (reuse Epic 1 API key infrastructure)
  - [x] Validate key is not revoked and not expired
  - [x] Extract tenantId and environment from API key
  - [x] Return 401 Unauthorized for invalid/missing keys
  - [x] Return 403 Forbidden if key lacks access to process

- [x] **Task 3: Implement Process Lookup with Tenant Isolation** (AC: 5, 6)
  - [x] Load process by ID with tenant filter from API key
  - [x] Check for active ProcessVersion (SANDBOX or PRODUCTION based on key environment)
  - [x] Return 404 Not Found if process doesn't exist or no published version
  - [x] Return 404 for deleted processes (deletedAt not null)

- [x] **Task 4: Create Endpoint URL Display Component** (AC: 3, 4)
  - [x] Create `src/components/process/EndpointUrl.tsx` component
  - [x] Display full URL with base domain (`process.env.NEXT_PUBLIC_APP_URL` or window.location.origin)
  - [x] Add copy button with clipboard API
  - [x] Show toast on successful copy ("URL copied to clipboard")
  - [x] Add visual styling (monospace font, code-like appearance)
  - [x] Show status indicator (Draft = gray/disabled, Published = green/active)

- [x] **Task 5: Update Process Detail Page** (AC: 3, 4)
  - [x] Create process detail page (`src/app/dashboard/processes/[id]/page.tsx`)
  - [x] Add EndpointUrl component to process detail page
  - [x] Position prominently after process name/description
  - [x] Show "Not yet callable" message for draft-only processes
  - [x] Add "API Docs" button placeholder (Story 3.6)
  - [x] Update processes list page to link to detail page

- [x] **Task 6: Add Request ID Generation** (AC: 1)
  - [x] Existing `src/lib/id.ts` already has `generateRequestId()` function
  - [x] Generate `req_*` prefixed UUIDs for each API request
  - [x] Include request_id in all API responses (`meta.request_id`)

- [x] **Task 7: Implement Standard Response Format** (AC: 5, 6)
  - [x] Create `src/server/services/api/response.ts` with response helpers
  - [x] Implement success response format: `{ success: true, data: {...}, meta: {...} }`
  - [x] Implement error response format: `{ success: false, error: { code, message, details? } }`
  - [x] Include `X-Request-Id` header in all responses
  - [x] Add latency tracking (`meta.latency_ms`)

- [x] **Task 8: Write Integration Tests** (AC: 1-6)
  - [x] Test 401 for missing Authorization header
  - [x] Test 401 for invalid/expired/revoked API key
  - [x] Test 403 for API key without process scope
  - [x] Test 404 for non-existent process
  - [x] Test 404 for draft-only process (no published version)
  - [x] Test 404 for deleted process
  - [x] Test 501 placeholder response for valid request with published version
  - [x] Test tenant isolation (cannot access other tenant's process)
  - [x] 18 tests passing

- [x] **Task 9: Verification** (AC: 1-6)
  - [x] Run `pnpm typecheck` - zero errors
  - [x] Run `pnpm lint` - zero new errors (only pre-existing warnings)
  - [x] Run `pnpm test:integration` - all 164 tests pass
  - [x] Run `pnpm build` - production build succeeds

## Dev Notes

**BEFORE WRITING TESTS:** Review testing strategy at `/docs/testing-strategy-mvp.md`
- Integration tests for API routes using fetch or supertest
- Mock database for unit tests of auth middleware
- 50% coverage minimum for MVP

### Technical Context

This story creates the REST API foundation for the intelligence endpoints. It establishes the URL structure, authentication pattern, and response format that all subsequent Epic 3 stories will build upon.

**Key Architecture Decisions:**
- ADR-003: REST for public intelligence endpoints (not tRPC)
- Bearer token authentication per architecture.md
- Tenant isolation enforced at API key level
- Response format includes `meta.request_id`, `meta.latency_ms`, `meta.cached`

### API Route Structure

From `tech-spec-epic-3.md`:

```
src/app/api/v1/intelligence/[processId]/
├── generate/
│   └── route.ts    # POST - Generate intelligence (main endpoint)
└── schema/
    └── route.ts    # GET - Get input/output schemas
```

### Authentication Flow

From `architecture.md`:

```typescript
// src/server/services/auth/api-key-auth.ts
export async function validateApiKey(
  authHeader: string | null
): Promise<ApiKeyContext> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError("UNAUTHORIZED", "Missing or invalid Authorization header");
  }

  const token = authHeader.slice(7);
  const keyHash = createHash("sha256").update(token).digest("hex");

  const apiKey = await db.apiKey.findFirst({
    where: {
      keyHash,
      revokedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  if (!apiKey) {
    throw new ApiError("UNAUTHORIZED", "Invalid or expired API key");
  }

  return {
    tenantId: apiKey.tenantId,
    keyId: apiKey.id,
    scopes: apiKey.scopes as string[],
    environment: apiKey.environment as "SANDBOX" | "PRODUCTION",
  };
}
```

### Response Format

From `architecture.md`:

```typescript
// Success Response
{
  success: true,
  data: { ... },
  meta: {
    version: "1.0.0",
    cached: false,
    latency_ms: 245,
    request_id: "req_abc123"
  }
}

// Error Response
{
  success: false,
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid or expired API key"
  }
}
```

### HTTP Status Codes

| Status | Condition | Error Code |
|--------|-----------|------------|
| 200 | Success | - |
| 401 | Missing/invalid API key | UNAUTHORIZED |
| 403 | Key lacks process access | FORBIDDEN |
| 404 | Process not found or not published | NOT_FOUND |
| 501 | LLM not implemented (placeholder) | NOT_IMPLEMENTED |

### Learnings from Previous Story

**From Story 2.6: Delete Intelligence Definition (Status: done)**

- **Dialog patterns**: DeleteDialog at `src/components/process/DeleteDialog.tsx` shows shadcn Dialog usage
- **Dropdown menu integration**: `src/app/dashboard/processes/page.tsx:184-190` shows action patterns
- **Toast notifications**: Uses sonner toast via shadcn - see DuplicateDialog for success toast pattern
- **tRPC patterns**: Router at `src/server/api/routers/process.ts` shows tenant isolation
- **Test patterns**: Integration tests at `tests/integration/process-router.test.ts`

**Patterns to Follow:**
- Tenant isolation: All queries filter by tenantId (from API key, not session for public API)
- Response helpers: Create utility functions for consistent response formatting
- Error handling: Use structured ApiError class with code and message

[Source: docs/stories/2-6-delete-intelligence-definition.md#File-List]

### Project Structure Notes

New files to create:

```
src/app/api/v1/intelligence/[processId]/
├── generate/
│   └── route.ts              # NEW - POST handler for intelligence generation
└── schema/
    └── route.ts              # NEW - GET handler for schema viewing

src/server/services/
├── auth/
│   └── api-key-auth.ts       # NEW - Public API authentication
└── api/
    └── response.ts           # NEW - Response formatting utilities

src/components/process/
└── EndpointUrl.tsx           # NEW - URL display with copy button

src/lib/
└── id.ts                     # MODIFY - Add generateRequestId()
```

Files to modify:

```
src/app/dashboard/processes/[id]/
└── page.tsx                  # ADD EndpointUrl component display

tests/integration/
└── api-routes.test.ts        # NEW - API route integration tests
```

### Implementation Notes

**URL Construction:**
```typescript
// Build full endpoint URL
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const endpointUrl = `${baseUrl}/api/v1/intelligence/${processId}/generate`;
```

**Copy to Clipboard:**
```typescript
// Modern clipboard API with fallback
const copyToClipboard = async (text: string) => {
  await navigator.clipboard.writeText(text);
  toast.success("URL copied to clipboard");
};
```

**Request ID Format:**
```typescript
// Follow existing ID prefix pattern
export function generateRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}
```

### References

- [Source: docs/tech-spec-epic-3.md#Story-3.1-Endpoint-URL-Generation] - Acceptance criteria
- [Source: docs/tech-spec-epic-3.md#APIs-and-Interfaces] - API contract details
- [Source: docs/architecture.md#Public-API-Patterns] - REST API patterns
- [Source: docs/architecture.md#Permission-Checking-Patterns] - API key validation
- [Source: docs/epics.md#Story-3.1-Endpoint-URL-Generation] - Epic story definition (FR-201, FR-202, FR-203)
- [Source: docs/testing-strategy-mvp.md] - Testing patterns

## Dev Agent Record

### Context Reference

- docs/stories/3-1-endpoint-url-generation.context.xml

### Agent Model Used

Claude Opus 4.5

### Debug Log References

N/A

### Completion Notes List

- Reused existing `api-key-validator.ts` instead of creating new `api-key-auth.ts` (already had all required functionality)
- Existing `generateRequestId()` function in `src/lib/id.ts` - no modification needed
- Created new process detail page rather than modifying existing edit page
- Updated processes list page to link "View Details" to detail page
- 18 integration tests covering all acceptance criteria
- POST /generate returns 501 placeholder for Story 3.2 LLM integration

### File List

**New Files Created:**
- `src/app/api/v1/intelligence/[processId]/generate/route.ts` - POST handler for intelligence generation
- `src/app/api/v1/intelligence/[processId]/schema/route.ts` - GET handler for schema retrieval
- `src/server/services/api/response.ts` - Standard API response helpers
- `src/components/process/EndpointUrl.tsx` - Endpoint URL display with copy button
- `src/app/dashboard/processes/[id]/page.tsx` - Process detail page
- `tests/integration/intelligence-api.test.ts` - 18 integration tests

**Modified Files:**
- `src/app/dashboard/processes/page.tsx` - Added link to detail page from dropdown
- `docs/sprint-status.yaml` - Updated story status to in-progress

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-27 | SM Agent (Bob) | Initial story creation from Epic 3 tech spec |
