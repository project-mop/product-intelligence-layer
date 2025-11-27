# Epic Technical Specification: API Generation & Endpoints

Date: 2025-11-27
Author: Zac
Epic ID: 3
Status: Draft

---

## Overview

Epic 3 delivers the core product value proposition of the Product Intelligence Layer: transforming user-defined intelligence definitions into callable API endpoints that return schema-constrained intelligence. This is where the "magic moment" occurs—users click "Generate API" and immediately receive a working endpoint they can integrate with their ERP, ecommerce, or internal systems.

Building on the intelligence definition foundation from Epic 2, this epic implements the complete API generation pipeline: unique endpoint URL generation, LLM gateway integration with Anthropic Claude, in-browser testing capabilities, and the intelligence dashboard for managing multiple endpoints. Users will experience the full "Define → Generate → Test → Integrate" workflow without writing prompts or managing LLMs.

**FRs Covered:** FR-201 through FR-206 (API Generation), FR-301 (View All Intelligences), FR-303 (Test with Custom Input), FR-304 (View JSON Schema), FR-308 (Auto-Generated API Documentation)

## Objectives and Scope

### In Scope

- API endpoint URL generation when intelligence definition is saved (`/api/v1/intelligence/:processId/generate`)
- LLM Gateway integration with Anthropic Claude (provider-agnostic interface per ADR-002)
- Prompt assembly from intelligence definition (goal, input schema, output schema)
- Output validation against defined JSON schema with one retry on failure
- In-browser API test console with sample request/response
- Sample payload generation from input schema
- Intelligence list dashboard with gallery view (Card-based per UX spec)
- JSON schema viewer for input/output definitions
- Auto-generated API documentation per endpoint
- Request ID tracking and basic response metadata (`meta.cached`, `meta.latency_ms`, `meta.request_id`)
- API key authentication via Bearer token (using Epic 1 infrastructure)

### Out of Scope

- Response caching (Epic 4, Story 4.5)
- Rate limiting enforcement (Epic 7A)
- Input schema validation with field-level errors (Epic 4, Story 4.1)
- Output schema enforcement with retry logic (Epic 4, Story 4.2 - basic validation here, full enforcement in Epic 4)
- Error response standardization (Epic 4, Story 4.3)
- Version history and rollback (Epic 5)
- Sandbox/Production environments (Epic 5)
- Call logging infrastructure (Epic 6)
- OpenAPI/Swagger spec generation (deferred to post-MVP polish)

## System Architecture Alignment

This epic implements the core "Intelligence Generation Flow" documented in the architecture:

| Architecture Component | Epic 3 Implementation |
|------------------------|----------------------|
| LLM Gateway | Story 3.2 - `src/server/services/llm/` with Anthropic adapter |
| Process Engine | Story 3.2 - `src/server/services/process/` prompt assembly |
| API Routes (REST) | Story 3.1 - `src/app/api/v1/intelligence/[processId]/` |
| Schema Validator | Story 3.2 - Basic output validation |
| Dashboard UI | Stories 3.3, 3.4, 3.5, 3.6 - Test console, list view, schema viewer |

**Key Architecture Decisions Applied:**
- ADR-002: Provider-agnostic LLM Gateway (Anthropic now, others later)
- ADR-003: REST for public intelligence endpoints (not tRPC)
- Architecture Flow: Auth → Rate Limit Check → Input Validation → Cache → LLM → Output Validation → Response

**Simplified Flow for Epic 3 (pre-Epic 4 enhancements):**
```
Customer Request → API Key Auth → Load Process → Prompt Assembly
    → LLM Gateway → Basic Output Parse → Response
```

---

## Detailed Design

### Services and Modules

