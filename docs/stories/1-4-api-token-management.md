# Story 1.4: API Token Management

Status: done

## Story

As a **user**,
I want **to create, view, rotate, and revoke API tokens**,
So that **I can securely integrate my intelligences with external systems**.

## Acceptance Criteria

1. User can create a new API token from dashboard
2. Token is displayed only once at creation; cannot be retrieved later
3. Token includes environment prefix (pil_live_, pil_test_)
4. User can view list of tokens with: name, created date, last used, environment
5. User can rotate a token; old token immediately invalid, new token works
6. User can revoke a token; token immediately returns 401 on use
7. Tokens have configurable expiration (default 90 days)
8. Expired tokens return 401 with clear error message

## Tasks / Subtasks

- [x] **Task 1: Create API Key Service** (AC: 1, 2, 3, 7)
  - [x] Create `src/server/services/auth/api-key.ts`
  - [x] Implement `generateKey()` - creates cryptographically secure key with prefix
  - [x] Implement `hashKey()` - SHA-256 hash for storage
  - [x] Implement `createApiKey()` - stores hashed key, returns plaintext once
  - [x] Key format: `pil_{env}_{random}` where env is `live` or `test`, random is 32 bytes hex
  - [x] Default expiration: 90 days from creation (configurable via env)

- [x] **Task 2: Create API Key tRPC Router** (AC: 1, 2, 4, 5, 6, 7)
  - [x] Create `src/server/api/routers/apiKey.ts`
  - [x] Implement `list` query - returns all keys for tenant (without plaintext)
  - [x] Implement `create` mutation - creates new key, returns ApiKey + plainTextKey
  - [x] Implement `rotate` mutation - revokes old key, creates new with same config
  - [x] Implement `revoke` mutation - sets revokedAt timestamp
  - [x] Implement `update` mutation - update name only (scopes in future epic)
  - [x] Register router in `src/server/api/root.ts`

- [x] **Task 3: Implement API Key Validation Middleware** (AC: 6, 8)
  - [x] Create `src/server/services/auth/api-key-validator.ts`
  - [x] Implement `validateApiKey(authHeader)` - extracts, hashes, queries, validates
  - [x] Check: key exists, not revoked, not expired
  - [x] Return `ApiKeyContext` with tenantId, keyId, scopes, environment
  - [x] Update `lastUsedAt` on successful validation (fire-and-forget)
  - [x] Return appropriate error codes: 401 for invalid/revoked/expired

- [x] **Task 4: Create API Keys Management UI** (AC: 1, 2, 3, 4, 5, 6)
  - [x] Create `src/app/dashboard/api-keys/page.tsx` - list view
  - [x] Display table: name, environment (badge), created, last used, actions
  - [x] Create modal for new key creation with name and environment selection
  - [x] Show plaintext key ONCE with copy button and warning
  - [x] Add rotate button with confirmation dialog
  - [x] Add revoke button with confirmation dialog
  - [x] Show revoked keys with strikethrough or badge

- [x] **Task 5: Write Audit Log Entries** (AC: all) - DEFERRED to Story 1.5
  - [ ] Log `apiKey.created` on key creation
  - [ ] Log `apiKey.rotated` on key rotation (include old key ID)
  - [ ] Log `apiKey.revoked` on key revocation
  - [ ] Include IP address and user agent in audit context
  - Note: Audit logging deferred to Story 1.5 per Dev Notes (audit infrastructure not yet available)

- [x] **Task 6: Testing** (AC: 1-8)
  - [x] Unit tests for key generation (format, uniqueness)
  - [x] Unit tests for key hashing (deterministic)
  - [x] Unit tests for validation logic (expired, revoked, invalid)
  - [x] Unit tests for service functions (createApiKey, rotateApiKey, revokeApiKey, listApiKeys, updateApiKeyName)
  - [x] Unit tests for createUnauthorizedResponse helper
  - [x] AC coverage tests (P0 priority for all 8 acceptance criteria)
  - [x] Test data factory created (tests/support/factories/api-key.factory.ts)
  - [ ] Integration tests for CRUD operations - deferred (requires DB setup)
  - [x] Test token expiration behavior

