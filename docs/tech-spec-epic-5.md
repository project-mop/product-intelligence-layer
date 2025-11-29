# Epic Technical Specification: Environments & Versioning

Date: 2025-11-28
Author: Zac
Epic ID: 5
Status: Draft

---

## Overview

Epic 5 introduces enterprise-grade deployment workflows to the Product Intelligence Layer, enabling customers to safely iterate on their intelligence definitions without risk to production integrations. Building on the schema validation and caching infrastructure from Epic 4, this epic implements the dual-environment model (sandbox/production) and comprehensive version management that ERP and commerce teams expect from any system touching their live operations.

The core value proposition—"turn product data into private intelligence APIs"—requires more than just working endpoints. Enterprise customers need confidence that changes won't break existing integrations, that they can test thoroughly before going live, and that they can recover quickly if something goes wrong. Epic 5 delivers this confidence through environment separation, controlled promotion workflows, immutable version history, and API consumer controls for version pinning.

**FRs Covered:** FR-601 through FR-605 (Environments), FR-309 through FR-312 (Versioning), covering sandbox/production modes, environment-specific API keys, promotion workflows, version history, rollback capabilities, version pinning, and deprecation warnings.

## Objectives and Scope

### In Scope

- Sandbox and production environment modes for each intelligence (FR-601, FR-602)
- Environment-specific API keys with strict isolation (FR-604)
- Promotion workflow from sandbox to production with confirmation (FR-603)
- Immutable versions once promoted to production (FR-309)
- Explicit publish action for version creation (FR-310)
- Version history UI with comparison/diff view (FR-302)
- Rollback to previous versions via new version creation (FR-305)
- Version pinning via `X-Version` header for API consumers (FR-311)
- Deprecation warnings via `X-Deprecated` header (FR-312)
- Sandbox calls excluded from production quota counting (FR-605)
- Cache invalidation on version promotion
- Audit logging for all version and environment operations

### Out of Scope

- Blue-green deployment infrastructure (handled at platform level)
- A/B testing between versions (Growth phase feature)
- Automatic version promotion based on metrics (Growth phase)
- Per-version rate limits (uses process-level limits from Epic 7A)
- Version branching or merging (linear version history only)
- Bulk promotion of multiple intelligences
- Version scheduling (promote at future time)

## System Architecture Alignment

This epic implements the "Process Version Lifecycle" documented in the architecture, completing the state machine for version management:

| Architecture Component | Epic 5 Implementation |
|------------------------|----------------------|
| ProcessVersion model | Add `environment` enum, `publishedAt`, `deprecatedAt` fields |
| API Key model | Add `environment` scope (SANDBOX \| PRODUCTION) |
| Version Router | `src/server/api/routers/version.ts` - Version CRUD operations |
| Promotion Service | `src/server/services/process/promotion.ts` - Environment transitions |
| Version Resolver | `src/server/services/process/version-resolver.ts` - Resolve version for requests |

**Architecture Flow Integration:**

```
Customer Request → API Key Auth → [ENVIRONMENT CHECK] → Rate Limit Check
    → Input Validation → Cache Lookup → LLM Gateway → Output Validation
    → Cache Store → Log Entry → Response
```

Epic 5 adds the `[ENVIRONMENT CHECK]` stage that:
1. Extracts environment from API key (SANDBOX or PRODUCTION)
2. Resolves the correct ProcessVersion for that environment
3. Supports version pinning via `X-Version` header
4. Adds deprecation warning headers when applicable

**Process Version Lifecycle (from Architecture):**

```
                    ┌──────────────┐
                    │   CREATED    │
                    │   (draft)    │
                    └──────┬───────┘
                           │ save (auto-publish to sandbox)
                           ▼
                    ┌──────────────┐
         edit ────► │   SANDBOX    │ ◄──── test
                    │  (testing)   │
                    └──────┬───────┘
                           │ promote to production
                           ▼
                    ┌──────────────┐
                    │  PRODUCTION  │ ◄──── customer traffic
                    │   (live)     │
                    └──────┬───────┘
                           │ new version promoted
                           ▼
                    ┌──────────────┐
                    │  DEPRECATED  │
                    │  (read-only) │
                    └──────────────┘
```

