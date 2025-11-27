# Epic Technical Specification: Intelligence Definition

Date: 2025-11-26
Author: Zac
Epic ID: 2
Status: Complete

---

## Overview

Epic 2 delivers the core user-facing functionality of the Product Intelligence Layer platform: the ability for users to create, edit, and manage intelligence definitions through an intuitive web interface. This is where users define what intelligence they need—specifying input schemas, goals, output formats, and component hierarchies—without writing prompts or managing LLMs.

This epic implements the "Define → Generate → Done" magic moment described in the UX specification. Users will interact with a template-first creation wizard that progressively discloses complexity, allowing non-technical ecommerce teams to build AI-powered APIs in under 5 minutes. The intelligence definition data model serves as the foundation for all subsequent epics (API generation, schema validation, versioning).

**FRs Covered:** FR-101 through FR-110 (Intelligence Definition requirements)

## Objectives and Scope

### In Scope

- Intelligence Definition data model (Prisma schema for processes, process versions, and related entities)
- tRPC routers for intelligence CRUD operations (create, read, update, delete, duplicate)
- Create Intelligence wizard UI with template selection and progressive disclosure
- Schema Builder component for visual input/output field definition
- Components and subcomponents hierarchy support (nested JSON structures)
- Goal/purpose specification in natural language
- JSON schema builder/editor for output format definition
- Draft vs. published state management
- Development seed data script for testing (`pnpm db:seed`)
- Dashboard integration with intelligence card gallery view

### Out of Scope

- API endpoint generation (Epic 3)
- LLM gateway integration (Epic 3)
- In-browser endpoint testing (Epic 3)
- Schema validation at runtime (Epic 4)
- Response caching (Epic 4)
- Environment management (sandbox/production) (Epic 5)
- Version history and rollback (Epic 5)
- Call logging (Epic 6)
- Rate limiting and quotas (Epic 7A)
- Stripe billing (Epic 7B)

## System Architecture Alignment

This epic builds on the Epic 1 foundation and implements the intelligence definition layer from the architecture document:

| Architecture Component | Epic 2 Implementation |
|------------------------|----------------------|
| Prisma Data Models | Stories 2.0, 2.1 - Process and ProcessVersion schemas |
| tRPC Routers | Stories 2.1-2.6 - process.ts router with CRUD operations |
| Dashboard UI | Stories 2.2-2.6 - Intelligence management screens |
| shadcn/ui Components | Stories 2.2, 2.3 - Schema Builder, Template Picker, Wizard |
| JSON Schema Storage | Story 2.1 - input_schema and output_schema columns |

**Key Architecture Decisions Applied:**
- ADR-003: tRPC for all internal dashboard operations (type-safe end-to-end)
- UX Spec: Warm Coral theme, template-first wizard, progressive disclosure pattern
- Data model stores JSON schemas in JSONB columns for flexible field definitions

## Detailed Design

### Services and Modules

| Module | Location | Responsibility |
|--------|----------|----------------|
| Process Router | `src/server/api/routers/process.ts` | tRPC procedures for intelligence CRUD |
| Process Service | `src/server/services/process/` | Business logic for process management |
| Schema Service | `src/server/services/schema/` | JSON schema validation and manipulation |
| Seed Script | `prisma/seed.ts` | Development seed data generation |
| Intelligence Card | `src/components/dashboard/IntelligenceCard.tsx` | Card component for gallery view |
| Schema Builder | `src/components/process/SchemaBuilder.tsx` | Visual field definition UI |
| Template Picker | `src/components/process/TemplatePicker.tsx` | Template selection grid |
| Create Wizard | `src/app/(dashboard)/processes/new/` | Multi-step creation wizard |
| Process List | `src/app/(dashboard)/processes/page.tsx` | Intelligence gallery dashboard |
| Process Edit | `src/app/(dashboard)/processes/[id]/edit/` | Edit intelligence UI |

### Data Models and Contracts

