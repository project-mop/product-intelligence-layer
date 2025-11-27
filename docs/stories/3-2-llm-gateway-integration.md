# Story 3.2: LLM Gateway Integration

Status: done

## Story

As a **system**,
I want **to route intelligence API calls through an LLM gateway**,
So that **requests are processed by the appropriate AI model and return schema-constrained responses**.

## Acceptance Criteria

1. **LLM Gateway Interface**: LLM Gateway interface defined in `src/server/services/llm/types.ts` with `generate()` method
2. **Anthropic Adapter**: Anthropic adapter implements LLMGateway interface at `src/server/services/llm/anthropic.ts`
3. **Prompt Assembly**: Prompt assembled from ProcessConfig (goal, input schema description, output schema description)
4. **Input Data Handling**: Input data passed to LLM as JSON in user message
5. **JSON Response Parsing**: LLM response parsed as JSON
6. **Retry on Parse Failure**: Parse failure triggers one retry with stricter prompt ("PREVIOUS ATTEMPT FAILED VALIDATION...")
7. **Error on Second Failure**: Second parse failure returns 500 with error code `OUTPUT_PARSE_FAILED`
8. **Timeout Handling**: LLM timeout (30s default) returns 503 with error code `LLM_TIMEOUT`
9. **API Error Handling**: Anthropic API errors return 503 with error code `LLM_ERROR`
10. **Latency Tracking**: Response includes `meta.latency_ms` measuring total request time

## Tasks / Subtasks

- [x] **Task 1: Define LLM Gateway Types and Interface** (AC: 1)
  - [x] Create `src/server/services/llm/types.ts` with:
    - `LLMGateway` interface with `generate(params: GenerateParams): Promise<GenerateResult>`
    - `GenerateParams` type: `{ prompt: string, systemPrompt?: string, maxTokens: number, temperature: number, model?: string }`
    - `GenerateResult` type: `{ text: string, usage: { inputTokens: number, outputTokens: number }, model: string, durationMs: number }`
  - [x] Export types from `src/server/services/llm/index.ts`

- [x] **Task 2: Implement Anthropic Adapter** (AC: 2, 8, 9)
  - [x] Install `@anthropic-ai/sdk` package: `pnpm add @anthropic-ai/sdk`
  - [x] Create `src/server/services/llm/anthropic.ts`:
    - Initialize Anthropic client with `ANTHROPIC_API_KEY` from environment
    - Implement `AnthropicGateway` class implementing `LLMGateway` interface
    - Use `claude-3-haiku-20240307` as default model (configurable via `ANTHROPIC_MODEL` env var)
    - Set 30-second timeout (configurable via `LLM_TIMEOUT_MS` env var)
    - Map Anthropic SDK errors to appropriate error codes
  - [x] Add error handling for rate limits (429), server errors (5xx), and connection issues
  - [x] Track request duration for `durationMs` in response

- [x] **Task 3: Create Prompt Builder Service** (AC: 3, 4)
  - [x] Create `src/server/services/process/prompt.ts` with:
    - `assemblePrompt(processVersion: ProcessVersion, input: Record<string, unknown>): { system: string, user: string }`
    - System prompt includes: goal statement, output requirements, JSON-only instruction
    - User message includes: JSON-stringified input data
  - [x] System prompt template:
    ```
    You are an AI assistant that generates structured product intelligence.

    GOAL: {config.goal}

    OUTPUT REQUIREMENTS:
    - Respond ONLY with valid JSON
    - Your response must match this structure: {outputSchemaDescription}
    - Do not include explanations, markdown, or anything outside the JSON
    - Be concise and professional

    {additionalInstructions}
    ```

- [x] **Task 4: Create Process Engine Service** (AC: 3, 4, 5, 6, 7, 10)
  - [x] Create `src/server/services/process/engine.ts` with:
    - `ProcessEngine` class that orchestrates the generation flow
    - `generateIntelligence(processVersion: ProcessVersion, input: Record<string, unknown>): Promise<IntelligenceResult>`
    - Track start time for latency calculation
    - Assemble prompt via prompt builder
    - Call LLM gateway
    - Parse response as JSON
    - On parse failure, retry once with stricter prompt
    - Return structured result with `data` and `meta` (including `latency_ms`)
  - [x] Retry prompt enhancement: Add "PREVIOUS ATTEMPT FAILED VALIDATION. The response must be valid JSON only, with no additional text."

- [x] **Task 5: Update Generate API Route** (AC: 1-10)
  - [x] Update `src/app/api/v1/intelligence/[processId]/generate/route.ts`:
    - Replace 501 placeholder with actual LLM generation logic
    - Load ProcessVersion by processId with tenant filter
    - Instantiate ProcessEngine with AnthropicGateway
    - Call `processEngine.generateIntelligence(processVersion, input)`
    - Return success response with `data` and `meta` fields
  - [x] Handle all error cases:
    - LLM timeout → 503 with `LLM_TIMEOUT`
    - LLM API error → 503 with `LLM_ERROR`
    - Parse failure after retry → 500 with `OUTPUT_PARSE_FAILED`
    - Missing/invalid input → 400 with `INVALID_INPUT`