**Key Architecture Rules Applied:**
- Only ONE version per process can be active in PRODUCTION at a time
- SANDBOX versions are only accessible with sandbox API keys
- DEPRECATED versions continue serving pinned requests but cannot be promoted
- Promoting to production automatically deprecates the previous production version
- API key environment is tied to the key, not the request—prevents sandbox keys hitting production

## Detailed Design

### Services and Modules

| Module | Location | Responsibility |
|--------|----------|----------------|
| Version Router | `src/server/api/routers/version.ts` | tRPC endpoints for version CRUD, history, rollback |
| Promotion Service | `src/server/services/process/promotion.ts` | Handle sandbox→production transitions, deprecation |
| Version Resolver | `src/server/services/process/version-resolver.ts` | Resolve correct version for API requests based on environment and pinning |
| Environment Guard | `src/server/middleware/environment-guard.ts` | Validate API key environment matches request path |
| Version Diff | `src/server/services/process/version-diff.ts` | Compare two versions and generate diff summary |
| API Key Service (enhanced) | `src/server/services/auth/api-key.ts` | Add environment field to key creation/validation |
| Quota Service (enhanced) | `src/server/services/quota/service.ts` | Exclude sandbox calls from production quota |

### Data Models and Contracts

**Enhanced ProcessVersion Model:**

```prisma
// Updates to prisma/schema.prisma

enum Environment {
  SANDBOX
  PRODUCTION
}

enum VersionStatus {
  DRAFT
  ACTIVE
  DEPRECATED
}

model ProcessVersion {
  id              String        @id @default(cuid())
  processId       String        @map("process_id")
  version         Int           // Auto-incrementing per process (1, 2, 3...)
  config          Json          // ProcessConfig (systemPrompt, cacheTtl, etc.)
  inputSchema     Json          @map("input_schema")
  outputSchema    Json          @map("output_schema")

  // Environment & Status (Epic 5)
  environment     Environment   @default(SANDBOX)
  status          VersionStatus @default(DRAFT)

  // Lifecycle timestamps
  createdAt       DateTime      @default(now()) @map("created_at")
  publishedAt     DateTime?     @map("published_at")  // When promoted to current env
  deprecatedAt    DateTime?     @map("deprecated_at") // When superseded by new version

  // Change tracking
  changeNotes     String?       @map("change_notes")  // User-provided description
  promotedBy      String?       @map("promoted_by")   // User ID who promoted

  process         Process       @relation(fields: [processId], references: [id])
  callLogs        CallLog[]
  cacheEntries    ResponseCache[]

  @@unique([processId, version])
  @@index([processId, environment, status])
  @@index([processId, deprecatedAt])
  @@map("process_versions")
}
```

**Enhanced ApiKey Model:**

```prisma
model ApiKey {
  id          String       @id @default(cuid())
  tenantId    String       @map("tenant_id")
  name        String
  keyHash     String       @unique @map("key_hash")
  keyPrefix   String       @map("key_prefix")  // First 8 chars for identification

  // Environment scope (Epic 5)
  environment Environment  @default(SANDBOX)

  scopes      Json         // ["process:*"] or ["process:proc_123"]
  expiresAt   DateTime?    @map("expires_at")
  createdAt   DateTime     @default(now()) @map("created_at")
  revokedAt   DateTime?    @map("revoked_at")
  lastUsedAt  DateTime?    @map("last_used_at")

  tenant      Tenant       @relation(fields: [tenantId], references: [id])

  @@index([tenantId, environment])
  @@index([keyHash])
  @@map("api_keys")
}
```