```prisma
// prisma/schema.prisma - additions for Epic 2

model Process {
  id              String   @id // proc_* prefix
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  name            String
  description     String?

  // Schema definitions
  inputSchema     Json     // JSON Schema for input validation
  outputSchema    Json     // JSON Schema for output structure

  // Metadata
  categories      String[] // e.g., ["ecommerce", "product-description"]

  // Lifecycle
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime? // Soft delete

  versions        ProcessVersion[]

  @@index([tenantId])
  @@index([tenantId, deletedAt])
}

model ProcessVersion {
  id              String      @id // procv_* prefix
  processId       String
  process         Process     @relation(fields: [processId], references: [id])

  version         String      // Semantic version "1.0.0"

  // Configuration (stored as JSON for flexibility)
  config          Json        // ProcessConfig type

  // State management
  status          ProcessVersionStatus @default(DRAFT)

  // Timestamps
  createdAt       DateTime    @default(now())
  publishedAt     DateTime?   // When promoted to sandbox/production
  deprecatedAt    DateTime?   // When superseded by newer version

  // Call logs reference (Epic 6)
  // callLogs     CallLog[]

  @@index([processId])
  @@index([processId, status])
}

enum ProcessVersionStatus {
  DRAFT       // Being edited, not callable
  SANDBOX     // Testing environment
  PRODUCTION  // Live traffic
  DEPRECATED  // Replaced by newer version
}

// TypeScript interface for ProcessVersion.config JSON column
// Defined in src/server/services/process/types.ts
interface ProcessConfig {
  // LLM Settings
  systemPrompt: string;           // Base prompt compiled from user inputs
  additionalInstructions?: string; // User-provided extra guidance
  maxTokens: number;              // Max response tokens (default: 1024)
  temperature: number;            // LLM temperature (default: 0.3)

  // Schema descriptions for prompt assembly
  inputSchemaDescription: string;  // Human-readable input description
  outputSchemaDescription: string; // Human-readable output description

  // Goal/purpose (FR-105)
  goal: string;                   // Natural language goal statement

  // Components hierarchy (FR-104)
  components?: ComponentDefinition[];

  // Caching (defaults, configurable in Epic 4)
  cacheTtlSeconds: number;        // Default: 900 (15 min)
  cacheEnabled: boolean;          // Default: true

  // Rate limiting (defaults, configurable in Epic 7A)
  requestsPerMinute: number;      // Default: 60
}

interface ComponentDefinition {
  name: string;
  type: string;
  attributes?: AttributeDefinition[];
  subcomponents?: ComponentDefinition[]; // Recursive nesting
}

interface AttributeDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required: boolean;
}
```

### Input/Output Schema Structure

The `inputSchema` and `outputSchema` fields store JSON Schema Draft 7 compatible schemas:

```typescript
// Example inputSchema for a product description intelligence
{
  "type": "object",
  "required": ["productName", "category"],
  "properties": {
    "productName": {
      "type": "string",
      "description": "The name of the product"
    },
    "category": {
      "type": "string",
      "description": "Product category (e.g., 'Electronics', 'Clothing')"
    },
    "attributes": {
      "type": "object",
      "description": "Key-value pairs of product attributes",
      "additionalProperties": { "type": "string" }
    },
    "targetAudience": {
      "type": "string",
      "description": "Target customer segment"
    }
  }
}

// Example outputSchema for structured product intelligence
{
  "type": "object",
  "required": ["shortDescription", "longDescription", "seoTitle"],
  "properties": {
    "shortDescription": {
      "type": "string",
      "maxLength": 160,
      "description": "Brief product summary for listings"
    },
    "longDescription": {
      "type": "string",
      "description": "Detailed product description"
    },
    "seoTitle": {
      "type": "string",
      "maxLength": 60,
      "description": "SEO-optimized page title"
    },
    "bulletPoints": {
      "type": "array",
      "items": { "type": "string" },
      "maxItems": 5,
      "description": "Key selling points"
    }
  }
}
```

### APIs and Interfaces

#### tRPC Process Router (`src/server/api/routers/process.ts`)

