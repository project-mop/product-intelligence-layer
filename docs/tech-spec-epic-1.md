# Epic Technical Specification: Foundation & Infrastructure

Date: 2025-11-25
Author: Zac
Epic ID: 1
Status: Draft

---

## Overview

Epic 1 establishes the foundational infrastructure for the Product Intelligence Layer platform—a multi-tenant SaaS system that enables companies to convert product metadata into private intelligence APIs. This epic creates the secure, isolated environment required for enterprise customers, implementing the T3 stack (Next.js, tRPC, Prisma, NextAuth) as specified in the architecture document.

The foundation must support multi-tenant isolation from day one, as this is a core security requirement (FR-801 through FR-806). All subsequent epics depend on this infrastructure being correctly implemented with proper tenant boundaries, authentication, and audit capabilities.

## Objectives and Scope

### In Scope

- T3 stack project initialization with Next.js 15.5.x, TypeScript 5.9.x, tRPC 11.x, Prisma 7.x, NextAuth.js 5.x
- PostgreSQL database setup on Railway with multi-tenant schema
- Row-level security implementation for tenant isolation
- User authentication (signup, login, password reset) via NextAuth.js
- API token management (create, rotate, revoke, scope)
- Per-tenant encryption at rest for sensitive configuration
- Audit logging foundation for all tenant actions
- CI/CD pipeline configuration (GitHub Actions)
- Development environment setup scripts

### Out of Scope

- Intelligence definition UI (Epic 2)
- API endpoint generation (Epic 3)
- LLM integration (Epic 3)
- Rate limiting logic (Epic 7)
- Stripe billing integration (Epic 7)
- N8N email workflows (Epic 8)
- OAuth 2.0 SSO (Growth scope - FR-906)

## System Architecture Alignment

This epic implements the core infrastructure layer from the architecture document:

| Architecture Component | Epic 1 Implementation |
|------------------------|----------------------|
| Next.js App Router | Story 1.1 - Project scaffolding |
| Prisma + PostgreSQL | Stories 1.1, 1.2 - Database setup and schema |
| NextAuth.js | Story 1.3 - Authentication system |
| Tenant isolation | Story 1.2 - Row-level security |
| API key management | Story 1.4 - Token CRUD operations |
| Encryption at rest | Story 1.5 - Per-tenant encryption |
| Audit logging | Story 1.6 - Action logging foundation |

**Key Architecture Decisions Applied:**
- ADR-001: PostgreSQL as single data store (no Redis for MVP)
- ADR-003: tRPC for internal APIs (dashboard), REST for public APIs (future epics)

## Detailed Design

### Services and Modules

| Module | Location | Responsibility |
|--------|----------|----------------|
| Database Client | `src/server/db.ts` | Prisma client singleton with tenant context |
| Auth Config | `src/server/auth.ts` | NextAuth.js configuration |
| Auth Router | `src/server/api/routers/auth.ts` | tRPC procedures for auth operations |
| Tenant Router | `src/server/api/routers/tenant.ts` | Tenant management procedures |
| API Key Router | `src/server/api/routers/apiKey.ts` | Token CRUD procedures |
| API Key Service | `src/server/services/auth/api-key.ts` | Token validation, hashing, scoping |
| Encryption Service | `src/server/services/encryption/` | Per-tenant encryption utilities |
| Audit Service | `src/server/services/audit/` | Audit log writing |
| ID Generator | `src/lib/id.ts` | Prefixed ID generation (ten_, usr_, key_) |

### Data Models and Contracts