**Version History Entry Type:**

```typescript
// src/server/services/process/types.ts

export interface VersionHistoryEntry {
  id: string;
  version: number;
  environment: "SANDBOX" | "PRODUCTION";
  status: "DRAFT" | "ACTIVE" | "DEPRECATED";
  createdAt: string;
  publishedAt: string | null;
  deprecatedAt: string | null;
  changeNotes: string | null;
  promotedBy: string | null;

  // Computed fields for UI
  isCurrent: boolean;        // Is this the active version for its environment?
  canPromote: boolean;       // Can be promoted to production?
  canRollback: boolean;      // Can be restored as new version?
}

export interface VersionDiff {
  version1: number;
  version2: number;
  changes: {
    field: string;
    type: "added" | "removed" | "modified";
    oldValue?: unknown;
    newValue?: unknown;
  }[];
  summary: string;  // Human-readable summary
}
```

**Promotion Request/Response:**

```typescript
// src/server/services/process/promotion.ts

export interface PromoteToProductionInput {
  processId: string;
  versionId: string;
  changeNotes?: string;
}

export interface PromoteToProductionResult {
  promotedVersion: ProcessVersion;
  deprecatedVersion: ProcessVersion | null;  // Previous production version
  cacheInvalidated: boolean;
}
```

### APIs and Interfaces

**tRPC Router: version.ts**

```typescript
// src/server/api/routers/version.ts

export const versionRouter = createTRPCRouter({
  // List all versions for a process
  list: protectedProcedure
    .input(z.object({ processId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Returns VersionHistoryEntry[]
    }),

  // Get single version details
  get: protectedProcedure
    .input(z.object({ processId: z.string(), versionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Returns ProcessVersion with computed fields
    }),

  // Compare two versions
  diff: protectedProcedure
    .input(z.object({
      processId: z.string(),
      version1: z.number(),
      version2: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      // Returns VersionDiff
    }),

  // Promote sandbox version to production
  promoteToProduction: protectedProcedure
    .input(z.object({
      processId: z.string(),
      versionId: z.string(),
      changeNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Returns PromoteToProductionResult
    }),

  // Create new version from existing (rollback)
  rollback: protectedProcedure
    .input(z.object({
      processId: z.string(),
      targetVersionId: z.string(),
      changeNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Creates new sandbox version from target, returns new version
    }),

  // Mark version as deprecated (manual deprecation)
  deprecate: protectedProcedure
    .input(z.object({
      processId: z.string(),
      versionId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Sets deprecatedAt, returns updated version
    }),
});
```

**Enhanced API Key Router:**

```typescript
// Addition to src/server/api/routers/apiKey.ts

export const apiKeyRouter = createTRPCRouter({
  // ... existing methods ...

  // Create key with environment
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      environment: z.enum(["SANDBOX", "PRODUCTION"]),
      scopes: z.array(z.string()).optional(),
      expiresInDays: z.number().min(1).max(365).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Returns { key: string (show once), keyData: ApiKey }
    }),

  // List keys grouped by environment
  listByEnvironment: protectedProcedure
    .query(async ({ ctx }) => {
      // Returns { sandbox: ApiKey[], production: ApiKey[] }
    }),
});
```

**Public API Version Headers:**

```
# Request with version pinning
POST /api/v1/intelligence/:processId/generate
Authorization: Bearer key_abc123
X-Version: 2

# Response headers (production, pinned to version 2)
X-Request-Id: req_xyz789
X-Version: 2
X-Version-Status: deprecated
X-Deprecated: true
X-Deprecated-Message: Version 2 is deprecated. Latest is version 4.
X-Sunset-Date: 2025-03-01T00:00:00Z

# Response headers (sandbox, latest)
X-Request-Id: req_abc456
X-Environment: sandbox
X-Version: 3
X-Version-Status: active
```

**Endpoint URL Patterns:**