| Procedure | Type | Input | Output | Notes |
|-----------|------|-------|--------|-------|
| `list` | query | `{status?, search?}` | `Process[]` | List intelligences with filtering |
| `get` | query | `{id}` | `Process & {versions}` | Get single intelligence with versions |
| `create` | mutation | `CreateProcessInput` | `{process, version}` | Creates process + initial draft version |
| `update` | mutation | `{id, ...UpdateProcessInput}` | `Process` | Update process metadata |
| `updateVersion` | mutation | `{versionId, config}` | `ProcessVersion` | Update draft version config |
| `duplicate` | mutation | `{id}` | `{process, version}` | Deep copy with "(Copy)" suffix |
| `delete` | mutation | `{id}` | `{success}` | Soft delete |
| `restore` | mutation | `{id}` | `Process` | Restore soft-deleted process |

#### Input Types

```typescript
// src/server/api/routers/process.ts

const createProcessSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  categories: z.array(z.string()).default([]),
  inputSchema: z.record(z.unknown()), // JSON Schema
  outputSchema: z.record(z.unknown()), // JSON Schema
  config: z.object({
    goal: z.string().min(1).max(1000),
    components: z.array(componentSchema).optional(),
    maxTokens: z.number().min(100).max(4096).default(1024),
    temperature: z.number().min(0).max(1).default(0.3),
  }),
  templateId: z.string().optional(), // If created from template
});

const updateProcessSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  categories: z.array(z.string()).optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
});

const componentSchema: z.ZodType<ComponentDefinition> = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    attributes: z.array(attributeSchema).optional(),
    subcomponents: z.array(componentSchema).optional(),
  })
);

const attributeSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  description: z.string().optional(),
  required: z.boolean().default(false),
});
```

### Workflows and Sequencing

#### Create Intelligence Flow (Story 2.2)

```
1. User clicks "Create Intelligence" on dashboard
2. Template Picker displays available templates:
   - Product Description Generator
   - SEO Meta Generator
   - Category Classifier
   - Attribute Extractor
   - Blank (start from scratch)
3. User selects template (or blank)
4. Wizard Step 1: Name & Description
   - Pre-filled if template selected
   - User can modify
5. Wizard Step 2: Input Schema (Schema Builder)
   - Visual field editor
   - Add/remove fields
   - Set types and required flags
   - [Expandable] Add components, subcomponents
6. Wizard Step 3: Goal Statement
   - Natural language text area
   - Tips and examples shown
7. Wizard Step 4: Output Schema (Schema Builder)
   - Toggle: Simple text OR Structured JSON
   - If structured: add output fields
   - [Expandable] Edit raw JSON schema
8. Wizard Step 5: Review & Save
   - Summary of all inputs
   - Validation checklist
   - "Save as Draft" button
9. Server: createProcess mutation
   - Generate proc_* ID
   - Create Process record
   - Create initial ProcessVersion (DRAFT status)
   - Compile systemPrompt from inputs
   - Write AuditLog: "process.created"
10. Success: Redirect to process detail page
    - Celebration message
    - "Next: Generate API" CTA (Epic 3)
```

#### Edit Intelligence Flow (Story 2.4)

```
1. User clicks "Edit" on intelligence card
2. Load process and current draft version (or create new draft)
3. Display same wizard UI with current values
4. User modifies any fields
5. Auto-save on field blur (debounced)
6. Explicit "Save" button for final confirmation
7. If editing published version:
   - Create new DRAFT version
   - Show diff/comparison option
8. Write AuditLog: "process.updated"
```

#### Duplicate Intelligence Flow (Story 2.5)

```
1. User clicks "Duplicate" on intelligence card
2. Confirmation dialog with new name input
3. Default name: "{original name} (Copy)"
4. Server: duplicate mutation
   - Deep copy Process record with new ID
   - Deep copy latest version config
   - Set status to DRAFT
   - Clear version history
5. Write AuditLog: "process.duplicated"
6. Redirect to edit page for new process
```

#### Delete Intelligence Flow (Story 2.6)

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

### Seed Data Structure (Story 2.0)

