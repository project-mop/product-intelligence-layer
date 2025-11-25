# Product Intelligence Layer - Epic Breakdown

**Author:** Zac
**Date:** 2025-11-24
**Project Level:** Level 3 (Full Product)
**Target Scale:** Mid-market SaaS (1,000+ tenants)

---

## Overview

This document provides the complete epic and story breakdown for the Product Intelligence Layer, decomposing the 90 functional requirements from the [PRD](../Product_Intelligence_Layer_PRD.md) into implementable stories.

### Epic Summary

| Epic | Title | Stories | FRs Covered | Scope |
|------|-------|---------|-------------|-------|
| 1 | Foundation & Infrastructure | 5 | FR-801–802, FR-804–806, FR-901–903 | MVP |
| 2 | Intelligence Definition | 7 | FR-101–110 | MVP |
| 3 | API Generation & Endpoints | 6 | FR-201–206, FR-301–306, FR-308 | MVP |
| 4 | Schema Validation & Output | 6 | FR-501–513 | MVP |
| 5 | Environments & Versioning | 5 | FR-601–605, FR-309–312 | MVP |
| 6 | Observability & Logging | 6 | FR-307, FR-401–411 | MVP |
| 7A | Usage & Quotas | 5 | FR-701–706, FR-904–905 | MVP |
| 7B | Stripe Integration | 5 | FR-907–911 | MVP |
| 8 | External Integrations (N8N) | 4 | FR-912–915 | MVP |
| **Total** | | **49** | **90 FRs** | |

> **Note:** Story 1.5 (Tenant Encryption at Rest / FR-803) has been deferred to Growth phase. Platform-level encryption at rest (provided by Supabase/Vercel Postgres) is sufficient for MVP targeting mid-market ecommerce.

### FR Coverage Matrix

All 90 functional requirements are covered:

- **FR-100s (Intelligence Definition):** Epic 2
- **FR-200s (API Generation):** Epic 3
- **FR-300s (Endpoint Management):** Epics 3, 5
- **FR-400s (Call History & Logging):** Epic 6
- **FR-500s (Schema & Validation):** Epic 4
- **FR-600s (Environments):** Epic 5
- **FR-700s (Rate Limiting & Quotas):** Epic 7A
- **FR-800s (Security & Isolation):** Epic 1 (FR-803 deferred to Growth)
- **FR-900s (User Management + Stripe):** Epics 1, 7A, 7B
- **FR-910s (N8N Integration):** Epic 8

---

## Epic 1: Foundation & Infrastructure

**Goal:** Establish a deployable, secure, multi-tenant platform with user authentication and core infrastructure that enables all subsequent development.

**Value:** Without foundation, nothing else can be built. This epic creates the secure, isolated environment that enterprise customers require.

**FRs Covered:** FR-801, FR-802, FR-804, FR-805, FR-806, FR-807, FR-809, FR-810, FR-811, FR-901, FR-902, FR-903

> **Note:** FR-803 (per-tenant encryption) deferred to Growth phase.

---

### Story 1.1: Project Setup & Infrastructure Initialization

As a **developer**,
I want **the project scaffolded with build system, dependencies, and deployment pipeline**,
So that **the team has a consistent development environment and can deploy changes**.

**Acceptance Criteria:**

**Given** a new development environment
**When** I clone the repository and run the setup script
**Then** all dependencies are installed and the project builds successfully

**And** the project includes:
- TypeScript/Node.js backend configuration
- Database connection setup (PostgreSQL)
- Environment variable management
- Docker containerization
- CI/CD pipeline configuration (GitHub Actions)
- Local development scripts

**Prerequisites:** None (first story)

**Technical Notes:**
- Use monorepo structure if frontend included
- Configure for Anthropic Claude API integration
- Set up secrets management for API keys

---

### Story 1.2: Multi-Tenant Database Schema

As a **platform operator**,
I want **a database schema that isolates tenant data**,
So that **no customer can access another customer's data**.

**Acceptance Criteria:**

**Given** the database is initialized
**When** data is written for tenant A
**Then** tenant B cannot query or access that data

**And** the schema includes:
- Tenants table with unique identifiers
- Tenant ID foreign key on all tenant-scoped tables
- Row-level security policies enforced at database level
- Audit timestamp columns (created_at, updated_at)

**Prerequisites:** Story 1.1

**Technical Notes:**
- Covers FR-801 (isolated prompt logic), FR-802 (isolated config stores), FR-806 (no cross-tenant access)
- Consider PostgreSQL RLS (Row Level Security)
- Index tenant_id columns for performance

---

### Story 1.3: User Authentication System

As a **user**,
I want **to sign up, log in, and reset my password securely**,
So that **I can access my account and protect my data**.

**Acceptance Criteria:**

**Given** I am on the signup page
**When** I provide email and password
**Then** my account is created and I receive a confirmation email

**Given** I have an account
**When** I log in with correct credentials
**Then** I receive a session token and can access protected resources

**Given** I forgot my password
**When** I request a password reset
**Then** I receive an email with a secure reset link

**And** passwords are hashed using bcrypt with appropriate cost factor
**And** sessions expire after configurable period

**Prerequisites:** Story 1.2

**Technical Notes:**
- Covers FR-901 (signup), FR-902 (login), FR-903 (password reset)
- Use JWT for session tokens
- Implement rate limiting on auth endpoints to prevent brute force

---

### Story 1.4: API Token Management

As a **user**,
I want **to create, view, rotate, and revoke API tokens**,
So that **I can securely integrate my intelligences with external systems**.

**Acceptance Criteria:**

**Given** I am logged into my account
**When** I create a new API token
**Then** I receive a Bearer token that can authenticate API requests

**Given** I have an existing token
**When** I rotate the token
**Then** a new token is generated and the old token is invalidated

**Given** I have a compromised token
**When** I revoke it via dashboard
**Then** the token is immediately invalidated and returns 401 on use

**And** tokens display creation date and last used date
**And** tokens have configurable expiration (default 90 days)

**Prerequisites:** Story 1.3

**Technical Notes:**
- Covers FR-804 (dedicated API keys), FR-807 (Bearer auth), FR-809 (expiration), FR-810 (rotation), FR-811 (revocation)
- Store hashed tokens, not plaintext
- Show token only once at creation

---

### ~~Story 1.5: Tenant Encryption at Rest~~ (DEFERRED TO GROWTH)

> **Deferred:** Per-tenant encryption keys are an enterprise compliance feature. For MVP targeting mid-market ecommerce (Phase 1 beachhead), platform-level encryption at rest (provided by Supabase/Vercel Postgres) is sufficient. This story will be implemented in Growth phase when targeting enterprise manufacturing customers.

As a **security-conscious customer**,
I want **my data encrypted at rest with tenant-specific keys**,
So that **my data is protected even if storage is compromised**.

**Acceptance Criteria:**

**Given** data is stored for a tenant
**When** I examine the raw database/storage
**Then** sensitive fields are encrypted and unreadable without keys