| Environment | URL Pattern | Notes |
|-------------|-------------|-------|
| Production | `/api/v1/intelligence/:processId/generate` | Default, requires production API key |
| Sandbox | `/api/v1/sandbox/intelligence/:processId/generate` | Requires sandbox API key |

### Workflows and Sequencing

#### Version Resolution Flow

```
1. API request arrives at intelligence endpoint
2. Extract API key from Authorization header
3. Validate API key and get environment (SANDBOX | PRODUCTION)
4. Determine URL path environment:
   - /api/v1/sandbox/... → SANDBOX
   - /api/v1/intelligence/... → PRODUCTION
5. Validate key environment matches path environment
   - Mismatch → 403 Forbidden
6. Check for X-Version header
7. Resolve ProcessVersion:
   a. If X-Version present:
      - Find version by (processId, version number)
      - Verify version is accessible in current environment
      - If version is DEPRECATED, add warning headers
   b. If no X-Version:
      - Find latest ACTIVE version for (processId, environment)
8. Continue with resolved ProcessVersion
```

#### Promotion Workflow

```
1. User clicks "Promote to Production" in UI
2. Frontend calls version.promoteToProduction tRPC
3. Backend validation:
   a. Verify user has permission for this process
   b. Verify source version exists and is in SANDBOX
   c. Verify source version has status ACTIVE
4. Show confirmation dialog with:
   - Version being promoted
   - Change summary (diff from current production)
   - Warning about cache invalidation
5. User confirms promotion
6. Backend executes promotion:
   a. BEGIN TRANSACTION
   b. Find current PRODUCTION version (if any)
   c. Set current production version's status = DEPRECATED, deprecatedAt = now()
   d. Create new ProcessVersion:
      - Copy config, schemas from source
      - Set environment = PRODUCTION
      - Set status = ACTIVE
      - Set publishedAt = now()
      - Increment version number
   e. Invalidate cache for this process (all entries)
   f. Create audit log entry
   g. COMMIT TRANSACTION
7. Return PromoteToProductionResult
8. UI refreshes version history
```

#### Rollback Workflow

```
1. User views version history, selects old version
2. User clicks "Restore this version"
3. Frontend shows confirmation:
   - "This will create a new sandbox version based on version X"
   - "You can then test and promote to production"
4. User confirms
5. Backend calls version.rollback:
   a. Load target version configuration
   b. Create new ProcessVersion:
      - Copy config, schemas from target
      - Set environment = SANDBOX
      - Set status = ACTIVE
      - Set publishedAt = now()
      - Auto-increment version number
      - Set changeNotes = "Rollback from version X"
   c. Mark previous sandbox version as DEPRECATED (if any)
   d. Create audit log entry
6. Return new sandbox version
7. User can test sandbox, then promote when ready
```

#### API Key Creation with Environment

```
1. User navigates to API Keys page
2. User clicks "Create API Key"
3. UI shows form with:
   - Name (required)
   - Environment: Sandbox / Production (required)
   - Expiration: 30/60/90 days / Custom / Never
   - Scopes: All intelligences / Specific intelligences
4. User selects environment and fills form
5. On submit:
   a. Generate random token (32 bytes hex)
   b. Hash token with SHA-256
   c. Create ApiKey record with environment
   d. Return plaintext token (shown once)
6. UI shows:
   - Token (copyable, shown once)
   - Environment badge (sandbox=yellow, production=green)
   - Warning: "This token will only be shown once"
```

#### Sandbox Quota Exclusion Flow

```
1. API request with sandbox key arrives
2. Rate limiter checks request
3. If environment == SANDBOX:
   - Skip monthly quota check (FR-605)
   - Still apply per-minute rate limits (prevents abuse)
4. If environment == PRODUCTION:
   - Apply full quota checking
5. Continue with request processing
```

## Non-Functional Requirements

### Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| Version resolution | < 5ms P95 | Single indexed query, should not add latency |
| Version history load | < 100ms P95 | Query all versions for a process (typically < 50) |
| Version diff computation | < 50ms P95 | JSON diff is CPU-bound, cached if needed |
| Promotion transaction | < 500ms P95 | Database transaction with cache invalidation |
| Rollback creation | < 200ms P95 | Single insert with copy |

**Performance Notes:**
- Version resolution adds minimal overhead to existing request flow
- Index on `(processId, environment, status)` ensures O(log n) lookups
- Version history is paginated for processes with many versions (> 100)
- Cache invalidation on promotion is synchronous but fast (single DELETE)

### Security

| Requirement | Implementation | FR Reference |
|-------------|----------------|--------------|
| Environment isolation | API key environment must match endpoint path | FR-604 |
| Sandbox key cannot access production | Environment guard middleware validates match | FR-604 |
| Production key cannot access sandbox | Environment guard rejects mismatched requests | FR-604 |
| Version immutability | Production versions cannot be modified, only deprecated | FR-309 |
| Promotion audit | All promotions logged with user ID and timestamp | FR-805 |
| Key environment visible | Keys clearly display environment in dashboard | FR-604 |

**Security Notes:**
- Environment is enforced at the API key level, not the request level
- Users cannot override environment via headers—only key determines access
- Production API keys should have stricter rotation policies
- Audit logs capture all version state transitions

### Reliability/Availability

| Requirement | Implementation | FR Reference |
|-------------|----------------|--------------|
| Promotion atomicity | Single database transaction for all promotion operations | FR-603 |
| Rollback safety | Rollback creates new version, never modifies history | FR-305 |
| Version pinning reliability | Deprecated versions continue serving pinned requests | FR-311 |
| Cache consistency | Cache invalidated synchronously during promotion | Consistency |
| No accidental production changes | Explicit promotion action required | FR-310 |

**Reliability Notes:**
- Promotion transaction includes: deprecate old, create new, invalidate cache
- If promotion fails, no state is changed (transaction rollback)
- Deprecated versions remain accessible for version-pinned consumers
- Sandbox changes never affect production until explicit promotion

### Observability

| Signal | Implementation | Purpose |
|--------|----------------|---------|
| Version resolved | Log with request_id, version, environment | Debug version selection |
| Promotion events | Log with processId, old/new version, user | Audit trail |
| Deprecation warnings served | Log when X-Deprecated header added | Track adoption of new versions |
| Environment mismatch | Log failed requests due to key/path mismatch | Security monitoring |
| Rollback events | Log with processId, source/target version | Change tracking |

**Structured Log Examples:**

```json
// Version resolution
{
  "level": "info",
  "message": "Version resolved",
  "request_id": "req_abc123",
  "tenant_id": "ten_xyz789",
  "process_id": "proc_def456",
  "environment": "PRODUCTION",
  "version": 3,
  "pinned": false,
  "deprecated": false
}

// Promotion event
{
  "level": "info",
  "message": "Version promoted to production",
  "tenant_id": "ten_xyz789",
  "process_id": "proc_def456",
  "promoted_by": "usr_abc123",
  "old_version": 2,
  "new_version": 3,
  "cache_entries_invalidated": 47
}

// Environment mismatch (security event)
{
  "level": "warn",
  "message": "Environment mismatch rejected",
  "request_id": "req_abc123",
  "tenant_id": "ten_xyz789",
  "key_environment": "SANDBOX",
  "path_environment": "PRODUCTION",
  "process_id": "proc_def456"
}
```

## Dependencies and Integrations

### NPM Dependencies