```typescript
// prisma/seed.ts

const seedData = {
  tenants: [
    {
      id: 'ten_seed_acme',
      name: 'Acme Corp (Seed)',
      // Starter tier
    },
    {
      id: 'ten_seed_globex',
      name: 'Globex Industries (Seed)',
      // Growth tier
    },
  ],

  users: [
    // Acme users
    { id: 'usr_seed_acme_admin', email: 'admin@seed-acme.test', name: 'Admin User', tenantId: 'ten_seed_acme' },
    { id: 'usr_seed_acme_dev', email: 'dev@seed-acme.test', name: 'Developer User', tenantId: 'ten_seed_acme' },
    { id: 'usr_seed_acme_viewer', email: 'viewer@seed-acme.test', name: 'Viewer User', tenantId: 'ten_seed_acme' },
    // Globex users
    { id: 'usr_seed_globex_admin', email: 'admin@seed-globex.test', name: 'Admin User', tenantId: 'ten_seed_globex' },
    { id: 'usr_seed_globex_dev', email: 'dev@seed-globex.test', name: 'Developer User', tenantId: 'ten_seed_globex' },
    { id: 'usr_seed_globex_viewer', email: 'viewer@seed-globex.test', name: 'Viewer User', tenantId: 'ten_seed_globex' },
  ],

  processes: [
    // Acme processes (various states)
    {
      id: 'proc_seed_acme_prodesc',
      tenantId: 'ten_seed_acme',
      name: '[Seed] Product Description Generator',
      description: 'Generates compelling product descriptions from attributes',
      categories: ['ecommerce', 'product-description'],
      // Full inputSchema and outputSchema...
      versions: [
        { status: 'PRODUCTION', version: '1.0.0' },
      ],
    },
    {
      id: 'proc_seed_acme_seo',
      tenantId: 'ten_seed_acme',
      name: '[Seed] SEO Meta Generator',
      description: 'Creates SEO-optimized titles and descriptions',
      categories: ['ecommerce', 'seo'],
      versions: [
        { status: 'SANDBOX', version: '1.0.0' },
      ],
    },
    {
      id: 'proc_seed_acme_draft',
      tenantId: 'ten_seed_acme',
      name: '[Seed] Category Classifier (Draft)',
      description: 'Classifies products into taxonomy categories',
      categories: ['ecommerce', 'classification'],
      versions: [
        { status: 'DRAFT', version: '0.1.0' },
      ],
    },
    // Similar for Globex...
  ],

  apiKeys: [
    { tenantId: 'ten_seed_acme', name: 'Seed Test Key', environment: 'SANDBOX' },
    { tenantId: 'ten_seed_acme', name: 'Seed Prod Key', environment: 'PRODUCTION' },
    // Similar for Globex...
  ],
};
```

## Non-Functional Requirements

### Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| Process list query | P95 < 100ms | Dashboard responsiveness |
| Process create/update | P95 < 300ms | Real-time feel for wizard |
| Schema validation | < 50ms | Instant feedback on field changes |
| Seed script execution | < 30s | Developer workflow efficiency |

### Security

| Requirement | Implementation | FR Reference |
|-------------|----------------|--------------|
| Tenant isolation | All process queries filter by tenantId from session | FR-801, FR-802, FR-806 |
| Input validation | Zod schemas on all tRPC inputs | Standard |
| XSS prevention | React's built-in escaping + sanitization | Standard |
| SQL injection | Prisma parameterized queries | Standard |
| CSRF | NextAuth built-in protection | Standard |

### Reliability/Availability

| Requirement | Implementation |
|-------------|----------------|
| Data persistence | PostgreSQL with transaction support |
| Soft deletes | All deletions set deletedAt, recoverable for 30 days |
| Auto-save | Wizard progress saved to localStorage + server |
| Validation | Client + server validation prevents invalid states |

### Observability

| Signal | Implementation |
|--------|----------------|
| Audit logs | All CRUD operations logged (Story 2.0 depends on 1.5) |
| Structured logging | JSON logs with process_id, tenant_id |
| Error tracking | Client errors captured with context |
| Usage metrics | Process count per tenant tracked |