| Module | Location | Responsibility |
|--------|----------|----------------|
| LLM Gateway | `src/server/services/llm/gateway.ts` | Provider-agnostic LLM interface |
| Anthropic Adapter | `src/server/services/llm/anthropic.ts` | Claude API integration |
| Process Engine | `src/server/services/process/engine.ts` | Prompt assembly, execution orchestration |
| Prompt Builder | `src/server/services/process/prompt.ts` | Compile intelligence config into LLM prompt |
| Intelligence Route | `src/app/api/v1/intelligence/[processId]/generate/route.ts` | REST endpoint for generation |
| Schema Route | `src/app/api/v1/intelligence/[processId]/schema/route.ts` | REST endpoint for schema viewing |
| Intelligence List | `src/app/(dashboard)/processes/page.tsx` | Dashboard gallery view |
| Test Console | `src/app/(dashboard)/processes/[id]/test/page.tsx` | In-browser testing UI |
| API Docs | `src/app/(dashboard)/processes/[id]/docs/page.tsx` | Auto-generated documentation |
| Intelligence Card | `src/components/dashboard/IntelligenceCard.tsx` | Card component for gallery |
| Test Console UI | `src/components/process/TestConsole.tsx` | Request/response panels |
| Code Block | `src/components/common/CodeBlock.tsx` | Syntax-highlighted code display |

### Data Models and Contracts

Epic 3 uses the existing Process and ProcessVersion models from Epic 2. No new database tables are required.

**Additional TypeScript Types:**

```typescript
// src/server/services/llm/types.ts

export interface LLMGateway {
  generate(params: GenerateParams): Promise<GenerateResult>;
}

export interface GenerateParams {
  prompt: string;
  systemPrompt?: string;
  maxTokens: number;
  temperature: number;
  model?: string; // defaults to claude-3-haiku
}

export interface GenerateResult {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  durationMs: number;
}

// src/server/services/process/types.ts

export interface IntelligenceRequest {
  input: Record<string, unknown>;
}

export interface IntelligenceResponse {
  success: true;
  data: Record<string, unknown>;
  meta: {
    version: string;
    cached: boolean;
    latency_ms: number;
    request_id: string;
  };
}

export interface IntelligenceErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

### APIs and Interfaces

#### Public REST Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/intelligence/:processId/generate` | POST | Bearer | Generate intelligence from input |
| `/api/v1/intelligence/:processId/schema` | GET | Bearer | Get input/output JSON schemas |

**Generate Intelligence Endpoint:**

```
POST /api/v1/intelligence/:processId/generate
Authorization: Bearer key_abc123
Content-Type: application/json

Request Body:
{
  "input": {
    "productName": "Wireless Headphones",
    "category": "Electronics",
    "attributes": {
      "color": "Black",
      "battery": "40 hours"
    }
  }
}

Success Response (200):
{
  "success": true,
  "data": {
    "shortDescription": "Premium wireless headphones with 40-hour battery...",
    "longDescription": "Experience crystal-clear audio...",
    "seoTitle": "Wireless Headphones | 40hr Battery | Black",
    "bulletPoints": [
      "40-hour battery life",
      "Premium sound quality",
      "Comfortable over-ear design"
    ]
  },
  "meta": {
    "version": "1.0.0",
    "cached": false,
    "latency_ms": 1245,
    "request_id": "req_xyz789"
  }
}

Error Response (4xx/5xx):
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired API key"
  }
}
```

**Get Schema Endpoint:**

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

#### tRPC Additions (Dashboard)

| Procedure | Type | Description |
|-----------|------|-------------|
| `process.listWithStats` | query | List processes with call counts (placeholder until Epic 6) |
| `process.getTestPayload` | query | Generate sample request from input schema |
| `process.getDocs` | query | Get auto-generated documentation data |

### Workflows and Sequencing

#### Generate Intelligence Flow (Story 3.2)