All required dependencies are already installed from previous epics:

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@prisma/client` | ^7.0.1 | Database access for version/key models | ✅ Installed |
| `zod` | ^3.24.2 | Input validation for tRPC endpoints | ✅ Installed |
| `deep-diff` | ^1.0.2 | JSON diff for version comparison | ⬜ New (optional) |

**Note:** `deep-diff` is optional—version diff can be implemented with native JSON comparison. Consider adding only if diff quality needs improvement.

### Environment Variables

No new environment variables required for Epic 5. Uses existing:

| Variable | Description | Used For |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection | Version and key storage |
| `NEXTAUTH_SECRET` | Session encryption | User authentication for promotion |

### Internal Dependencies

| Dependency | From Epic | Required For |
|------------|-----------|--------------|
| Process model | Epic 2 | Parent entity for ProcessVersion |
| ProcessVersion model | Epic 2 | Base model, enhanced with environment/status |
| API Key model | Epic 1 | Enhanced with environment field |
| API Key validation | Epic 1 | Validate key and extract environment |
| Cache service | Epic 4 | Invalidate cache on promotion |
| Cache table | Epic 4 | Query for cache invalidation |
| Audit logging | Epic 1 | Log promotion and rollback events |
| tRPC context | Epic 1 | User authentication for mutations |

### Database Changes

**Schema Migrations Required:**

1. Add `Environment` enum to Prisma schema
2. Add `VersionStatus` enum to Prisma schema
3. Add fields to `ProcessVersion`: `environment`, `status`, `publishedAt`, `deprecatedAt`, `changeNotes`, `promotedBy`
4. Add field to `ApiKey`: `environment`
5. Add indexes: `(processId, environment, status)`, `(tenantId, environment)`

**Migration Strategy:**

```sql
-- Backfill existing versions as SANDBOX/ACTIVE
UPDATE process_versions
SET environment = 'SANDBOX', status = 'ACTIVE', published_at = created_at
WHERE environment IS NULL;