## Dependencies and Integrations

### NPM Dependencies (additions to package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| @monaco-editor/react | 4.x | JSON schema editor (optional, for advanced mode) |
| react-hook-form | 7.x | Form state management for wizard |
| @hookform/resolvers | 3.x | Zod integration for react-hook-form |
| lucide-react | latest | Icons (matches UX spec) |

### shadcn/ui Components to Install

```bash
# Required shadcn/ui components for Epic 2
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add textarea
npx shadcn@latest add select
npx shadcn@latest add label
npx shadcn@latest add badge
npx shadcn@latest add dialog
npx shadcn@latest add alert-dialog
npx shadcn@latest add tabs
npx shadcn@latest add progress
npx shadcn@latest add skeleton
npx shadcn@latest add toast
npx shadcn@latest add dropdown-menu
npx shadcn@latest add tooltip
npx shadcn@latest add switch
npx shadcn@latest add separator
```

### Internal Dependencies

| Dependency | From Epic | Required For |
|------------|-----------|--------------|
| Tenant model | Epic 1 | Foreign key relationship |
| User authentication | Epic 1 | Protected routes |
| Audit logging | Epic 1 (Story 1.5) | Action tracking |
| ID generator | Epic 1 | proc_*, procv_* prefixes |
| Test infrastructure | Epic 1 (Story 1.6) | Testing new components |

## Acceptance Criteria (Authoritative)

### Story 2.0: Development Seed Data