```prisma
// prisma/schema.prisma

model Tenant {
  id          String   @id @default(cuid()) // ten_*
  name        String
  encryptionKeyId String? // Reference to KMS key or encrypted key material
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  users       User[]
  apiKeys     ApiKey[]
  auditLogs   AuditLog[]
}

model User {
  id            String   @id @default(cuid()) // usr_*
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  email         String   @unique
  emailVerified DateTime?
  name          String?
  passwordHash  String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sessions      Session[]
  accounts      Account[]

  @@index([tenantId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expires      DateTime
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  @@unique([provider, providerAccountId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model ApiKey {
  id          String    @id @default(cuid()) // key_*
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id])
  name        String
  keyHash     String    @unique // SHA-256 hash of actual key
  keyPrefix   String    // First 8 chars for identification (e.g., "pil_live_")
  scopes      Json      @default("[]") // ["process:*"] or ["process:proc_123"]
  environment Environment @default(SANDBOX)
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())
  revokedAt   DateTime?
  lastUsedAt  DateTime?

  @@index([tenantId])
  @@index([keyHash])
}

model AuditLog {
  id         String   @id @default(cuid())
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id])
  userId     String?
  action     String   // e.g., "user.created", "apiKey.revoked"
  resource   String   // e.g., "user", "apiKey", "process"
  resourceId String?
  metadata   Json?    // Additional context
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([tenantId])
  @@index([tenantId, createdAt])
  @@index([action])
}

enum Environment {
  SANDBOX
  PRODUCTION
}
```

### APIs and Interfaces

#### tRPC Routers (Internal Dashboard)

**Auth Router** (`src/server/api/routers/auth.ts`)

| Procedure | Type | Input | Output | Notes |
|-----------|------|-------|--------|-------|
| `signup` | mutation | `{email, password, name}` | `{user, session}` | Creates tenant + user |
| `requestPasswordReset` | mutation | `{email}` | `{success}` | Sends reset email via N8N |
| `resetPassword` | mutation | `{token, newPassword}` | `{success}` | Validates token, updates password |

**API Key Router** (`src/server/api/routers/apiKey.ts`)

| Procedure | Type | Input | Output | Notes |
|-----------|------|-------|--------|-------|
| `list` | query | - | `ApiKey[]` | Lists all keys for tenant |
| `create` | mutation | `{name, scopes?, environment, expiresAt?}` | `{apiKey, plainTextKey}` | Returns key only once |
| `rotate` | mutation | `{id}` | `{apiKey, plainTextKey}` | Revokes old, creates new |
| `revoke` | mutation | `{id}` | `{success}` | Immediate revocation |
| `update` | mutation | `{id, name?, scopes?}` | `{apiKey}` | Update metadata only |

**Tenant Router** (`src/server/api/routers/tenant.ts`)

| Procedure | Type | Input | Output | Notes |
|-----------|------|-------|--------|-------|
| `get` | query | - | `Tenant` | Current tenant info |
| `update` | mutation | `{name}` | `{tenant}` | Update tenant name |

#### API Key Service Interface

```typescript
// src/server/services/auth/api-key.ts

interface ApiKeyService {
  // Generate a new API key
  generate(params: {
    tenantId: string;
    name: string;
    scopes: string[];
    environment: 'SANDBOX' | 'PRODUCTION';
    expiresAt?: Date;
  }): Promise<{ apiKey: ApiKey; plainTextKey: string }>;

  // Validate a key from Authorization header
  validate(authHeader: string | null): Promise<ApiKeyContext>;

  // Check if key has access to a specific process
  assertProcessAccess(ctx: ApiKeyContext, processId: string): void;

  // Rotate a key (revoke old, create new with same config)
  rotate(keyId: string, tenantId: string): Promise<{ apiKey: ApiKey; plainTextKey: string }>;

  // Immediately revoke a key
  revoke(keyId: string, tenantId: string): Promise<void>;
}

interface ApiKeyContext {
  tenantId: string;
  keyId: string;
  scopes: string[];
  environment: 'SANDBOX' | 'PRODUCTION';
}
```

### Workflows and Sequencing

#### User Signup Flow

```
1. User submits signup form (email, password, name)
2. Server validates input (email format, password strength)
3. Check email uniqueness across all tenants
4. Create new Tenant record
5. Create User record with hashed password, linked to tenant
6. Create Session
7. Write AuditLog: "user.created"
8. Trigger N8N welcome email webhook (fire-and-forget)
9. Return session token to client
```

#### API Key Creation Flow