**And** each tenant has isolated encryption context
**And** encryption uses AES-256 or equivalent
**And** key management follows security best practices

**Prerequisites:** Story 1.2

**Technical Notes:**
- Covers FR-803 (per-tenant encryption)
- Consider using cloud KMS (AWS KMS, GCP KMS) for key management
- Encrypt: intelligence definitions, prompt logic, API responses in logs

---

### Story 1.5: Audit Logging Foundation (was 1.6)

As a **platform operator**,
I want **all significant tenant actions logged for audit purposes**,
So that **we can investigate issues and demonstrate compliance**.

**Acceptance Criteria:**

**Given** a user performs an action (create, update, delete, auth)
**When** the action completes
**Then** an audit log entry is created with timestamp, user, action, and resource

**And** audit logs are immutable (append-only)
**And** audit logs include IP address and user agent
**And** logs are retained according to retention policy

**Prerequisites:** Story 1.3

**Technical Notes:**
- Covers FR-805 (audit logs)
- Store in separate audit table or logging service
- Consider structured logging (JSON format) for queryability

---

## Epic 2: Intelligence Definition

**Goal:** Enable users to create, edit, and manage intelligence definitions through an intuitive interface.

**Value:** This is the core user action—defining what intelligence they want. Without this, users cannot create any value.

**FRs Covered:** FR-101, FR-102, FR-103, FR-104, FR-105, FR-106, FR-107, FR-108, FR-109, FR-110

---

### Story 2.0: Development Seed Data

As a **developer**,
I want **seed data scripts that create sample tenants, users, and intelligence definitions**,
So that **I can test UI components and API endpoints without manual data entry**.

**Acceptance Criteria:**

**Given** a fresh database
**When** I run the seed script (`pnpm db:seed`)
**Then** sample data is created including:
- 2 test tenants (with different subscription tiers)
- 3 users per tenant (admin, developer, viewer roles)
- 5 sample intelligence definitions per tenant (various states: draft, sandbox, production)
- Sample API keys for testing

**And** seed data uses deterministic IDs for test assertions
**And** seed script is idempotent (can run multiple times safely)
**And** seed data is clearly marked as test data (prefixed names)

**Prerequisites:** Story 1.3, Story 2.1

**Technical Notes:**
- Create `prisma/seed.ts` following Prisma seeding conventions
- Include realistic ecommerce intelligence examples (product descriptions, attribute extraction)
- Add to `package.json` scripts: `"db:seed": "tsx prisma/seed.ts"`
- Consider separate `seed:minimal` for CI and `seed:full` for development

---

### Story 2.1: Intelligence Definition Data Model

As a **developer**,
I want **a data model that captures all aspects of an intelligence definition**,
So that **users can fully specify their intelligence requirements**.

**Acceptance Criteria:**

**Given** the intelligence definition schema
**When** I create a new definition
**Then** I can store: name, description, categories, subcategories, input attributes with types, components, goal statement, and output JSON schema

**And** definitions are tenant-scoped
**And** definitions have version tracking metadata
**And** definitions support draft vs published states

**Prerequisites:** Story 1.2

**Technical Notes:**
- Covers FR-101 through FR-107 (data model foundation)
- JSON/JSONB columns for flexible schema storage
- Consider validation of JSON schema syntax on save

---

### Story 2.2: Create Intelligence Definition UI

As a **product operations user**,
I want **to create a new intelligence definition through a web form**,
So that **I can define what intelligence I need without technical expertise**.

**Acceptance Criteria:**

**Given** I am logged in and on the dashboard
**When** I click "Create Intelligence"
**Then** I see a guided form to define my intelligence

**And** I can enter:
- Name and description
- Categories and subcategories (free-form or from suggestions)
- Input attributes with name, type, and description
- Goal statement in natural language
- Expected output format (guided JSON schema builder or raw JSON)

**Given** I complete the form
**When** I click "Save Draft"
**Then** my definition is saved and I can continue editing later

**Prerequisites:** Story 2.1, Story 1.3

**Technical Notes:**
- Covers FR-101 (create), FR-102 (categories), FR-103 (attributes), FR-105 (goal), FR-106 (output format), FR-107 (save)
- Consider step-by-step wizard for first-time users
- Validate JSON schema syntax before save

---

### Story 2.3: Define Components and Subcomponents

As a **user defining a complex product**,
I want **to specify components and subcomponents in my intelligence definition**,
So that **the intelligence understands the structure of my products**.

**Acceptance Criteria:**

**Given** I am editing an intelligence definition
**When** I add a component
**Then** I can specify component name, type, and nested subcomponents

**And** components support hierarchical nesting (at least 3 levels)
**And** each component can have its own attributes
**And** the UI visually represents the component hierarchy

**Prerequisites:** Story 2.2

**Technical Notes:**
- Covers FR-104 (components/subcomponents)
- Use tree structure in UI
- Store as nested JSON in database

---

### Story 2.4: Edit Intelligence Definition

As a **user**,
I want **to edit my existing intelligence definitions**,
So that **I can refine and improve them over time**.

**Acceptance Criteria:**

**Given** I have a saved intelligence definition
**When** I click "Edit" on the definition
**Then** I can modify all fields and save changes

**And** editing a published definition creates a new draft version
**And** I see a diff/comparison between versions
**And** changes are tracked with timestamps

**Prerequisites:** Story 2.2

**Technical Notes:**
- Covers FR-108 (edit)
- Draft edits don't affect published version until explicitly published
- Consider autosave for drafts

---

### Story 2.5: Duplicate Intelligence Definition

As a **user**,
I want **to duplicate an existing intelligence definition**,
So that **I can create variations without starting from scratch**.

**Acceptance Criteria:**

**Given** I have an existing intelligence definition
**When** I click "Duplicate"
**Then** a new definition is created with "(Copy)" appended to the name

**And** the duplicate is in draft state
**And** the duplicate has no version history (fresh start)
**And** I am redirected to edit the duplicate

**Prerequisites:** Story 2.2

**Technical Notes:**
- Covers FR-109 (duplicate)
- Deep copy all nested structures
- Generate new unique ID

---

### Story 2.6: Delete Intelligence Definition

As a **user**,
I want **to delete intelligence definitions I no longer need**,
So that **I can keep my workspace clean**.

**Acceptance Criteria:**

**Given** I have an intelligence definition
**When** I click "Delete" and confirm
**Then** the definition is soft-deleted and no longer visible

**And** associated API endpoints are disabled
**And** deletion requires confirmation dialog
**And** definitions with recent API calls show warning before deletion

**Prerequisites:** Story 2.2

**Technical Notes:**
- Covers FR-110 (delete)
- Soft delete (set deleted_at timestamp) for data recovery
- Consider 30-day retention before hard delete

---

## Epic 3: API Generation & Endpoints

**Goal:** Automatically generate callable API endpoints from intelligence definitions and provide management capabilities.

**Value:** This is the core product value—users get working API endpoints without writing code.