```
1. Request arrives at /api/v1/intelligence/:processId/generate
2. Extract Bearer token from Authorization header
3. Validate API key (hash lookup, expiry check, scope check)
   - Invalid → 401 Unauthorized
   - No access to process → 403 Forbidden
4. Load ProcessVersion by processId + tenant + environment
   - Not found → 404 Not Found
5. [Epic 4] Validate input against process.inputSchema
   - For Epic 3: Basic JSON parse only
6. [Epic 4] Check cache by input hash
   - For Epic 3: Skip caching
7. Assemble prompt from ProcessVersion.config:
   - System prompt with goal and output requirements
   - User message with input data
   - Output schema description
8. Call LLM Gateway (Anthropic Claude)
   - Timeout → 503 Service Unavailable
   - Error → 503 with retry guidance
9. Parse LLM response as JSON
   - Parse failure → Retry once with stricter prompt
   - Second failure → 500 Output Validation Failed
10. [Epic 4] Validate output against process.outputSchema
    - For Epic 3: Basic JSON parse verification
11. [Epic 4] Store in cache
    - For Epic 3: Skip
12. [Epic 6] Log call with metadata
    - For Epic 3: Console log only
13. Return response with meta (version, cached=false, latency, request_id)
```

#### In-Browser Test Flow (Story 3.3)

```
1. User navigates to /processes/:id/test
2. Load process details and input schema
3. Generate sample payload from input schema:
   - String fields → "example"
   - Number fields → 0
   - Boolean fields → true
   - Required fields included, optional omitted
4. Display in editable JSON panel (left side)
5. User clicks "Send Request"
6. Frontend calls tRPC or direct API:
   - Uses user's session (not API key) for dashboard testing
   - Or uses a temporary sandbox API key
7. Display loading state with spinner
8. On response:
   - Success → Display formatted JSON (right side), show latency
   - Error → Display error message, highlight issues
9. User can copy cURL command or code snippets
```

#### Prompt Assembly Pattern

```typescript
// src/server/services/process/prompt.ts

export function assemblePrompt(
  processVersion: ProcessVersion,
  input: Record<string, unknown>
): { system: string; user: string } {
  const config = processVersion.config as ProcessConfig;

  const system = `You are an AI assistant that generates structured product intelligence.

GOAL: ${config.goal}

OUTPUT REQUIREMENTS:
- Respond ONLY with valid JSON
- Your response must match this structure: ${config.outputSchemaDescription}
- Do not include explanations, markdown, or anything outside the JSON
- Be concise and professional

${config.additionalInstructions ?? ''}`;

  const user = `Generate intelligence for the following input:

${JSON.stringify(input, null, 2)}

Respond with JSON only.`;

  return { system, user };
}
```

---

## Non-Functional Requirements

### Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| P95 response time | < 2 seconds | PRD success metric |
| P99 response time | < 5 seconds | PRD success metric |
| LLM timeout | 30 seconds | Prevents hanging requests |
| Dashboard list load | < 200ms | Responsive gallery view |
| Schema endpoint | < 50ms | Simple data retrieval |

**Note:** Performance targets assume LLM response times. Claude Haiku averages 500-1500ms for typical requests.

### Security

| Requirement | Implementation | FR Reference |
|-------------|----------------|--------------|
| API key authentication | Bearer token validation per-request | FR-807 |
| Tenant isolation | Process queries filter by API key's tenantId | FR-801, FR-806 |
| Key scope validation | Check process:* or process:{id} scope | FR-808 |
| No prompt leakage | Never expose compiled prompt to customers | FR-801 |
| HTTPS only | All API endpoints require TLS | Standard |

### Reliability/Availability

| Requirement | Implementation |
|-------------|----------------|
| LLM fallback | Return 503 with retry guidance on Claude unavailability |
| One retry on output failure | Stricter prompt on first parse failure |
| Request ID tracking | UUID generated per request for debugging |
| Graceful degradation | Dashboard works even if API endpoints fail |

### Observability

| Signal | Implementation |
|--------|----------------|
| Request logging | Console.log with request_id, tenant_id, process_id, latency |
| Error tracking | Error code and message logged |
| LLM metrics | Input/output tokens, model used, duration logged |
| Placeholder for Epic 6 | Structured log format ready for call_logs table |