```
1. User requests new API key via dashboard
2. Server validates user session and tenant context
3. Generate cryptographically secure random key (32 bytes)
4. Create key prefix: "pil_{env}_" (e.g., "pil_live_", "pil_test_")
5. Hash full key with SHA-256
6. Store: keyHash, keyPrefix, scopes, environment, expiresAt
7. Write AuditLog: "apiKey.created"
8. Return plainTextKey to user (shown only once)
```

#### API Key Validation Flow (for future public API use)

```
1. Extract Bearer token from Authorization header
2. Hash token with SHA-256
3. Query api_keys by keyHash
4. Check: not revoked, not expired
5. Update lastUsedAt (fire-and-forget)
6. Return ApiKeyContext with tenantId, scopes, environment
```

## Non-Functional Requirements

### Performance

| Metric | Target | Source |
|--------|--------|--------|
| Auth endpoint latency (signup/login) | P95 < 500ms | Baseline for user experience |
| API key validation latency | P95 < 50ms | Critical path for all public API calls |
| Database query latency | P95 < 100ms | Foundation for P95 < 2s API response target |

### Security

| Requirement | Implementation | FR Reference |
|-------------|----------------|--------------|
| Password hashing | bcrypt with cost factor 12 | FR-901, FR-902 |
| Session tokens | HTTP-only secure cookies via NextAuth | FR-902 |
| API key storage | SHA-256 hash only, never plaintext | FR-804, FR-807 |
| Token expiration | Default 90 days, configurable | FR-809 |
| Immediate revocation | Check revokedAt on every validation | FR-811 |
| Tenant isolation | Row-level filtering on ALL queries | FR-801, FR-802, FR-806 |
| Encryption at rest | AES-256 for sensitive tenant config | FR-803 |
| CSRF protection | Built into NextAuth | Standard |

### Reliability/Availability

| Requirement | Implementation |
|-------------|----------------|
| Database availability | Railway managed PostgreSQL with automatic failover |
| Session persistence | Database-backed sessions survive restarts |
| Graceful degradation | Auth failures return clear error messages |
| Data durability | Railway daily backups + WAL archiving |

### Observability

| Signal | Implementation |
|--------|----------------|
| Audit logs | All auth and key actions logged to `audit_logs` table |
| Structured logging | JSON format with request_id, tenant_id, user_id |
| Error tracking | Log stack traces for 5xx errors |
| Metrics | Request count and latency per endpoint (Railway built-in) |

## Dependencies and Integrations

### NPM Dependencies (from create-t3-app + additions)

| Package | Version | Purpose |
|---------|---------|---------|
| next | 15.5.x | Framework |
| typescript | 5.9.x | Language |
| @trpc/server | 11.x | API layer |
| @trpc/client | 11.x | API client |
| @trpc/react-query | 11.x | React integration |
| @prisma/client | 7.x | Database ORM |
| next-auth | 5.x (beta) | Authentication |
| bcryptjs | 2.x | Password hashing |
| zod | 3.x | Schema validation |
| tailwindcss | 4.x | Styling |

### External Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| Railway PostgreSQL | Database | `DATABASE_URL` env var |
| N8N (optional) | Welcome email webhook | `N8N_WEBHOOK_WELCOME_EMAIL` env var |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| prisma | Database migrations CLI |
| vitest | Unit testing |
| @testing-library/react | Component testing |
| eslint | Linting |
| prettier | Formatting |

## Acceptance Criteria (Authoritative)

### Story 1.1: Project Setup

1. Running `pnpm install && pnpm dev` starts the development server successfully
2. TypeScript compilation completes with zero errors
3. ESLint passes with zero warnings
4. Database migrations run successfully against local PostgreSQL
5. CI pipeline (GitHub Actions) runs on push to main branch
6. Environment variables are documented in `.env.example`

### Story 1.2: Multi-Tenant Database Schema

1. Tenant table exists with id, name, timestamps
2. All tenant-scoped tables have tenant_id foreign key
3. Prisma middleware automatically filters queries by tenant_id from session
4. Attempting to query data without tenant context throws an error
5. Index exists on tenant_id for all tenant-scoped tables

### Story 1.3: User Authentication