**FRs Covered:** FR-201, FR-202, FR-203, FR-204, FR-205, FR-206, FR-301, FR-303, FR-304, FR-306, FR-308

> **Note:** FR-307 (Export API Results) moved to Epic 6 (Story 6.6) due to dependency on call logging infrastructure.

---

### Story 3.1: Endpoint URL Generation

As a **user**,
I want **a unique API endpoint URL generated when I save my intelligence definition**,
So that **I can immediately start calling my intelligence API**.

**Acceptance Criteria:**

**Given** I save a complete intelligence definition
**When** the save completes
**Then** a unique endpoint URL is generated (e.g., `https://api.example.com/v1/intel/{tenant_id}/{intelligence_id}`)

**And** the URL is displayed prominently in the UI
**And** the URL is copyable with one click
**And** the endpoint is immediately callable (in sandbox mode)

**Prerequisites:** Story 2.2

**Technical Notes:**
- Covers FR-201 (generate URL), FR-202 (sandboxed config), FR-203 (Version 1)
- Use UUID for intelligence_id to prevent enumeration
- Endpoint routing handled by API gateway

---

### Story 3.2: LLM Gateway Integration

As a **system**,
I want **to route intelligence API calls through an LLM gateway**,
So that **requests are processed by the appropriate AI model**.

**Acceptance Criteria:**

**Given** an intelligence endpoint receives a valid request
**When** the request is processed
**Then** the system constructs a prompt from the intelligence definition and input data

**And** the prompt is sent to Anthropic Claude API
**And** the response is parsed and returned to the caller
**And** errors from the LLM are handled gracefully

**Prerequisites:** Story 3.1, Story 1.1 (API key configuration)

**Technical Notes:**
- Core processing logic
- Compile intelligence definition into system prompt
- Handle Claude API rate limits and errors
- Log all LLM interactions for debugging

---

### Story 3.3: In-Browser Endpoint Testing

As a **user**,
I want **to test my endpoint immediately in the browser**,
So that **I can verify it works before integrating**.

**Acceptance Criteria:**

**Given** I have a generated endpoint
**When** I click "Test" in the dashboard
**Then** I see a test console with pre-filled sample input

**Given** I enter input data and click "Send"
**When** the request completes
**Then** I see the formatted JSON response and latency

**And** I can edit the input and re-test
**And** I can see the raw request/response
**And** failed requests show clear error messages

**Prerequisites:** Story 3.2

**Technical Notes:**
- Covers FR-204 (test in browser), FR-205 (sample payloads), FR-303 (test with custom input)
- Sample payloads generated from input schema
- Test calls use sandbox environment

---

### Story 3.4: Intelligence List Dashboard

As a **user**,
I want **to view all my intelligences and their endpoints in a dashboard**,
So that **I can manage my intelligences effectively**.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to the dashboard
**Then** I see a list of all my intelligences with: name, status, endpoint URL, version, last called

**And** I can search and filter the list
**And** I can sort by name, date created, or last called
**And** each row has quick actions: Edit, Test, Copy URL, Delete

**Prerequisites:** Story 2.2, Story 3.1

**Technical Notes:**
- Covers FR-301 (view all intelligences)
- Paginate for users with many intelligences
- Show status indicators (draft, sandbox, production)

---

### Story 3.5: View JSON Schema

As a **developer integrating the API**,
I want **to view the JSON schema for any intelligence**,
So that **I can understand the expected input and output formats**.

**Acceptance Criteria:**

**Given** I select an intelligence
**When** I click "View Schema"
**Then** I see the input schema and output schema in formatted JSON

**And** I can copy the schema with one click
**And** I can download the schema as a file
**And** the schema includes descriptions for each field

**Prerequisites:** Story 2.2

**Technical Notes:**
- Covers FR-304 (view JSON schema)
- Syntax highlighting for JSON
- Consider OpenAPI spec generation

---

### Story 3.6: Auto-Generated API Documentation

As a **developer**,
I want **auto-generated API documentation for each endpoint**,
So that **I can integrate quickly without guessing**.

**Acceptance Criteria:**

**Given** an intelligence has a generated endpoint
**When** I click "API Docs"
**Then** I see documentation including: endpoint URL, authentication method, input schema, output schema, example request, example response, error codes

**And** documentation updates automatically when the intelligence changes
**And** I can access docs via a public URL (with optional auth)

**Prerequisites:** Story 3.5

**Technical Notes:**
- Covers FR-308 (auto-generated docs)
- Generate OpenAPI/Swagger spec
- Consider hosting docs on separate subdomain

---

### ~~Story 3.7: Export API Results~~ (MOVED TO EPIC 6)

> **Moved:** This story has been relocated to Epic 6 as Story 6.6 due to its dependency on call logging infrastructure (Story 6.1). See Epic 6 for the full story definition.

---

## Epic 4: Schema Validation & Output

**Goal:** Ensure all API responses are reliable, schema-constrained, and properly validated.

**Value:** This is what makes the product enterprise-ready—reliable, consistent outputs that integrate with ERP and commerce systems.

**FRs Covered:** FR-501, FR-502, FR-503, FR-504, FR-505, FR-506, FR-507, FR-508, FR-509, FR-510, FR-511, FR-512, FR-513

---

### Story 4.1: Input Schema Validation

As a **system**,
I want **to validate all incoming API requests against the expected input schema**,
So that **malformed requests are rejected before LLM processing**.

**Acceptance Criteria:**

**Given** an API request is received
**When** the input does not match the expected schema
**Then** a 400 error is returned with field-level validation errors

**And** validation errors include: field name, expected type, actual value, error message
**And** validation happens before any LLM call (saves costs)
**And** valid requests proceed to processing

**Prerequisites:** Story 3.2

**Technical Notes:**
- Covers FR-503 (validate input), FR-504 (reject with 400), FR-505 (field-level feedback)
- Use JSON Schema validation library (e.g., ajv)
- Return all validation errors, not just the first one

---

### Story 4.2: Output Schema Enforcement

As a **system**,
I want **to enforce that all LLM outputs conform to the defined JSON schema**,
So that **integrations can rely on consistent response structures**.

**Acceptance Criteria:**

**Given** the LLM returns a response
**When** the response is processed
**Then** it is validated against the output schema

**And** type coercion is attempted for minor mismatches
**And** missing required fields trigger retry with clarified prompt
**And** after max retries, return 500 with schema violation details

**Prerequisites:** Story 3.2

**Technical Notes:**
- Covers FR-501 (enforce output schema), FR-502 (type validation)
- Use Claude's JSON mode for structured output
- Implement retry logic (max 2 retries) for schema violations

---

### Story 4.3: Error Response Contract

As a **developer consuming the API**,
I want **consistent, predictable error responses**,
So that **I can handle errors programmatically**.

**Acceptance Criteria:**

**Given** any error occurs during API processing
**When** the error response is returned
**Then** it follows the standard format:
```json
{
  "error_code": "VALIDATION_ERROR",
  "message": "Human readable description",
  "details": { ... },
  "retry_after": 30
}
```