-- Backfill existing API keys as SANDBOX
UPDATE api_keys
SET environment = 'SANDBOX'
WHERE environment IS NULL;
```

### External Dependencies

None. Epic 5 is entirely internal—no external service integrations required.

## Acceptance Criteria (Authoritative)

### Story 5.1: Sandbox and Production Modes

1. New intelligences are created in sandbox mode by default (FR-601)
2. Sandbox endpoints use URL pattern `/api/v1/sandbox/intelligence/:processId/generate`
3. Production endpoints use URL pattern `/api/v1/intelligence/:processId/generate`
4. UI clearly displays current environment with visual distinction (sandbox=yellow banner, production=green)
5. Process detail page shows both sandbox and production version status
6. Sandbox version can be edited freely without affecting production
7. Production endpoint returns 404 until first promotion (no production version exists)
8. Environment indicator visible in process list view (badge per row)
9. Test console defaults to sandbox environment
10. Environment switch in UI updates all displayed URLs and keys

### Story 5.2: Separate API Keys per Environment

1. API key creation requires selecting environment (SANDBOX or PRODUCTION) (FR-604)
2. API keys page displays keys grouped by environment with clear headers
3. Sandbox keys only authenticate requests to `/api/v1/sandbox/...` endpoints
4. Production keys only authenticate requests to `/api/v1/intelligence/...` endpoints
5. Using sandbox key on production endpoint returns 403 Forbidden with clear message
6. Using production key on sandbox endpoint returns 403 Forbidden with clear message
7. Each environment's keys can be rotated independently
8. Key list shows environment badge (yellow=sandbox, green=production)
9. Key creation dialog shows environment-specific usage instructions
10. Existing keys (pre-Epic 5) are migrated to SANDBOX environment

### Story 5.3: Promote to Production

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

### Story 5.4: Version History and Rollback

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

### Story 5.5: Version Pinning and Deprecation

1. API consumers can pin to specific version via `X-Version: N` header (FR-311)
2. Without `X-Version` header, latest ACTIVE version for environment is used
3. Pinned requests to deprecated versions succeed but include warning headers
4. Deprecated version response includes `X-Deprecated: true` header (FR-312)
5. Deprecated version response includes `X-Deprecated-Message` with upgrade guidance
6. Deprecated version response includes `X-Sunset-Date` header (90 days from deprecation)
7. Pinning to non-existent version returns 404 with available versions in error
8. Pinning to wrong environment's version returns 403 (can't pin sandbox from production)
9. Response always includes `X-Version` header showing resolved version number
10. Response includes `X-Version-Status` header (active/deprecated)

---

## Traceability Mapping

| AC | FR | Spec Section | Component(s) | Test Approach |
|----|-----|--------------|--------------|---------------|
| 5.1.1-10 | FR-601, FR-602 | Sandbox/Production Modes | ProcessVersion model, API routes | Unit + integration |
| 5.2.1-10 | FR-604 | Environment API Keys | ApiKey model, environment-guard.ts | Unit + integration |
| 5.3.1-10 | FR-603, FR-310 | Promotion Workflow | promotion.ts, version router | Unit + integration |
| 5.4.1-10 | FR-302, FR-305, FR-309 | Version History | version router, version-diff.ts | Unit + integration |
| 5.5.1-10 | FR-311, FR-312 | Version Pinning | version-resolver.ts, API route | Unit + integration |

### FR to Story Mapping

| FR ID | Requirement | Story |
|-------|-------------|-------|
| FR-601 | Sandbox mode for testing | 5.1 |
| FR-602 | Production mode for live usage | 5.1 |
| FR-603 | Promote sandbox to production | 5.3 |
| FR-604 | Separate API keys per environment | 5.2 |
| FR-605 | Sandbox calls don't count against quota | 5.2 (implicit in key handling) |
| FR-302 | View version history | 5.4 |
| FR-305 | Roll back to previous version | 5.4 |
| FR-309 | Immutable versions in production | 5.3, 5.4 |
| FR-310 | Explicit publish action | 5.3 |
| FR-311 | Pin to specific version | 5.5 |
| FR-312 | Deprecation warnings | 5.5 |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Migration breaks existing API keys | High | Low | Default existing keys to SANDBOX; clear migration communication |
| Users confuse sandbox/production URLs | Medium | Medium | Strong visual distinction in UI; copy-to-clipboard shows correct URL |
| Promotion during active traffic | Medium | Low | Cache invalidation is fast; consider "quiet hours" guidance |
| Version pinning to deprecated version forever | Low | Medium | Sunset date headers; consider forced deprecation after 6 months |
| Complex version history UI | Medium | Medium | Start with simple list; enhance diff view iteratively |

### Assumptions

1. Users understand sandbox/production paradigm from ERP workflows
2. Most processes will have < 50 versions (pagination not critical for MVP)
3. Single active version per environment is sufficient (no A/B testing needed)
4. 90-day sunset period for deprecated versions is acceptable
5. Rollback via "create new version" is clearer than "restore in place"
6. Environment is tied to API key, not request header (more secure)

### Open Questions

1. **Q:** Should we support "draft" versions that aren't even in sandbox yet?
   **Recommendation:** No for MVP. Auto-publish to sandbox on save. Drafts add complexity without clear user benefit—users can test immediately in sandbox.

2. **Q:** Should promotion require a successful test call first?
   **Recommendation:** No for MVP. Show warning if no recent sandbox calls, but don't block. Users may have tested externally.

3. **Q:** How long should deprecated versions remain accessible?
   **Recommendation:** Indefinitely for MVP, with sunset warnings. Add hard sunset (6 months) in Growth phase if storage becomes concern.

4. **Q:** Should we support environment-specific cache TTL?
   **Recommendation:** No for MVP. Cache TTL is per-process. Environment separation handles the "test vs prod" concern sufficiently.

5. **Q:** What happens to in-flight requests during promotion?
   **Recommendation:** They complete with the version they started with. Only new requests see the new version. Document this behavior.

---

## Test Strategy Summary

### Test Levels

| Level | Framework | Coverage Focus |
|-------|-----------|----------------|
| Unit | Vitest | Version resolution logic, promotion service, diff computation |
| Integration | Vitest + Prisma | Version CRUD, environment guard, cache invalidation |
| E2E | Playwright | Full promotion flow, API key environment enforcement |

### Key Test Scenarios

**Sandbox/Production Modes (Story 5.1):**
- New process creates sandbox version
- Sandbox URL accessible with sandbox key
- Production URL returns 404 before promotion
- UI shows correct environment indicators

**Environment API Keys (Story 5.2):**
- Create sandbox key → can access sandbox endpoint
- Create production key → can access production endpoint
- Sandbox key on production endpoint → 403
- Production key on sandbox endpoint → 403
- Key list shows correct grouping

**Promotion Workflow (Story 5.3):**
- Promote sandbox → creates production version
- Promote → deprecates previous production
- Promote → invalidates cache
- Promote → creates audit log entry
- Promotion transaction rolls back on failure

**Version History (Story 5.4):**
- Version list shows all versions in order
- Diff shows changes between versions
- Rollback creates new sandbox version
- Rollback preserves original version unchanged
- Version numbers never reused

**Version Pinning (Story 5.5):**
- X-Version header resolves correct version
- No header → latest active version
- Deprecated version → success with warning headers
- Invalid version → 404 with available versions
- Response includes version metadata headers

### Mocking Strategy

- **Database:** Use test database with Prisma for all tests
- **Cache Service:** Real implementation against test database
- **Time:** Mock `Date.now()` for deprecation/sunset tests
- **User Context:** Mock authenticated session for tRPC tests

### Test Data Fixtures

```typescript
// tests/fixtures/versions.ts
export const testProcess = {
  id: "proc_test123",
  tenantId: "ten_test789",
  name: "Test Intelligence",
};