---

## Dependencies and Integrations

### NPM Dependencies (additions to package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| @anthropic-ai/sdk | ^0.35.x | Official Anthropic Claude SDK |
| react-syntax-highlighter | ^15.x | Syntax highlighting for code blocks |
| prism-react-renderer | ^2.x | Alternative syntax highlighter (lighter weight) |

### Environment Variables Required

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | Yes |
| `ANTHROPIC_MODEL` | Default model (claude-3-haiku-20240307) | No |
| `LLM_TIMEOUT_MS` | LLM call timeout (default: 30000) | No |

### Internal Dependencies

| Dependency | From Epic | Required For |
|------------|-----------|--------------|
| Process model | Epic 2 | Loading intelligence definitions |
| ProcessVersion model | Epic 2 | Loading version config |
| API Key validation | Epic 1 | Bearer token authentication |
| ID generator | Epic 1 | req_* prefixed request IDs |
| Tenant context | Epic 1 | Isolation enforcement |
| shadcn/ui components | Epic 2 | Test console, cards, code blocks |

---

## Acceptance Criteria (Authoritative)

### Story 3.1: Endpoint URL Generation

1. Saving a complete intelligence definition (via Epic 2 create/update) generates a unique endpoint URL
2. Endpoint URL format: `/api/v1/intelligence/:processId/generate` where processId is the proc_* ID
3. Endpoint URL is displayed prominently on the process detail page after save
4. One-click copy button copies full URL with base domain to clipboard
5. Endpoint is immediately callable once process has a published version (SANDBOX or PRODUCTION status)
6. Draft-only processes show endpoint URL but return 404 until published

### Story 3.2: LLM Gateway Integration

1. LLM Gateway interface defined in `src/server/services/llm/types.ts`
2. Anthropic adapter implements LLMGateway interface
3. Prompt assembled from ProcessConfig (goal, input schema description, output schema description)
4. Input data passed to LLM as JSON in user message
5. LLM response parsed as JSON
6. Parse failure triggers one retry with stricter prompt ("PREVIOUS ATTEMPT FAILED VALIDATION...")
7. Second parse failure returns 500 with error code OUTPUT_VALIDATION_FAILED
8. LLM timeout (30s default) returns 503 with error code LLM_TIMEOUT
9. Anthropic API errors return 503 with error code LLM_ERROR
10. Response includes meta.latency_ms measuring total request time

### Story 3.3: In-Browser Endpoint Testing

1. Test page accessible from process detail page via "Test" button
2. Left panel shows editable JSON input with syntax highlighting
3. Sample payload auto-generated from input schema on page load
4. "Send Request" button initiates test call
5. Right panel shows formatted JSON response with syntax highlighting
6. Latency displayed after response received
7. Error responses show error code and message clearly
8. Copy cURL command available (copies full curl command with headers)
9. Test calls use session auth (dashboard context) or temporary sandbox key
10. Test history not persisted (Epic 6 adds call logging)

### Story 3.4: Intelligence List Dashboard

1. Dashboard shows card gallery view of all intelligences (per UX spec)
2. Each card displays: name, description (truncated), status badge, quick actions
3. Status badges: Draft (gray), Sandbox (yellow), Production (green)
4. Quick actions on hover: Test, Edit, View Docs
5. Search/filter by name and status
6. Sort by name, date created, date updated
7. Empty state shows friendly message and "Create Intelligence" CTA
8. Cards link to process detail page on click

### Story 3.5: View JSON Schema

1. Schema viewer accessible from process detail page and API docs
2. Displays input schema with formatted JSON and syntax highlighting
3. Displays output schema with formatted JSON and syntax highlighting
4. Copy button for each schema
5. Download schema as .json file option
6. Schema includes field descriptions from process definition

### Story 3.6: Auto-Generated API Documentation