1. User can sign up with email and password; account is created
2. User receives confirmation of account creation
3. User can log in with correct credentials; session is established
4. User cannot log in with incorrect credentials; clear error returned
5. User can request password reset; receives email (via N8N webhook)
6. User can reset password with valid token; can log in with new password
7. Passwords are hashed (not stored in plaintext)
8. Sessions expire after configured period (default 30 days)

### Story 1.4: API Token Management

1. User can create a new API token from dashboard
2. Token is displayed only once at creation; cannot be retrieved later
3. Token includes environment prefix (pil_live_, pil_test_)
4. User can view list of tokens with: name, created date, last used, environment
5. User can rotate a token; old token immediately invalid, new token works
6. User can revoke a token; token immediately returns 401 on use
7. Tokens have configurable expiration (default 90 days)
8. Expired tokens return 401 with clear error message

### Story 1.5: Tenant Encryption at Rest

1. Sensitive tenant configuration fields are encrypted in database
2. Encryption uses AES-256 or equivalent
3. Different tenants cannot decrypt each other's data
4. Encryption keys are stored securely (environment variable or KMS reference)
5. Application can read/write encrypted fields transparently

### Story 1.6: Audit Logging

1. User signup creates audit log entry
2. User login creates audit log entry
3. API key creation creates audit log entry
4. API key revocation creates audit log entry
5. Audit logs include: timestamp, tenant_id, user_id, action, resource, IP address
6. Audit logs are immutable (no UPDATE or DELETE operations)
7. Audit logs are queryable by tenant_id and date range

## Traceability Mapping

| AC | Spec Section | Component(s) | Test Approach |
|----|--------------|--------------|---------------|
| 1.1.1-6 | Project Setup | Build system, CI | Automated CI checks |
| 1.2.1-5 | Data Models | Prisma schema, middleware | Integration tests |
| 1.3.1-8 | Auth Flow, Security | NextAuth, bcrypt | Unit + integration tests |
| 1.4.1-8 | API Key Service | apiKey router, service | Unit + integration tests |
| 1.5.1-5 | Encryption Service | encryption module | Unit tests with test keys |
| 1.6.1-7 | Audit Service | audit module, AuditLog model | Integration tests |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| NextAuth v5 is still in beta | Medium - potential breaking changes | Pin to specific version, monitor releases |
| Railway cold starts | Low - first request may be slow | Keep-alive with cron or Railway's always-on |
| Password reset email delivery | Medium - depends on N8N | Log webhook calls, implement retry queue if needed |

### Assumptions

1. Railway PostgreSQL provides adequate performance for MVP scale (1,000+ tenants)
2. Users accept email/password auth for MVP (no social login required yet)
3. Single-region deployment is acceptable for MVP (Railway default)
4. 90-day default token expiration is acceptable for target users

### Open Questions

1. **Q:** Should we implement email verification on signup for MVP?
   **Recommendation:** Skip for MVP, add in Growth phase. Reduces signup friction.

2. **Q:** Should API keys support custom prefixes per tenant?
   **Recommendation:** No, use standard prefixes (pil_live_, pil_test_) for consistency.

3. **Q:** What's the password policy for MVP?
   **Recommendation:** Minimum 8 characters, no complexity requirements. Add stricter policy post-MVP.

## Test Strategy Summary

### Test Levels

| Level | Framework | Coverage Focus |
|-------|-----------|----------------|
| Unit | Vitest | Services (encryption, API key hashing, ID generation) |
| Integration | Vitest + Prisma | Database operations, tenant isolation |
| E2E | Playwright | Auth flows (signup, login, password reset) |

### Key Test Scenarios

1. **Tenant Isolation:** Create two tenants, verify neither can access other's data
2. **API Key Lifecycle:** Create → use → rotate → verify old invalid → use new → revoke → verify invalid
3. **Auth Security:** Verify password hashing, session expiration, rate limiting on auth endpoints
4. **Audit Completeness:** Verify all specified actions create audit entries

### Test Data Strategy

- Use Prisma seed script for consistent test data
- Separate test database (Railway dev environment or local Docker)
- Clean database between test runs