1. Running `pnpm db:seed` creates sample data without errors
2. Seed data includes 2 tenants with different subscription contexts
3. Seed data includes 3 users per tenant (admin, developer, viewer)
4. Seed data includes 5 intelligence definitions per tenant in various states (draft, sandbox, production)
5. Seed data includes sample API keys for testing
6. Seed data uses deterministic IDs prefixed with `_seed_` for easy identification
7. Seed script is idempotent (running multiple times doesn't create duplicates)
8. Seed data names are prefixed with `[Seed]` to distinguish from real data

### Story 2.1: Intelligence Definition Data Model

1. Process table exists with: id, tenantId, name, description, inputSchema, outputSchema, categories, timestamps
2. ProcessVersion table exists with: id, processId, version, config, status, timestamps
3. JSON schemas stored in JSONB columns are valid JSON Schema Draft 7
4. Processes are tenant-scoped (tenantId foreign key enforced)
5. ProcessVersion.config stores all ProcessConfig fields as defined
6. Soft delete supported via deletedAt column
7. Indexes exist on tenantId and status columns

### Story 2.2: Create Intelligence Definition UI

1. "Create Intelligence" button visible on dashboard for authenticated users
2. Template Picker shows at least 4 pre-built templates plus blank option
3. Wizard has 5 steps: Name → Input Schema → Goal → Output Schema → Review
4. Each step validates before allowing progression
5. "Save as Draft" creates process with DRAFT version
6. Success page shows celebration message and intelligence summary
7. User can navigate back to edit any previous step
8. Progress is auto-saved (recoverable if browser closes)

### Story 2.3: Define Components and Subcomponents

1. Schema Builder shows "Add Component" option in advanced mode
2. Components can be named with custom type
3. Subcomponents can be nested at least 3 levels deep
4. Each component can have its own attributes list
5. Component hierarchy is visually represented as tree structure
6. Components are saved in ProcessConfig.components array

### Story 2.4: Edit Intelligence Definition

1. "Edit" action available on each intelligence card
2. Edit page loads current values into wizard form
3. Changes to DRAFT versions update in place
4. Changes to PUBLISHED versions create new DRAFT version
5. Diff view available when editing published intelligence
6. Auto-save triggers on field blur (debounced 1s)
7. Explicit "Save" confirms all changes
8. AuditLog entry created for each save

### Story 2.5: Duplicate Intelligence Definition

1. "Duplicate" action available on each intelligence card
2. Duplicate opens dialog for new name (default: "{name} (Copy)")
3. Duplicate creates new Process with new ID
4. Duplicate copies all fields including schemas and config
5. Duplicate version is DRAFT regardless of source status
6. Duplicate has no version history (fresh start)
7. User redirected to edit page for duplicate

### Story 2.6: Delete Intelligence Definition

1. "Delete" action available on each intelligence card
2. Delete requires typing intelligence name to confirm
3. Delete sets deletedAt timestamp (soft delete)
4. Deleted intelligences hidden from list by default
5. Toast shows with 10-second undo option
6. Undo clears deletedAt and restores visibility
7. Recent API calls warning shown before deletion (placeholder for Epic 6)

## Traceability Mapping

| AC | FR | Spec Section | Component(s) | Test Approach |
|----|-----|--------------|--------------|---------------|
| 2.0.1-8 | - | Seed Data | prisma/seed.ts | Manual + CI verification |
| 2.1.1-7 | FR-101, FR-107 | Data Models | Prisma schema | Integration tests |
| 2.2.1-8 | FR-101-103, FR-105-107 | Create Flow | Wizard, TemplatePicker | E2E + unit tests |
| 2.3.1-6 | FR-104 | Components | SchemaBuilder | Unit tests |
| 2.4.1-8 | FR-108 | Edit Flow | Edit pages, tRPC | E2E + integration tests |
| 2.5.1-7 | FR-109 | Duplicate | process.duplicate | Integration tests |
| 2.6.1-7 | FR-110 | Delete Flow | DeleteDialog, tRPC | E2E + integration tests |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Complex JSON schema editing UX | High - users may struggle | Provide templates, visual builder, hide advanced mode by default |
| Component nesting complexity | Medium - deep nesting confusing | Limit to 3 levels, visual tree representation |
| Schema validation performance | Low - large schemas may be slow | Validate on save only, not every keystroke |

### Assumptions

1. Users understand basic data types (string, number, boolean, array, object)
2. Pre-built templates cover 80% of common use cases
3. Natural language goal is sufficient (no structured prompt builder needed)
4. shadcn/ui components are adequate for all UI needs (no custom design system)
5. Monaco editor for JSON is overkill for MVP (simple textarea with syntax highlighting sufficient)

### Open Questions

1. **Q:** Should we validate JSON schemas against JSON Schema Draft 7 spec?
   **Recommendation:** Yes, use ajv library for validation. Invalid schemas cause downstream issues.

2. **Q:** How many templates should we ship for MVP?
   **Recommendation:** 4 templates: Product Description, SEO Meta, Category Classifier, Attribute Extractor. Add more based on user feedback.

3. **Q:** Should duplicate preserve or reset usage statistics?
   **Recommendation:** Reset. Duplicate is a fresh start.

4. **Q:** Maximum number of input/output fields?
   **Recommendation:** Soft limit of 20 fields with warning, hard limit of 50 for MVP.

## Test Strategy Summary

### Test Levels

| Level | Framework | Coverage Focus |
|-------|-----------|----------------|
| Unit | Vitest | Schema validation, ID generation, config compilation |
| Integration | Vitest + Prisma | tRPC routers, database operations, tenant isolation |
| E2E | Playwright | Create wizard flow, edit flow, delete flow |
| Component | Testing Library | SchemaBuilder, TemplatePicker, IntelligenceCard |

### Key Test Scenarios

1. **Create Flow E2E:** Select template → complete wizard → verify process created with correct schema
2. **Tenant Isolation:** Verify tenant A cannot see/edit tenant B's processes
3. **Schema Validation:** Invalid JSON schema rejected with clear error
4. **Duplicate Integrity:** Verify all fields copied correctly, new IDs generated
5. **Soft Delete:** Verify deletedAt set, list excludes deleted, undo works
6. **Seed Idempotency:** Run seed twice, verify no duplicates

### Test Data Strategy

- Use seed data for E2E tests (deterministic IDs)
- Use factories for unit/integration tests (isolated)
- Component tests use mock data matching schema types