**And** 4xx errors indicate client issues (input, auth, rate limit)
**And** 5xx errors indicate server issues (LLM failure, timeout)
**And** retryable errors (429, 503) include `Retry-After` header

**Prerequisites:** Story 4.1

**Technical Notes:**
- Covers FR-506 (4xx), FR-507 (5xx), FR-508 (error structure), FR-509 (backoff guidance)
- Define exhaustive error code enum
- Document all error codes in API docs

---

### Story 4.4: LLM Unavailability Handling

As a **system**,
I want **to gracefully handle LLM provider unavailability**,
So that **consumers receive clear errors and can retry appropriately**.

**Acceptance Criteria:**

**Given** the LLM provider (Anthropic) is unavailable or times out
**When** an API request is made
**Then** a 503 Service Unavailable error is returned

**And** the error includes `retry_after` guidance
**And** the incident is logged for monitoring
**And** no partial or corrupted responses are returned

**Prerequisites:** Story 3.2

**Technical Notes:**
- Covers FR-510 (503 on LLM unavailability)
- Implement circuit breaker pattern
- Set reasonable timeouts (30s default)

---

### Story 4.5: Response Caching

As a **system**,
I want **to cache successful responses based on input hash**,
So that **identical requests return instantly and reduce LLM costs**.

**Acceptance Criteria:**

**Given** a successful API response
**When** an identical request is made within the TTL window
**Then** the cached response is returned immediately

**And** cache key is hash of: tenant_id + intelligence_id + input_hash
**And** cached responses include `X-Cache: HIT` header
**And** default TTL is 15 minutes

**Prerequisites:** Story 4.2

**Technical Notes:**
- Covers FR-511 (cache based on hash), FR-512 (return cached)
- Use Redis or similar for caching
- Consider cache invalidation on intelligence update

---

### Story 4.6: Configurable Cache TTL

As a **user**,
I want **to configure the cache TTL for each intelligence**,
So that **I can balance freshness vs. cost for my use case**.

**Acceptance Criteria:**

**Given** I am editing an intelligence definition
**When** I set a custom cache TTL
**Then** that TTL is used instead of the default

**And** I can set TTL from 0 (no cache) to 24 hours
**And** the current TTL is displayed in the dashboard
**And** setting TTL to 0 disables caching for that intelligence

**Prerequisites:** Story 4.5, Story 2.4

**Technical Notes:**
- Covers FR-513 (configurable TTL)
- Store TTL in intelligence definition
- Validate TTL range on save

---

## Epic 5: Environments & Versioning

**Goal:** Support sandbox/production environments and version management for enterprise-grade deployment workflows.

**Value:** This mirrors how ERP teams manage live data changes, reducing risk and enabling safe iteration.

**FRs Covered:** FR-601, FR-602, FR-603, FR-604, FR-605, FR-309, FR-310, FR-311, FR-312

---

### Story 5.1: Sandbox and Production Modes

As a **user**,
I want **each intelligence to have sandbox and production modes**,
So that **I can test changes safely before going live**.

**Acceptance Criteria:**

**Given** I create a new intelligence
**When** it is generated
**Then** it starts in sandbox mode by default

**And** sandbox and production have separate endpoint paths
**And** I can clearly see which mode I'm viewing in the UI
**And** sandbox mode is visually distinguished (e.g., yellow banner)

**Prerequisites:** Story 3.1

**Technical Notes:**
- Covers FR-601 (sandbox mode), FR-602 (production mode)
- Endpoint pattern: `/v1/sandbox/intel/{id}` vs `/v1/intel/{id}`
- Store mode flag per intelligence version

---

### Story 5.2: Separate API Keys per Environment

As a **security-conscious user**,
I want **sandbox and production to use separate API keys**,
So that **test keys can't accidentally access production**.

**Acceptance Criteria:**

**Given** I have API keys
**When** I view my keys
**Then** I see separate keys labeled "Sandbox" and "Production"

**And** sandbox keys only work on sandbox endpoints
**And** production keys only work on production endpoints
**And** I can rotate each independently

**Prerequisites:** Story 1.4, Story 5.1

**Technical Notes:**
- Covers FR-604 (separate keys)
- Add `environment` field to API token table
- Validate environment on every request

---

### Story 5.3: Promote to Production

As a **user**,
I want **to promote an intelligence from sandbox to production**,
So that **I can safely deploy tested changes**.

**Acceptance Criteria:**

**Given** I have an intelligence in sandbox mode
**When** I click "Promote to Production"
**Then** I see a confirmation dialog with change summary

**Given** I confirm the promotion
**When** the promotion completes
**Then** the intelligence is available on the production endpoint

**And** the sandbox version remains for continued testing
**And** promotion creates an audit log entry

**Prerequisites:** Story 5.1

**Technical Notes:**
- Covers FR-603 (promote)
- Copy current sandbox config to production
- Consider requiring successful test call before promotion

---

### Story 5.4: Version History and Rollback

As a **user**,
I want **to view version history and roll back to previous versions**,
So that **I can recover from bad deployments**.

**Acceptance Criteria:**

**Given** I select an intelligence
**When** I click "Version History"
**Then** I see a list of all versions with: version number, date, author, change summary

**Given** I select a previous version
**When** I click "Rollback"
**Then** that version becomes the active production version