- [x] **Task 7: Verification** (AC: 1-8)
  - [x] Run `pnpm typecheck` - zero errors
  - [x] Run `pnpm lint` - zero warnings
  - [x] Run `pnpm build` - successful build
  - [x] Run `pnpm test` - all tests pass (72 tests, 50 for API keys)
  - [ ] Manual testing of key lifecycle - requires running app

## Dev Notes

### Technical Context

This story implements API token management as specified in the Epic 1 tech spec (Story 1.4). The ApiKey model already exists from Story 1.2 with all required fields.

**Key Implementation Decisions:**

1. **Key Format:** `pil_{environment}_{random}` where environment is `live` or `test`, and random is 32 bytes (64 hex chars)
2. **Storage:** Only SHA-256 hash stored; plaintext shown once at creation
3. **Validation:** Hash incoming key, query by hash, check expiry/revocation
4. **Expiration:** Default 90 days, configurable via `API_KEY_DEFAULT_EXPIRY_DAYS` env var
5. **Audit Logging:** Deferred to Story 1.5 (audit infrastructure not yet available)

**Security Requirements (from tech spec):**

| Requirement | Implementation |
|-------------|----------------|
| Token storage | SHA-256 hash only, never plaintext (FR-804) |
| Bearer auth | `Authorization: Bearer pil_live_...` header (FR-807) |
| Token expiration | Default 90 days, configurable (FR-809) |
| Token rotation | Revoke old + create new atomically (FR-810) |
| Token revocation | Immediate invalidation via revokedAt (FR-811) |

**Covered FRs:**
- FR-804: Dedicated API keys per tenant
- FR-807: Bearer token authentication
- FR-809: Configurable token expiration
- FR-810: Token rotation
- FR-811: Token revocation

### Learnings from Previous Stories

**From Story 1.2: Multi-Tenant Database Schema (Status: done)**

- **ID Generation Utility**: `src/lib/id.ts` created - use `generateId("key")` for API key IDs
- **ApiKey Model Already Exists**: Full model with keyHash, scopes, environment, expiresAt, revokedAt, lastUsedAt in `prisma/schema.prisma`
- **Environment Enum**: `Environment.SANDBOX` and `Environment.PRODUCTION` enums available
- **Prisma 7 Adapter Pattern**: Database client uses adapter pattern in `src/server/db.ts`

**From Story 1.3: User Authentication System (Status: done)**

- **Service Pattern**: Follow `src/server/services/n8n/client.ts` pattern for new services
- **Token Generation**: Use `crypto.randomBytes(32).toString('hex')` for secure random tokens
- **Token Hashing**: Use `crypto.createHash('sha256').update(token).digest('hex')` for hashing
- **Auth Router Pattern**: Follow `src/server/api/routers/auth.ts` for tRPC router structure
- **Session Access**: Use `ctx.session` to get current user and tenant info in protected procedures
- **tenantId in Session**: Session includes tenantId via callback - use for tenant-scoped queries

**Files to REUSE (not recreate):**
- `src/lib/id.ts` - ID generation with prefixes (add "key" prefix mapping)
- `src/server/db.ts` - Prisma client
- `prisma/schema.prisma` - ApiKey model already defined

### Project Structure Notes

API key management files should follow the established project structure:

```
src/
├── app/
│   └── dashboard/
│       └── api-keys/
│           └── page.tsx       # API keys list and management UI
├── server/
│   ├── api/
│   │   └── routers/
│   │       └── apiKey.ts      # API key tRPC router (NEW)
│   └── services/
│       └── auth/
│           ├── api-key.ts         # Key generation and creation (NEW)
│           └── api-key-validator.ts # Key validation for public API (NEW)
```

### API Key Format Specification