- [x] **Task 6: Add Environment Variables** (AC: 2, 8)
  - [x] Add to `.env.example`:
    - `ANTHROPIC_API_KEY=sk-ant-api03-...`
    - `ANTHROPIC_MODEL=claude-3-haiku-20240307`
    - `LLM_TIMEOUT_MS=30000`
  - [x] Update `src/env.js` with validation for new environment variables
  - [ ] Document environment variables in README (deferred - README updates not required for MVP)

- [x] **Task 7: Write Unit Tests for LLM Gateway** (AC: 1, 2, 5, 6, 7, 8, 9)
  - [x] Create `tests/unit/llm-gateway.test.ts`:
    - Test Anthropic adapter initialization
    - Test successful generation with mocked Anthropic response
    - Test timeout handling (mock delayed response)
    - Test API error handling (mock 429, 500 errors)
    - Test JSON parsing of LLM response
    - Test retry logic on parse failure
    - Test error after second parse failure
  - [x] Mock `@anthropic-ai/sdk` to avoid real API calls

- [x] **Task 8: Write Unit Tests for Prompt Builder** (AC: 3, 4)
  - [x] Create `tests/unit/prompt-builder.test.ts`:
    - Test prompt assembly with complete ProcessConfig
    - Test system prompt contains goal and output schema
    - Test user message contains JSON-stringified input
    - Test handling of missing optional fields (additionalInstructions)

- [x] **Task 9: Write Unit Tests for Process Engine** (AC: 5, 6, 7, 10)
  - [x] Create `tests/unit/process-engine.test.ts`:
    - Test successful generation flow
    - Test latency tracking
    - Test retry on first parse failure
    - Test error on second parse failure
    - Test proper error code mapping

- [x] **Task 10: Write Integration Tests** (AC: 1-10)
  - [x] Update `tests/integration/intelligence-api.test.ts`:
    - Test full generation flow with mocked LLM (inject mock gateway)
    - Test 503 response on LLM timeout
    - Test 503 response on LLM error
    - Test 500 response on output parse failure
    - Test latency_ms is present in response meta
    - Test response structure matches expected format
  - [x] Use dependency injection to allow gateway mocking in tests

- [x] **Task 11: Verification** (AC: 1-10)
  - [x] Run `pnpm typecheck` - zero errors
  - [x] Run `pnpm lint` - zero new errors (only warnings in coverage folder)
  - [x] Run `pnpm test:unit` - all unit tests pass (251 tests)
  - [x] Run `pnpm test:integration` - all integration tests pass (180 tests)
  - [x] Run `pnpm build` - production build succeeds
  - [ ] Manual test with real Anthropic API key (optional, local only)

## Dev Notes

**BEFORE WRITING TESTS:** Review testing strategy at `/docs/testing-strategy-mvp.md`
- Unit tests for LLM gateway, prompt builder, process engine with mocked dependencies
- Integration tests for API routes with injected mock gateway
- 50% coverage minimum for MVP

### Technical Context

This story implements the core LLM integration that powers the entire product. It establishes the provider-agnostic gateway pattern that allows future LLM provider additions (OpenAI, local models, etc.) without changing the process engine.

**Key Architecture Decisions:**
- ADR-002: Provider-agnostic LLM Gateway (Anthropic now, others later)
- Response format includes `meta.request_id`, `meta.latency_ms`, `meta.cached`
- One retry on JSON parse failure before returning error
- Console logging for observability (Epic 6 adds call_logs table)

### LLM Gateway Architecture

From `architecture.md` and `tech-spec-epic-3.md`:

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
```

### Generation Flow

```
1. Request arrives at /api/v1/intelligence/:processId/generate
2. Auth validation (from Story 3.1)
3. Load ProcessVersion by processId + tenant
4. Assemble prompt from ProcessVersion.config
5. Call LLM Gateway (Anthropic Claude)
6. Parse LLM response as JSON
7. On parse failure → Retry once with stricter prompt
8. Return response with meta (latency_ms, request_id, cached=false)
```

### Error Codes

| Error Code | HTTP Status | Condition |
|------------|-------------|-----------|
| `LLM_TIMEOUT` | 503 | LLM call exceeded 30-second timeout |
| `LLM_ERROR` | 503 | Anthropic API error (rate limit, server error) |
| `OUTPUT_PARSE_FAILED` | 500 | JSON parse failed after retry |
| `INVALID_INPUT` | 400 | Request body invalid/missing |

### Learnings from Previous Story

**From Story 3.1: Endpoint URL Generation (Status: done)**

- **API route structure**: `src/app/api/v1/intelligence/[processId]/generate/route.ts` already created with POST handler
- **Auth middleware**: `src/server/services/auth/api-key-validator.ts` provides Bearer token validation
- **Response helpers**: `src/server/services/api/response.ts` provides `successResponse()` and `errorResponse()` utilities
- **Request ID**: `generateRequestId()` from `src/lib/id.ts` creates `req_*` prefixed IDs
- **Integration tests**: `tests/integration/intelligence-api.test.ts` has 18 tests covering auth flow

**Patterns to Follow:**
- Use existing `errorResponse()` with error code and message
- Use existing `successResponse()` with data and meta
- Follow tenant isolation pattern from API key validation
- Return 501 → Implement actual generation logic

**Files to Reuse:**
- `src/server/services/api/response.ts` - Response formatting
- `src/server/services/auth/api-key-validator.ts` - Auth already works
- `src/lib/id.ts` - Request ID generation

[Source: docs/stories/3-1-endpoint-url-generation.md#Dev-Agent-Record]

### Project Structure Notes

New files to create:

```
src/server/services/llm/
├── types.ts              # NEW - LLMGateway interface, GenerateParams, GenerateResult
├── anthropic.ts          # NEW - Anthropic Claude adapter
└── index.ts              # NEW - Exports