export const sandboxVersion = {
  id: "procv_sandbox1",
  processId: "proc_test123",
  version: 1,
  environment: "SANDBOX",
  status: "ACTIVE",
  config: { systemPrompt: "Test prompt v1" },
};

export const productionVersion = {
  id: "procv_prod1",
  processId: "proc_test123",
  version: 2,
  environment: "PRODUCTION",
  status: "ACTIVE",
  config: { systemPrompt: "Test prompt v2" },
};

export const deprecatedVersion = {
  id: "procv_deprecated1",
  processId: "proc_test123",
  version: 1,
  environment: "PRODUCTION",
  status: "DEPRECATED",
  deprecatedAt: new Date("2025-11-01"),
};

export const sandboxApiKey = {
  id: "key_sandbox1",
  tenantId: "ten_test789",
  environment: "SANDBOX",
  keyHash: "hash_sandbox",
};

export const productionApiKey = {
  id: "key_prod1",
  tenantId: "ten_test789",
  environment: "PRODUCTION",
  keyHash: "hash_prod",
};
```

### Integration Test Pattern

```typescript
// tests/integration/version-promotion.test.ts
describe("Version Promotion", () => {
  beforeEach(async () => {
    await seedTestProcess();
    await seedSandboxVersion();
  });

  it("creates production version and deprecates previous", async () => {
    // Seed existing production version
    await seedProductionVersion();

    // Promote sandbox
    const result = await promotionService.promoteToProduction({
      processId: testProcess.id,
      versionId: sandboxVersion.id,
      changeNotes: "Test promotion",
    });

    // Verify new production version created
    expect(result.promotedVersion.environment).toBe("PRODUCTION");
    expect(result.promotedVersion.status).toBe("ACTIVE");

    // Verify old production deprecated
    expect(result.deprecatedVersion?.status).toBe("DEPRECATED");
    expect(result.deprecatedVersion?.deprecatedAt).toBeTruthy();

    // Verify cache invalidated
    const cacheCount = await db.responseCache.count({
      where: { processId: testProcess.id },
    });
    expect(cacheCount).toBe(0);
  });
});
```