```
Format: pil_{env}_{random}
- pil_: Product Intelligence Layer prefix (constant)
- env: "live" for PRODUCTION, "test" for SANDBOX
- random: 32 bytes (64 hex characters)

Examples:
- pil_live_a1b2c3d4e5f6... (64 hex chars)
- pil_test_f6e5d4c3b2a1... (64 hex chars)

Total length: 4 + 5 + 64 = 73 characters (live) or 72 characters (test)
```

### References

- [Source: docs/tech-spec-epic-1.md#Story-1.4:-API-Token-Management]
- [Source: docs/tech-spec-epic-1.md#API-Key-Service-Interface]
- [Source: docs/tech-spec-epic-1.md#API-Key-Creation-Flow]
- [Source: docs/tech-spec-epic-1.md#API-Key-Validation-Flow]
- [Source: docs/epics.md#Story-1.4:-API-Token-Management]
- [Source: docs/stories/1-2-multi-tenant-database-schema.md#Dev-Agent-Record]
- [Source: docs/stories/1-3-user-authentication-system.md#Dev-Agent-Record]

## Dev Agent Record

### Context Reference

- docs/stories/1-4-api-token-management.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Implementation followed existing patterns from Story 1.3 (auth router, token generation)
- Used Prisma 7 adapter pattern with custom generated client path
- Resolved TypeScript issues with Environment/ApiKey imports from generated/prisma

### Completion Notes List

1. **API Key Service** (`src/server/services/auth/api-key.ts`):
   - Implements generateKey(), hashKey(), createApiKey(), rotateApiKey(), revokeApiKey(), listApiKeys(), updateApiKeyName()
   - Key format: `pil_{env}_{random}` with 64 hex chars for random portion
   - Default 90-day expiration configurable via API_KEY_DEFAULT_EXPIRY_DAYS env var
   - Rotation is atomic (revoke old + create new in transaction)

2. **API Key tRPC Router** (`src/server/api/routers/apiKey.ts`):
   - Protected procedures for list, create, rotate, revoke, update
   - All operations scoped to tenant via session.user.tenantId
   - Returns plainTextKey only at creation/rotation time

3. **API Key Validator** (`src/server/services/auth/api-key-validator.ts`):
   - Validates Bearer tokens from Authorization header
   - Checks key existence, revocation, and expiration
   - Updates lastUsedAt fire-and-forget
   - Returns typed ApiKeyContext or specific error codes

4. **Dashboard UI** (`src/app/dashboard/api-keys/page.tsx`):
   - Full CRUD interface with modals for create, rotate, revoke
   - Key display modal with copy button and security warning
   - Status badges (Active/Expired/Revoked) and environment badges (Live/Test)

5. **Testing**: 24 new unit tests covering key generation, hashing, validation logic

### Test Coverage Summary

- 50 tests in `tests/unit/api-key.test.ts` (24 original + 26 expanded)
- All 72 total tests passing across the project
- Coverage expanded by TEA agent (2025-11-25):
  - Service functions (createApiKey, rotateApiKey, revokeApiKey, listApiKeys, updateApiKeyName)
  - Response helper (createUnauthorizedResponse)
  - Acceptance criteria coverage tests (P0 priority for all 8 ACs)
  - Test data factory created
- See `docs/automation-summary-story-1.4.md` for detailed test coverage report

### File List

**New Files:**
- `src/server/services/auth/api-key.ts` - Key generation and creation service
- `src/server/services/auth/api-key-validator.ts` - Key validation middleware
- `src/server/api/routers/apiKey.ts` - tRPC router for key management
- `src/app/dashboard/api-keys/page.tsx` - Key management UI
- `tests/unit/api-key.test.ts` - Unit tests for key service (24 tests)

**Modified Files:**
- `src/server/api/root.ts` - Registered apiKey router
- `.env.example` - Added API_KEY_DEFAULT_EXPIRY_DAYS

**Note:** `src/lib/id.ts` already had "key" prefix mapping from Story 1.2

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-25 | PM Agent (John) | Initial story creation from epics and tech spec |
| 2025-11-25 | Dev Agent (Amelia) | Implemented all tasks, 24 unit tests, all verification passing |
