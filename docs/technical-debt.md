# Technical Debt Register

This document tracks known technical debt, documentation gaps, and deferred decisions that should be addressed before or during implementation.

---

## Documentation Gaps

### DEBT-001: Rate Limiting Specification Incomplete

**Priority:** Medium
**Affects:** Epic 7A (Stories 7A.1, 7A.2), Epic 4 (Story 4.3)
**Added:** 2025-11-28

**Description:**
Story 7A.1 (Rate Limiting Infrastructure) describes the mechanism but lacks implementation-ready specifics. Story 4.3 (Error Response Contract) was written before Epic 7A and doesn't explicitly include rate limiting error codes.

**Gaps:**

| Missing Item | Where It Should Be Specified |
|--------------|------------------------------|
| Default rate limits per subscription tier (e.g., Free: 10/min, Starter: 60/min, Growth: 300/min, Professional: 1000/min) | Story 7A.1 or 7A.5 |
| `RATE_LIMITED` error code in exhaustive enum | Story 4.3 |
| `QUOTA_EXCEEDED` error code (distinct from rate limit) | Story 4.3 |
| Standard rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) | Story 7A.1 |
| Distinction between per-minute rate limit vs monthly quota exceeded responses | Stories 7A.1 vs 7A.2 |

**Recommendation:**
Before implementing Epic 7A, amend Stories 7A.1 and 4.3 to specify:
1. Concrete rate limit values per tier
2. Complete error code enum including `RATE_LIMITED` and `QUOTA_EXCEEDED`
3. Required response headers for rate-limited requests

---

## Implementation Debt

_No items yet._

---

## Deferred Decisions

_No items yet._

---

## Resolved Items

_Items moved here after being addressed._

---

_Last updated: 2025-11-28_