1. Docs page accessible from process detail page via "API Docs" button
2. Shows endpoint URL with base domain
3. Shows authentication method (Bearer token)
4. Shows input schema with field descriptions and types
5. Shows output schema with field descriptions and types
6. Shows example request (sample payload from input schema)
7. Shows example response (mock or last successful test response)
8. Shows error codes: 401, 403, 404, 500, 503
9. Copy buttons for endpoint, sample request, headers
10. Documentation updates when process is updated (reflects current schema)

---

## Traceability Mapping

| AC | FR | Spec Section | Component(s) | Test Approach |
|----|-----|--------------|--------------|---------------|
| 3.1.1-6 | FR-201, FR-202, FR-203 | Endpoint URL | API routes, process detail | Integration + E2E |
| 3.2.1-10 | FR-201 | LLM Gateway | llm/gateway.ts, anthropic.ts | Unit + integration |
| 3.3.1-10 | FR-204, FR-205, FR-303 | Test Console | TestConsole.tsx, test page | E2E |
| 3.4.1-8 | FR-301 | Dashboard | IntelligenceCard.tsx, list page | E2E + component |
| 3.5.1-6 | FR-304 | Schema Viewer | schema page, CodeBlock | Component + E2E |
| 3.6.1-10 | FR-308 | API Docs | docs page | E2E |

---

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Anthropic API rate limits | High | Medium | Implement per-tenant queuing; surface 429 errors clearly |
| LLM output doesn't match schema | High | Medium | One retry with stricter prompt; users can refine goal/schema |
| Claude Haiku quality insufficient | Medium | Low | Config allows model selection; can upgrade to Sonnet per-process |
| Test console exposes API keys | High | Low | Use session auth for dashboard testing, not user API keys |

### Assumptions

1. Anthropic Claude API remains stable and available (99.9% uptime target)
2. Claude Haiku is sufficient for MVP use cases (can upgrade model if needed)
3. 30-second timeout is acceptable for initial version (users expect AI latency)
4. Basic JSON parse is sufficient for Epic 3; full schema validation in Epic 4
5. Users understand that Test Console calls are not production traffic

### Open Questions

1. **Q:** Should Test Console count against quotas?
   **Recommendation:** No for MVP. Mark as sandbox calls or exempt entirely.

2. **Q:** Default model: Haiku or Sonnet?
   **Recommendation:** Haiku for cost efficiency. Allow per-process override for complex intelligences.

3. **Q:** Should we show token usage in test console?
   **Recommendation:** Yes, display input/output tokens for transparency. Helps users optimize.

4. **Q:** How to handle very long LLM responses that exceed max_tokens?
   **Recommendation:** Return partial response with warning. Log for analysis.

---

## Test Strategy Summary

### Test Levels

| Level | Framework | Coverage Focus |
|-------|-----------|----------------|
| Unit | Vitest | LLM gateway, prompt assembly, response parsing |
| Integration | Vitest + Prisma | API routes, process loading, auth validation |
| E2E | Playwright | Complete test console flow, dashboard navigation |
| Component | Testing Library | TestConsole, IntelligenceCard, CodeBlock |

### Key Test Scenarios

1. **LLM Gateway:** Mock Anthropic responses, test timeout handling, test retry logic
2. **Auth Flow:** Valid key succeeds, invalid key returns 401, wrong tenant returns 403
3. **Prompt Assembly:** Verify goal, input, output schema correctly compiled
4. **Test Console E2E:** Load page → edit input → send → view response
5. **Dashboard E2E:** List intelligences → filter → click card → navigate to detail
6. **Error Handling:** LLM timeout returns 503, parse failure returns 500 after retry

### LLM Testing Strategy

- **Unit tests:** Mock `@anthropic-ai/sdk` to return canned responses
- **Integration tests:** Use recorded responses (VCR pattern) or mock server
- **E2E tests:** Either mock API or use Anthropic test mode if available
- **Never hit live Anthropic API in CI:** Costs money, introduces flakiness

---
