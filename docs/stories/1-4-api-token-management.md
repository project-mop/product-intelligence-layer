# Story 1.4: API Token Management

Status: drafted

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

- [ ] **Task 1: Create API Key Service** (AC: 1, 2, 3, 7)
  - [ ] Create `src/server/services/auth/api-key.ts`
  - [ ] Implement `generateKey()` - creates cryptographically secure key with prefix
  - [ ] Implement `hashKey()` - SHA-256 hash for storage
  - [ ] Implement `createApiKey()` - stores hashed key, returns plaintext once
  - [ ] Key format: `pil_{env}_{random}` where env is `live` or `test`, random is 32 bytes hex
  - [ ] Default expiration: 90 days from creation (configurable via env)

- [ ] **Task 2: Create API Key tRPC Router** (AC: 1, 2, 4, 5, 6, 7)
  - [ ] Create `src/server/api/routers/apiKey.ts`
  - [ ] Implement `list` query - returns all keys for tenant (without plaintext)
  - [ ] Implement `create` mutation - creates new key, returns ApiKey + plainTextKey
  - [ ] Implement `rotate` mutation - revokes old key, creates new with same config
  - [ ] Implement `revoke` mutation - sets revokedAt timestamp
  - [ ] Implement `update` mutation - update name only (scopes in future epic)
  - [ ] Register router in `src/server/api/root.ts`

- [ ] **Task 3: Implement API Key Validation Middleware** (AC: 6, 8)
  - [ ] Create `src/server/services/auth/api-key-validator.ts`
  - [ ] Implement `validateApiKey(authHeader)` - extracts, hashes, queries, validates
  - [ ] Check: key exists, not revoked, not expired
  - [ ] Return `ApiKeyContext` with tenantId, keyId, scopes, environment
  - [ ] Update `lastUsedAt` on successful validation (fire-and-forget)
  - [ ] Return appropriate error codes: 401 for invalid/revoked/expired

- [ ] **Task 4: Create API Keys Management UI** (AC: 1, 2, 3, 4, 5, 6)
  - [ ] Create `src/app/dashboard/api-keys/page.tsx` - list view
  - [ ] Display table: name, environment (badge), created, last used, actions
  - [ ] Create modal for new key creation with name and environment selection
  - [ ] Show plaintext key ONCE with copy button and warning
  - [ ] Add rotate button with confirmation dialog
  - [ ] Add revoke button with confirmation dialog
  - [ ] Show revoked keys with strikethrough or badge

- [ ] **Task 5: Write Audit Log Entries** (AC: all)
  - [ ] Log `apiKey.created` on key creation
  - [ ] Log `apiKey.rotated` on key rotation (include old key ID)
  - [ ] Log `apiKey.revoked` on key revocation
  - [ ] Include IP address and user agent in audit context

- [ ] **Task 6: Testing** (AC: 1-8)
  - [ ] Unit tests for key generation (format, uniqueness)
  - [ ] Unit tests for key hashing (deterministic)
  - [ ] Unit tests for validation logic (expired, revoked, invalid)
  - [ ] Integration tests for CRUD operations
  - [ ] Test token expiration behavior

- [ ] **Task 7: Verification** (AC: 1-8)
  - [ ] Run `pnpm typecheck` - zero errors
  - [ ] Run `pnpm lint` - zero warnings
  - [ ] Run `pnpm build` - successful build
  - [ ] Run `pnpm test` - all tests pass
  - [ ] Manual testing of key lifecycle

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

- (To be created when story moves to ready-for-dev)

### Agent Model Used

(To be filled by dev agent)

### Debug Log References

(To be filled by dev agent)

### Completion Notes List

(To be filled by dev agent)

### Test Coverage Summary

(To be filled by TEA agent)

### File List

**New Files (Expected):**
- `src/server/services/auth/api-key.ts` - Key generation and creation service
- `src/server/services/auth/api-key-validator.ts` - Key validation middleware
- `src/server/api/routers/apiKey.ts` - tRPC router for key management
- `src/app/dashboard/api-keys/page.tsx` - Key management UI
- `tests/unit/api-key.test.ts` - Unit tests for key service

**Modified Files (Expected):**
- `src/server/api/root.ts` - Register apiKey router
- `src/lib/id.ts` - Add "key" prefix mapping
- `.env.example` - Add API_KEY_DEFAULT_EXPIRY_DAYS

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-25 | PM Agent (John) | Initial story creation from epics and tech spec |