src/server/services/process/
├── prompt.ts             # NEW - Prompt assembly utility
└── engine.ts             # NEW - Process generation orchestration

tests/unit/
├── llm-gateway.test.ts   # NEW - LLM gateway unit tests
├── prompt-builder.test.ts # NEW - Prompt assembly tests
└── process-engine.test.ts # NEW - Process engine tests
```

Files to modify:

```
src/app/api/v1/intelligence/[processId]/generate/route.ts  # MODIFY - Replace 501 with real logic
src/env.js                                                  # MODIFY - Add new env vars
.env.example                                               # MODIFY - Add new env vars
tests/integration/intelligence-api.test.ts                 # MODIFY - Add LLM integration tests
```

### Implementation Notes

**Anthropic SDK Setup:**
```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await client.messages.create({
  model: "claude-3-haiku-20240307",
  max_tokens: 1024,
  system: systemPrompt,
  messages: [{ role: "user", content: userPrompt }],
});
```

**Timeout Handling:**
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

try {
  const response = await client.messages.create({
    // ...params,
    // Note: Anthropic SDK may need AbortController support
  });
} finally {
  clearTimeout(timeout);
}
```

**JSON Parse with Retry:**
```typescript
function parseWithRetry(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("JSON_PARSE_FAILED");
  }
}
```

### Performance Targets

From `tech-spec-epic-3.md`:

| Metric | Target |
|--------|--------|
| P95 response time | < 2 seconds |
| P99 response time | < 5 seconds |
| LLM timeout | 30 seconds |

Note: Claude Haiku averages 500-1500ms for typical requests.

### References

- [Source: docs/tech-spec-epic-3.md#Story-3.2-LLM-Gateway-Integration] - Acceptance criteria
- [Source: docs/tech-spec-epic-3.md#Detailed-Design] - Service architecture
- [Source: docs/architecture.md#Intelligence-Generation-Flow] - Flow overview
- [Source: docs/architecture.md#LLM-Gateway] - Gateway pattern
- [Source: docs/epics.md#Story-3.2-LLM-Gateway-Integration] - Epic story definition
- [Source: docs/testing-strategy-mvp.md] - Testing patterns

## Dev Agent Record

### Context Reference

- docs/stories/3-2-llm-gateway-integration.context.xml

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

None

### Completion Notes List

- All 11 tasks completed successfully
- All 10 acceptance criteria satisfied
- typecheck: 0 errors
- lint: 0 errors (only warnings in coverage folder and pre-existing code)
- unit tests: 251 passing
- integration tests: 180 passing
- build: successful

### File List

**New Files:**
- `src/server/services/llm/types.ts` - LLMGateway interface and types
- `src/server/services/llm/anthropic.ts` - Anthropic Claude adapter
- `src/server/services/llm/index.ts` - Module exports
- `src/server/services/process/prompt.ts` - Prompt assembly service
- `src/server/services/process/engine.ts` - Process engine orchestration
- `src/app/api/v1/intelligence/[processId]/generate/testing.ts` - Test helpers for DI
- `tests/unit/llm-gateway.test.ts` - LLM gateway unit tests
- `tests/unit/prompt-builder.test.ts` - Prompt builder unit tests
- `tests/unit/process-engine.test.ts` - Process engine unit tests

**Modified Files:**
- `src/app/api/v1/intelligence/[processId]/generate/route.ts` - Implemented LLM generation
- `src/server/services/api/response.ts` - Added LLM error codes and helpers
- `src/env.js` - Added ANTHROPIC_API_KEY, ANTHROPIC_MODEL, LLM_TIMEOUT_MS
- `.env.example` - Added LLM Gateway environment variables
- `tests/integration/intelligence-api.test.ts` - Added LLM generation tests
- `tests/support/factories/process-version.factory.ts` - Added outputSchemaDescription to default config

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-27 | SM Agent (Bob) | Initial story creation from Epic 3 tech spec |
| 2025-11-27 | Dev Agent (Amelia) | Story implementation complete - LLM Gateway with Anthropic adapter |