**And** rollback creates a new version (doesn't delete history)
**And** I can compare any two versions side-by-side

**Prerequisites:** Story 5.3

**Technical Notes:**
- Covers FR-302 (version history), FR-305 (rollback), FR-309 (immutable versions)
- Store all versions, never overwrite
- Consider diff visualization for JSON schemas

---

### Story 5.5: Version Pinning and Deprecation

As a **API consumer**,
I want **to pin to a specific version and receive deprecation warnings**,
So that **my integrations don't break unexpectedly**.

**Acceptance Criteria:**

**Given** I am calling an intelligence endpoint
**When** I include `X-Version: 2` header
**Then** I receive the response from version 2 specifically

**Given** I am using a deprecated version
**When** I make an API call
**Then** I receive a `X-Deprecated: true` header with upgrade guidance

**And** version pinning only works for published versions
**And** default behavior uses latest production version

**Prerequisites:** Story 5.4

**Technical Notes:**
- Covers FR-310 (explicit publish), FR-311 (pin to version), FR-312 (deprecation warnings)
- Store deprecation status per version
- Include sunset date in deprecation header

---

## Epic 6: Observability & Logging

**Goal:** Provide comprehensive call history, metrics, and logging for transparency and debugging.

**Value:** Users need to see what's happening with their intelligences to build trust and debug issues.

**FRs Covered:** FR-307, FR-401, FR-402, FR-403, FR-404, FR-405, FR-406, FR-407, FR-408, FR-409, FR-410, FR-411

> **Note:** FR-307 (Export API Results) moved here from Epic 3 due to dependency on call logging.

---

### Story 6.1: Call Logging Infrastructure

As a **system**,
I want **to log every API call with comprehensive metadata**,
So that **users can review their usage and debug issues**.

**Acceptance Criteria:**

**Given** an API call is made
**When** the call completes (success or failure)
**Then** a log entry is created with: timestamp, tenant_id, intelligence_id, input (optionally anonymized), output, latency_ms, status_code, error_code (if any), model_used, endpoint_version

**And** logs are written asynchronously (don't block response)
**And** log storage is separate from main database
**And** logs are queryable by all fields

**Prerequisites:** Story 3.2

**Technical Notes:**
- Covers FR-401–407 (logging fields)
- Consider using dedicated logging database or service (e.g., ClickHouse, Elasticsearch)
- Index on tenant_id, intelligence_id, timestamp

---

### Story 6.2: Call History UI

As a **user**,
I want **to view call history for my intelligences in the dashboard**,
So that **I can monitor usage and debug issues**.

**Acceptance Criteria:**

**Given** I select an intelligence
**When** I click "Call History"
**Then** I see a table of recent calls with: timestamp, status, latency, truncated input/output

**Given** I click on a specific call
**When** the detail view opens
**Then** I see full input, full output, all metadata

**And** I can filter by: date range, status (success/error), latency threshold
**And** pagination handles large result sets
**And** real-time updates for new calls (optional refresh)

**Prerequisites:** Story 6.1, Story 3.4

**Technical Notes:**
- Covers FR-408 (view history in UI)
- Lazy-load full input/output to improve performance
- Consider WebSocket for real-time updates

---

### Story 6.3: 90-Day Log Retention

As a **platform operator**,
I want **call logs retained for 90 days then automatically deleted**,
So that **we manage storage costs while meeting user needs**.

**Acceptance Criteria:**

**Given** a call log is older than 90 days
**When** the retention job runs
**Then** the log is permanently deleted

**And** users see a warning when viewing logs approaching 90 days
**And** retention policy is documented in terms of service
**And** deletion is logged for compliance

**Prerequisites:** Story 6.1

**Technical Notes:**
- Covers FR-409 (90-day retention)
- Use scheduled job (daily) for cleanup
- Consider partitioning by date for efficient deletion

---

### Story 6.4: Log Export

As a **user**,
I want **to export my call logs before they expire**,
So that **I can retain records for my own compliance needs**.

**Acceptance Criteria:**

**Given** I am viewing call history
**When** I click "Export Logs"
**Then** I can select date range and format (CSV, JSON)

**Given** I confirm export
**When** the export completes
**Then** I receive a downloadable file with all log fields

**And** exports include all metadata (input, output, latency, etc.)
**And** large exports are processed asynchronously with email notification

**Prerequisites:** Story 6.2

**Technical Notes:**
- Covers FR-410 (export before expiration)
- Stream large exports to avoid memory issues
- Consider background job for exports > 10,000 records

---

### Story 6.5: Input Anonymization Toggle

As a **privacy-conscious user**,
I want **to toggle input anonymization per intelligence**,
So that **sensitive data isn't stored in logs**.

**Acceptance Criteria:**

**Given** I am editing an intelligence definition
**When** I enable "Anonymize Inputs in Logs"
**Then** API call inputs are hashed/redacted before storage

**And** anonymization is clearly indicated in call history view
**And** output is still stored (not anonymized)
**And** I can toggle this setting at any time

**Prerequisites:** Story 6.1, Story 2.4

**Technical Notes:**
- Covers FR-402 (optional anonymization), FR-411 (toggle per intelligence)
- Replace sensitive fields with hash or "[REDACTED]"
- Consider field-level anonymization rules

---

### Story 6.6: Export API Results (moved from Epic 3)

As a **user**,
I want **to export my API call results**,
So that **I can analyze them offline or share with colleagues**.

**Acceptance Criteria:**

**Given** I am viewing an intelligence's call history
**When** I click "Export"
**Then** I can download results as CSV or JSON

**And** I can select date range for export
**And** I can choose which fields to include
**And** export includes input, output, timestamp, and latency

**Prerequisites:** Story 6.1 (call logging), Story 6.2 (call history UI)

**Technical Notes:**
- Covers FR-307 (export results)
- Stream large exports to avoid memory issues
- Consider async export for large datasets (> 10,000 records)
- Reuse export infrastructure from Story 6.4 (Log Export)

---

## Epic 7A: Usage & Quotas

**Goal:** Enforce usage quotas, rate limits, and provide usage visibility for tenants.

**Value:** This enables fair resource usage across tenants and gives users visibility into their consumption.

**FRs Covered:** FR-701, FR-702, FR-703, FR-704, FR-705, FR-706, FR-904, FR-905

---

### Story 7A.1: Rate Limiting Infrastructure

As a **system**,
I want **to enforce per-endpoint rate limits**,
So that **no single tenant can overwhelm the system**.

**Acceptance Criteria:**

**Given** a tenant has a rate limit of 60 requests/minute
**When** they exceed this limit
**Then** subsequent requests receive 429 Too Many Requests

**And** rate limit is per endpoint (not global)
**And** response includes `Retry-After` header
**And** rate limits use sliding window algorithm

**Prerequisites:** Story 3.2

**Technical Notes:**
- Covers FR-701 (per-endpoint rate limits)
- Use Redis for distributed rate limiting
- Consider token bucket or sliding window log algorithm

---

### Story 7A.2: Monthly Quota Enforcement

As a **system**,
I want **to enforce tenant-level monthly quotas**,
So that **usage aligns with subscription tier**.

**Acceptance Criteria:**

**Given** a tenant on the Starter plan (1,000 calls/month)
**When** they reach 1,000 calls
**Then** subsequent calls are handled according to overage behavior setting

**And** quotas reset on billing cycle date
**And** current usage is tracked in real-time
**And** quota usage is visible in dashboard

**Prerequisites:** Story 7A.1, Story 6.1

**Technical Notes:**
- Covers FR-702 (monthly quotas)
- Track usage in dedicated counter table
- Consider eventual consistency for high throughput

---

### Story 7A.3: Overage Behavior Configuration

As a **user**,
I want **to configure what happens when I exceed my quota**,
So that **I control the trade-off between availability and cost**.

**Acceptance Criteria:**

**Given** I am in my account settings
**When** I configure overage behavior
**Then** I can choose: "Throttle" (block calls), "Alert Only" (allow + notify), or "Allow with Charges" (bill overage)

**And** my current setting is clearly displayed
**And** changing the setting takes effect immediately
**And** "Allow with Charges" requires payment method on file

**Prerequisites:** Story 7A.2

**Technical Notes:**
- Covers FR-703 (configurable overage)
- Default to "Throttle" for safety
- Overage rate from pricing tiers ($0.02-0.05/call)

---

### Story 7A.4: Usage Dashboard

As a **user**,
I want **to view my rate limits, quotas, and usage in the dashboard**,
So that **I can monitor and plan my usage**.

**Acceptance Criteria:**

**Given** I navigate to my account dashboard
**When** I view the usage section
**Then** I see: current plan, calls this month, quota remaining, rate limit per endpoint, overage charges (if any)

**And** I see a usage graph showing calls over time
**And** I see which intelligences use the most quota
**And** data refreshes in near real-time

**Prerequisites:** Story 7A.2

**Technical Notes:**
- Covers FR-704 (visible in dashboard), FR-905 (view usage metrics)
- Aggregate usage data hourly for historical graphs
- Real-time counter for current month

---

### Story 7A.5: Subscription Management

As a **user**,
I want **to view and manage my subscription tier**,
So that **I can upgrade or downgrade as my needs change**.

**Acceptance Criteria:**

**Given** I am in account settings
**When** I click "Manage Subscription"
**Then** I see my current plan and available plans with pricing

**Given** I select a new plan
**When** I confirm the change
**Then** my plan is updated (upgrade immediate, downgrade at period end)

**And** I see prorated charges for upgrades
**And** I can cancel my subscription with confirmation
**And** enterprise tier shows "Contact Sales"

**Prerequisites:** Story 7A.4

**Technical Notes:**
- Covers FR-904 (manage subscription), FR-705 (tier-based limits)
- Integrate with Stripe for billing
- Handle plan changes mid-cycle appropriately

---

## Epic 7B: Stripe Integration

**Goal:** Enable payment processing and subscription management via Stripe.

**Value:** This enables the business model with self-serve subscription management and payment processing.

**FRs Covered:** FR-907, FR-908, FR-909, FR-910, FR-911

**Prerequisites:** Epic 7A (particularly Story 7A.5 for subscription management UI)

---

### Story 7B.1: Stripe Account Integration (was 7.6)

As a **platform operator**,
I want **Stripe connected to the application with proper API key management**,
So that **we can process payments and manage subscriptions**.

**Acceptance Criteria:**

**Given** the application is deployed
**When** Stripe environment variables are configured
**Then** the application can authenticate with Stripe API

**And** separate API keys are used for test vs live mode
**And** API keys are stored securely (environment variables, not in code)
**And** Stripe SDK is initialized on server startup
**And** connection health is verified on startup with graceful degradation if unavailable

**Prerequisites:** Story 1.1

**Technical Notes:**
- Covers FR-907 (Stripe integration foundation)
- Use `stripe` npm package
- Store `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` in environment
- Add `STRIPE_WEBHOOK_SECRET` for webhook signature verification
- Create `src/server/services/stripe/` module following LLM gateway pattern

---

### Story 7B.2: Stripe Checkout for Subscriptions (was 7.7)

As a **user**,
I want **to subscribe to a paid plan via Stripe Checkout**,
So that **I can upgrade from free tier with a secure payment flow**.

**Acceptance Criteria:**

**Given** I am on the free tier
**When** I click "Upgrade to Starter/Growth/Professional"
**Then** I am redirected to Stripe Checkout with the correct plan pre-selected

**Given** I complete payment in Stripe Checkout
**When** payment succeeds
**Then** I am redirected back to the app with my plan upgraded

**And** Stripe Checkout shows plan name, price, and billing frequency
**And** failed payments show clear error and allow retry
**And** checkout session expires after 24 hours if not completed
**And** user's Stripe Customer ID is stored in our database

**Prerequisites:** Story 7B.1, Story 7A.5

**Technical Notes:**
- Covers FR-908 (Stripe Checkout integration)
- Use Stripe Checkout Sessions API (not embedded forms)
- Create checkout session server-side, redirect client-side
- Store `stripe_customer_id` on tenant record
- Map our plan tiers to Stripe Price IDs

---

### Story 7B.3: Stripe Webhook Handler (was 7.8)

As a **system**,
I want **to receive and process Stripe webhook events**,
So that **subscription changes are reflected in our system in real-time**.

**Acceptance Criteria:**

**Given** a subscription event occurs in Stripe
**When** the webhook is received at `/api/webhooks/stripe`
**Then** the event is verified using webhook signature

**Handle these events:**
- `checkout.session.completed` → Activate subscription, update tenant plan
- `customer.subscription.updated` → Sync plan changes (upgrade/downgrade)
- `customer.subscription.deleted` → Downgrade to free tier
- `invoice.payment_failed` → Flag account, trigger N8N alert workflow
- `invoice.paid` → Clear any payment failure flags

**And** webhook endpoint returns 200 quickly (process async if needed)
**And** duplicate events are handled idempotently (use event ID)
**And** unhandled event types are logged but don't error
**And** failed processing is logged with full context for debugging

**Prerequisites:** Story 7B.1

**Technical Notes:**
- Covers FR-909 (Stripe webhook handling)
- Create `/api/webhooks/stripe` route (NOT behind auth)
- Use `stripe.webhooks.constructEvent()` for signature verification
- Store processed event IDs to prevent duplicate processing
- Use pg-boss for async processing if webhook handling is slow

---

### Story 7B.4: Stripe Customer Portal (was 7.9)

As a **user**,
I want **to manage my payment methods and billing history via Stripe Customer Portal**,
So that **I can update my card or view invoices without custom UI**.

**Acceptance Criteria:**

**Given** I am a paying subscriber
**When** I click "Manage Billing" in account settings
**Then** I am redirected to Stripe Customer Portal

**In the portal I can:**
- View and download past invoices
- Update payment method
- View upcoming invoice
- Cancel subscription (with confirmation)

**Given** I make changes in the portal
**When** I return to the app
**Then** changes are reflected (via webhook processing)

**And** portal session has 24-hour expiry
**And** return URL brings user back to account settings

**Prerequisites:** Story 7B.3

**Technical Notes:**
- Covers FR-910 (self-serve billing management)
- Use Stripe Billing Portal API
- Configure allowed actions in Stripe Dashboard
- Create portal session server-side with return_url

---

### Story 7B.5: Stripe Test/Live Mode Management (was 7.10)

As a **developer**,
I want **clear separation between Stripe test and live modes**,
So that **we don't accidentally process real payments in development**.

**Acceptance Criteria:**

**Given** the app is in development/staging environment
**When** Stripe operations occur
**Then** they use Stripe test mode API keys

**Given** the app is in production environment
**When** Stripe operations occur
**Then** they use Stripe live mode API keys

**And** environment is determined by `NODE_ENV` and/or explicit `STRIPE_MODE` variable
**And** test mode is visually indicated in the UI (banner/badge)
**And** webhook endpoints work in both modes (separate webhook secrets)
**And** test mode uses Stripe test clocks for subscription testing if needed

**Prerequisites:** Story 7B.1

**Technical Notes:**
- Covers FR-911 (test/live mode separation)
- Use separate environment variables: `STRIPE_SECRET_KEY_TEST`, `STRIPE_SECRET_KEY_LIVE`
- Add `STRIPE_MODE` env var (test|live) as explicit override
- Log mode at startup for visibility
- Consider Stripe test clock integration for time-sensitive testing

---

## Epic 8: External Integrations (N8N)

**Goal:** Connect the application to N8N for automated email workflows and notifications.

**Value:** Enables transactional emails (welcome, alerts) without building email infrastructure in the app, per ADR-005.

**FRs Covered:** FR-912, FR-913, FR-914, FR-915

**Prerequisites Summary:**
- Story 8.1: Story 1.1 (project setup)
- Story 8.2: Story 8.1 + Story 1.3 (user auth)
- Story 8.3: Story 8.1 + Story 7A.2 (quotas)
- Story 8.4: Story 8.1 + Story 7B.3 (Stripe webhooks)

---

### Story 8.1: N8N Webhook Endpoint Configuration

As a **platform operator**,
I want **N8N webhook URLs configured in the application**,
So that **the app can trigger N8N workflows for various events**.

**Acceptance Criteria:**

**Given** N8N workflows are created with webhook triggers
**When** webhook URLs are added to environment configuration
**Then** the application can call those webhooks

**And** webhook URLs are stored as environment variables:
- `N8N_WEBHOOK_WELCOME_EMAIL`
- `N8N_WEBHOOK_QUOTA_ALERT`
- `N8N_WEBHOOK_PAYMENT_FAILED`

**And** a generic webhook client is created in `src/server/services/n8n/`
**And** webhook calls include authentication (shared secret or API key)
**And** failed webhook calls are logged but don't block primary operations
**And** webhook calls have 5-second timeout with no retry (fire-and-forget)

**Prerequisites:** Story 1.1

**Technical Notes:**
- Covers FR-912 (N8N integration foundation)
- Create `src/server/services/n8n/client.ts`
- Use simple fetch/axios with timeout
- Include `X-Webhook-Secret` header for N8N to verify source
- Webhook payloads should be typed interfaces

---

### Story 8.2: Welcome Email Workflow Trigger

As a **new user**,
I want **to receive a welcome email when I sign up**,
So that **I know my account was created and can get started**.

**Acceptance Criteria:**

**Given** a user completes signup
**When** their account is created successfully
**Then** the N8N welcome email webhook is triggered

**Webhook payload includes:**
- `email`: User's email address
- `name`: User's display name
- `tenant_id`: For tracking
- `signup_date`: ISO timestamp
- `plan`: "free" (initial plan)

**And** webhook is called asynchronously (doesn't block signup response)
**And** webhook failure doesn't prevent account creation
**And** webhook call is logged for debugging

**Prerequisites:** Story 8.1, Story 1.3

**Technical Notes:**
- Covers FR-913 (welcome email trigger)
- Call webhook in Story 1.3 signup flow after successful user creation
- Use pg-boss job if we want retry capability
- N8N workflow (external) sends actual email via SendGrid/Resend/etc.

---

### Story 8.3: Quota Alert Email Workflow Trigger

As a **user approaching my quota limit**,
I want **to receive an email alert before I hit my limit**,
So that **I can upgrade or adjust usage before service is impacted**.

**Acceptance Criteria:**

**Given** a tenant's usage reaches 80% of their monthly quota
**When** the threshold is crossed
**Then** the N8N quota alert webhook is triggered

**Given** a tenant's usage reaches 100% of their monthly quota
**When** the threshold is crossed
**Then** the N8N quota alert webhook is triggered with "limit_reached" flag

**Webhook payload includes:**
- `email`: Account owner's email
- `tenant_id`: Tenant identifier
- `tenant_name`: For email personalization
- `current_usage`: Number of calls used
- `quota_limit`: Plan's quota limit
- `usage_percentage`: 80 or 100
- `plan`: Current plan name
- `upgrade_url`: Deep link to upgrade page

**And** alerts are only sent once per threshold per billing cycle
**And** alert state is tracked to prevent duplicate emails
**And** webhook failure is logged but doesn't affect API calls

**Prerequisites:** Story 8.1, Story 7A.2

**Technical Notes:**
- Covers FR-914 (quota alert trigger)
- Add `quota_alert_sent_80` and `quota_alert_sent_100` flags to tenant or usage table
- Reset flags on billing cycle reset
- Check thresholds in Story 7.2 quota enforcement logic
- Consider pg-boss job for async webhook call

---

### Story 8.4: Payment Failed Email Workflow Trigger

As a **user with a failed payment**,
I want **to receive an email notification about the failure**,
So that **I can update my payment method and avoid service interruption**.

**Acceptance Criteria:**

**Given** Stripe sends an `invoice.payment_failed` webhook
**When** the webhook is processed (Story 7.8)
**Then** the N8N payment failed webhook is triggered

**Webhook payload includes:**
- `email`: Account owner's email
- `tenant_id`: Tenant identifier
- `tenant_name`: For email personalization
- `invoice_amount`: Amount that failed
- `failure_reason`: From Stripe (e.g., "card_declined")
- `retry_date`: When Stripe will retry (if applicable)
- `update_payment_url`: Deep link to billing settings

**And** email is only sent once per failed invoice (not on Stripe retries)
**And** webhook failure is logged for debugging

**Prerequisites:** Story 8.1, Story 7B.3

**Technical Notes:**
- Covers FR-915 (payment failure notification)
- Trigger from Story 7.8 webhook handler
- Track notified invoice IDs to prevent duplicates
- N8N workflow (external) can include urgency based on retry count

---

## FR Traceability Matrix

| FR ID | Requirement | Epic | Story |
|-------|-------------|------|-------|
| FR-101 | Create intelligence definition | 2 | 2.2 |
| FR-102 | Define categories/subcategories | 2 | 2.2 |
| FR-103 | Define input attributes with types | 2 | 2.2 |
| FR-104 | Define components/subcomponents | 2 | 2.3 |
| FR-105 | Specify goal in natural language | 2 | 2.2 |
| FR-106 | Define output format via JSON schema | 2 | 2.2 |
| FR-107 | Save definition | 2 | 2.2 |
| FR-108 | Edit existing definitions | 2 | 2.4 |
| FR-109 | Duplicate definition | 2 | 2.5 |
| FR-110 | Delete definition | 2 | 2.6 |
| FR-201 | Generate unique endpoint URL | 3 | 3.1 |
| FR-202 | Generate sandboxed configuration | 3 | 3.1 |
| FR-203 | Create Version 1 on generation | 3 | 3.1 |
| FR-204 | Test endpoint in browser | 3 | 3.3 |
| FR-205 | Provide sample payloads | 3 | 3.3 |
| FR-206 | Validate completeness before generation | 3 | 3.1 |
| FR-301 | View all intelligences/endpoints | 3 | 3.4 |
| FR-302 | View version history | 5 | 5.4 |
| FR-303 | Test with custom input | 3 | 3.3 |
| FR-304 | View JSON schema | 3 | 3.5 |
| FR-305 | Roll back to previous version | 5 | 5.4 |
| FR-306 | Disable/enable API keys | 1 | 1.4 |
| FR-307 | Export results | 6 | 6.6 |
| FR-308 | Auto-generated API documentation | 3 | 3.6 |
| FR-309 | Immutable versions in production | 5 | 5.4 |
| FR-310 | Explicit publish action | 5 | 5.5 |
| FR-311 | Pin to specific version | 5 | 5.5 |
| FR-312 | Deprecation warnings | 5 | 5.5 |
| FR-401 | Log every API call | 6 | 6.1 |
| FR-402 | Store input snapshot | 6 | 6.1, 6.5 |
| FR-403 | Store output | 6 | 6.1 |
| FR-404 | Record latency | 6 | 6.1 |
| FR-405 | Record errors | 6 | 6.1 |
| FR-406 | Record model used | 6 | 6.1 |
| FR-407 | Record endpoint version | 6 | 6.1 |
| FR-408 | View call history in UI | 6 | 6.2 |
| FR-409 | 90-day log retention | 6 | 6.3 |
| FR-410 | Export logs before expiration | 6 | 6.4 |
| FR-411 | Toggle input anonymization | 6 | 6.5 |
| FR-501 | Enforce output JSON schema | 4 | 4.2 |
| FR-502 | Type validation on outputs | 4 | 4.2 |
| FR-503 | Validate input against schema | 4 | 4.1 |
| FR-504 | Reject malformed with 400 | 4 | 4.1 |
| FR-505 | Field-level validation feedback | 4 | 4.1 |
| FR-506 | 4xx for client errors | 4 | 4.3 |
| FR-507 | 5xx for server errors | 4 | 4.3 |
| FR-508 | Structured error JSON | 4 | 4.3 |
| FR-509 | Exponential backoff guidance | 4 | 4.3 |
| FR-510 | 503 on LLM unavailability | 4 | 4.4 |
| FR-511 | Cache based on input hash | 4 | 4.5 |
| FR-512 | Return cached response | 4 | 4.5 |
| FR-513 | Configurable cache TTL | 4 | 4.6 |
| FR-601 | Sandbox mode | 5 | 5.1 |
| FR-602 | Production mode | 5 | 5.1 |
| FR-603 | Promote sandbox to production | 5 | 5.3 |
| FR-604 | Separate API keys per environment | 5 | 5.2 |
| FR-605 | Sandbox calls don't count against quota | 7A | 7A.2 |
| FR-701 | Per-endpoint rate limits | 7A | 7A.1 |
| FR-702 | Tenant-level monthly quotas | 7A | 7A.2 |
| FR-703 | Configurable overage behavior | 7A | 7A.3 |
| FR-704 | Limits visible in dashboard | 7A | 7A.4 |
| FR-705 | Tier-based rate limits | 7A | 7A.5 |
| FR-706 | Quota limit alerts | 7A | 7A.4 |
| FR-801 | Isolated prompt logic | 1 | 1.2 |
| FR-802 | Isolated config stores | 1 | 1.2 |
| FR-803 | Per-tenant encryption | — | Growth (deferred) |
| FR-804 | Dedicated API keys | 1 | 1.4 |
| FR-805 | Audit logs | 1 | 1.5 |
| FR-806 | No cross-tenant access | 1 | 1.2 |
| FR-807 | Bearer token authentication | 1 | 1.4 |
| FR-808 | Token scope per-intelligence | 1 | 1.4 |
| FR-809 | Configurable token expiration | 1 | 1.4 |
| FR-810 | Token rotation | 1 | 1.4 |
| FR-811 | Token revocation | 1 | 1.4 |
| FR-812 | Isolated embeddings storage | — | Growth (deferred) |
| FR-901 | User signup | 1 | 1.3 |
| FR-902 | User login | 1 | 1.3 |
| FR-903 | Password reset | 1 | 1.3 |
| FR-904 | Manage subscription | 7A | 7A.5 |
| FR-905 | View usage metrics | 7A | 7A.4 |
| FR-906 | OAuth 2.0 SSO | — | Growth (deferred) |
| FR-907 | Stripe integration foundation | 7B | 7B.1 |
| FR-908 | Stripe Checkout integration | 7B | 7B.2 |
| FR-909 | Stripe webhook handling | 7B | 7B.3 |
| FR-910 | Self-serve billing management | 7B | 7B.4 |
| FR-911 | Stripe test/live mode separation | 7B | 7B.5 |
| FR-912 | N8N integration foundation | 8 | 8.1 |
| FR-913 | Welcome email trigger | 8 | 8.2 |
| FR-914 | Quota alert trigger | 8 | 8.3 |
| FR-915 | Payment failure notification | 8 | 8.4 |

---

## Sequencing Summary

```
Epic 1: Foundation (5 stories) ← Story 1.5 deferred to Growth
    ↓
Epic 2: Intelligence Definition (7 stories) ← Added Story 2.0 (seed data)
    ↓
Epic 3: API Generation & Endpoints (6 stories) ← Story 3.7 moved to Epic 6
    ↓
Epic 4: Schema Validation & Output (6 stories)
    ↓
Epic 5: Environments & Versioning (5 stories)
    ↓
Epic 6: Observability & Logging (6 stories) ← Added Story 6.6 (export results)
    ↓
Epic 7A: Usage & Quotas (5 stories) ← Split from Epic 7
    ↓
Epic 7B: Stripe Integration (5 stories) ← Split from Epic 7 (can parallelize)
    ↓
Epic 8: External Integrations - N8N (4 stories)
```

**Total: 49 stories covering 90 FRs (87 MVP + 3 Growth deferred)**

> **Parallelization Note:** Epic 7B (Stripe) can be developed in parallel with Epic 7A once Story 7A.5 (Subscription Management UI) is complete, as Stripe provides the payment backend for that UI.

---

## Growth Scope Items (Deferred)

The following FRs are tagged as Growth scope and not included in MVP stories:

| FR ID | Requirement | Notes |
|-------|-------------|-------|
| FR-312 | Deprecation warnings | Included in Story 5.5 (MVP) |
| FR-411 | Toggle input anonymization | Included in Story 6.5 (MVP) |
| FR-703 | Configurable overage behavior | Included in Story 7A.3 (MVP) |
| FR-706 | Quota limit alerts | Included in Story 7A.4 (MVP) |
| FR-803 | Per-tenant encryption | **Deferred** — Platform-level encryption sufficient for MVP |
| FR-812 | Isolated embeddings storage | Deferred to Growth phase |
| FR-906 | OAuth 2.0 SSO | Deferred to Growth phase |

Note: FR-803 was deferred because mid-market ecommerce customers (Phase 1 beachhead) don't typically require per-tenant encryption keys. Platform-level encryption at rest (provided by Supabase/Vercel Postgres) meets their security requirements. This feature will be implemented in Growth phase when targeting enterprise manufacturing customers with stricter compliance needs.

---

_For implementation: Use the architecture workflow to generate technical design, then the `create-story` workflow to generate individual story implementation plans from this epic breakdown._
