# Product Requirements Document (PRD)
## Product Intelligence Layer for ERP + Commerce (Working Title)

### Note on Title
The final product name will be adjusted per industry or use case for marketing clarity (e.g., "Product Intelligence API," "Commerce Intelligence Engine," "Manufacturing IQ Layer").

---

## Project Classification

| Attribute | Value |
|-----------|-------|
| **Project Level** | Level 3 (Full Product) |
| **Project Type** | SaaS B2B Platform |
| **Domain** | AI/ML, API Infrastructure, Product Data Management |
| **Domain Complexity** | Medium — Requires LLM integration, multi-tenancy, schema validation |
| **Track** | BMad Method |
| **Target Timeline** | MVP in 4-6 months |

### Level 3 Characteristics
- Multi-user SaaS platform with tenant isolation
- External API surface for customer integrations
- Usage-based billing and subscription management
- Production-grade security and compliance requirements
- Requires full architecture phase before implementation

---

# 1. Product Summary
This platform provides companies with a **no-code way to convert structured metadata about their products, parts, and services into reusable, private intelligence APIs**.

Customers define simple inputs (categories, attributes, components, descriptions, and goals) through a clean, intuitive UI. The system automatically transforms these definitions into **intelligence endpoints**—unique API URLs that return structured, consistent insights on demand.

This is a **backend intelligence layer** that plugs cleanly into ERP systems, commerce platforms, and internal tools.

---

## Key Definitions

| Term | Definition |
|------|------------|
| **Intelligence** | A reusable API endpoint that accepts structured input about a product/item and returns consistent, schema-constrained insights. An intelligence consists of: (1) an input schema defining what data the customer sends, (2) a goal/purpose statement describing what insights to generate, (3) an output schema defining the structure of returned data, and (4) internally compiled prompt logic that the customer never sees or manages. |
| **Intelligence Definition** | The customer-created configuration that defines an intelligence: categories, attributes, components, goals, and expected output format. The system transforms this into executable prompt logic. |
| **Intelligence Endpoint** | The unique API URL generated for each intelligence. Customers call this URL with input data and receive structured JSON intelligence in response. |
| **Schema-Constrained Output** | Responses that strictly adhere to a predefined JSON schema, ensuring type safety and structural consistency for integration reliability. |

---

# 2. Problem Statement
Companies across ERP, ecommerce, manufacturing, distribution, and service industries:

- Need structured, consistent intelligence about their products/data
- Don’t have AI expertise or prompt engineering knowledge
- Can’t standardize insights across large catalogs
- Rely heavily on manual product analysis, spec writing, attribute generation, and descriptive work
- Lack a simple API-first way to inject AI intelligence into existing systems

This product solves these problems by letting them define metadata → receive intelligence APIs automatically → integrate anywhere.

---

# 3. Target Users

### Segment Prioritization (Go-to-Market Phases)

| Priority | Segment | Phase | Rationale |
|----------|---------|-------|-----------|
| **1 - Beachhead** | Mid-market Ecommerce Teams | Months 1-12 | Fastest sales cycle (1-3 mo), clearest pain point, department-level budget authority |
| **2 - Expansion** | Mid-market Manufacturers | Months 12-24 | 82% increasing AI budgets, 65% lack AI skills, higher ACV ($10-50K) |
| **3 - Scale** | Distributors & Wholesalers | Months 24-36 | 71% increasing digital spending, massive catalog complexity |

### Primary Users (Phase 1 Focus: Ecommerce)
- **Ecommerce teams with large catalogs** (1,000-100,000 SKUs)
- Company size: 50-500 employees, $10M-$500M revenue
- Tech stack: Shopify Plus, BigCommerce, Magento, or custom platforms
- Pain points: Manual product descriptions at scale, inconsistent attributes across channels, PIM too expensive ($25K+/year)
- Budget: $5K-$20K annually
- Decision maker: Head of Ecommerce, Director of Product Operations
- Sales cycle: 1-3 months

### Primary Users (Phase 2: Manufacturing)
- **Mid-market manufacturers** needing structured product intelligence
- Company size: 100-1,000 employees, $50M-$1B revenue
- Tech stack: ERP-centric (SAP, Oracle, NetSuite, Dynamics)
- Pain points: 47% have fragmented data, complex specs need structured intelligence, legacy PDM/PLM inflexibility
- Budget: $10K-$50K annually
- Decision maker: VP Operations, Director of Product Data, IT Leadership
- Sales cycle: 3-6 months

### Primary Users (Phase 3: Distribution)
- **Distributors and wholesalers** normalizing supplier data
- Catalog size: 10,000-500,000 SKUs from multiple suppliers
- Pain points: Inconsistent supplier data formats, manual normalization, rising customer expectations
- Budget: $5K-$25K annually
- Decision maker: VP of Digital, Director of Product Management
- Sales cycle: 2-4 months

### Secondary Users
- **Automation teams** (Zapier, Make, n8n, Boomi, Workato)
- **SaaS companies** embedding intelligence into their own apps (white-label opportunity, $20K-$100K+ annually)
- **Operations & product data teams** needing structured insights
- **Developers** integrating AI into internal systems without prompt engineering  

---

# 4. Core Value Proposition
**“Turn your product data into private intelligence APIs—no AI expertise required.”**

Customers:
1. Describe the structure of their product or data  
2. Click **Generate Intelligence**  
3. Instantly receive an API endpoint  
4. Call that endpoint from ERP, ecommerce, web, scripts, or automation tools  
5. Receive consistent, structured, reliable intelligence output every time  

All without writing prompts or managing LLMs.

---

# 5. Functional Requirements

## 5.1 Intelligence Definition (FR-100 Series)

| ID | Requirement | Scope | Priority | Rationale |
|----|-------------|-------|----------|-----------|
| **FR-101** | Users shall be able to create a new intelligence definition through a web interface | MVP | Must | Core user action — users cannot derive value without creating definitions |
| **FR-102** | Users shall be able to define categories and subcategories for their intelligence | MVP | Must | Enables structured organization for large catalogs (target user pain point) |
| **FR-103** | Users shall be able to define input attributes/fields with data types | MVP | Must | Required for schema-constrained output — core differentiator |
| **FR-104** | Users shall be able to define components and subcomponents | MVP | Should | Supports complex products (manufacturing segment); not blocking for simple use cases |
| **FR-105** | Users shall be able to specify the goal/purpose of the intelligence in natural language | MVP | Must | Eliminates prompt writing — core value prop ("no AI expertise required") |
| **FR-106** | Users shall be able to define the expected output format via JSON schema | MVP | Must | Enables integration reliability with ERP/commerce systems |
| **FR-107** | Users shall be able to save an intelligence definition, creating a unique stored configuration | MVP | Must | Persistence required for any useful workflow |
| **FR-108** | Users shall be able to edit existing intelligence definitions | MVP | Must | Users iterate on definitions; blocking without edit capability |
| **FR-109** | Users shall be able to duplicate an existing intelligence definition | MVP | Should | Accelerates creation of variations; improves UX but not blocking |
| **FR-110** | Users shall be able to delete an intelligence definition | MVP | Must | Basic data management; required for workspace hygiene |

---

## 5.2 API Generation (FR-200 Series)

| ID | Requirement | Scope | Priority | Rationale |
|----|-------------|-------|----------|-----------|
| **FR-201** | The system shall automatically generate a unique API endpoint URL when an intelligence definition is saved | MVP | Must | Core product value — "click Generate, get API" is the magic moment |
| **FR-202** | The system shall generate a sandboxed configuration for each new intelligence | MVP | Must | Prevents accidental production impact; mirrors ERP team workflows |
| **FR-203** | The system shall create Version 1 of the API upon initial generation | MVP | Must | Versioning foundation required for enterprise trust |
| **FR-204** | Users shall be able to test the generated endpoint immediately in-browser | MVP | Must | Supports <5 min activation goal; validates before integration |
| **FR-205** | The system shall provide sample request/response payloads for testing | MVP | Should | Improves developer experience; not blocking for basic testing |
| **FR-206** | The system shall validate that the intelligence definition is complete before generating an endpoint | MVP | Must | Prevents broken endpoints; reduces support burden |

---

## 5.3 Endpoint Management (FR-300 Series)

| ID | Requirement | Scope | Priority | Rationale |
|----|-------------|-------|----------|-----------|
| **FR-301** | Users shall be able to view a list of all their intelligences/endpoints | MVP | Must | Basic navigation; users need to manage multiple intelligences |
| **FR-302** | Users shall be able to view version history for each intelligence | MVP | Must | Audit trail required for enterprise compliance and debugging |
| **FR-303** | Users shall be able to test any endpoint with custom input and view output | MVP | Must | Essential for validation before integration |
| **FR-304** | Users shall be able to view the JSON schema for any intelligence | MVP | Must | Developers need schema to build integrations |
| **FR-305** | Users shall be able to roll back to a previous version of an intelligence | MVP | Should | Reduces deployment risk; critical for enterprise trust but not blocking |
| **FR-306** | Users shall be able to disable/enable API keys | MVP | Must | Security requirement — compromised keys must be revocable |
| **FR-307** | Users shall be able to export API call results | MVP | Should | Supports offline analysis; not blocking for core workflow |
| **FR-308** | Users shall be able to access auto-generated API documentation for each endpoint | MVP | Must | Reduces integration friction; supports <5 min activation goal |
| **FR-309** | Versions shall be immutable once promoted to production | MVP | Must | Prevents breaking changes to live integrations |
| **FR-310** | New versions shall only be created via explicit "Publish" action | MVP | Must | Prevents accidental changes; controlled release process |
| **FR-311** | API consumers shall be able to pin to a specific version | MVP | Must | Enterprise requirement — consumers control upgrade timing |
| **FR-312** | Users shall see deprecation warnings when newer versions are available | Growth | Should | Nice-to-have for version management; not blocking MVP |

---

## 5.4 Call History & Logging (FR-400 Series)

| ID | Requirement | Scope | Priority | Rationale |
|----|-------------|-------|----------|-----------|
| **FR-401** | The system shall log every API call with timestamp | MVP | Must | Foundation for transparency, debugging, and billing |
| **FR-402** | The system shall store input snapshot for each call (with optional anonymization toggle) | MVP | Must | Required for debugging and reproducing issues |
| **FR-403** | The system shall store output for each call | MVP | Must | Enables validation of intelligence behavior over time |
| **FR-404** | The system shall record latency for each call | MVP | Must | Required for P95/P99 performance monitoring (success metric) |
| **FR-405** | The system shall record errors for failed calls | MVP | Must | Essential for debugging and ≤2% schema failure target |
| **FR-406** | The system shall record model used for each call | MVP | Should | Useful for cost analysis; not blocking for basic operation |
| **FR-407** | The system shall record endpoint version for each call | MVP | Must | Required for debugging version-specific issues |
| **FR-408** | Users shall be able to view call history in the UI | MVP | Must | Transparency builds trust — core to product positioning |
| **FR-409** | Call logs shall be retained for 90 days | MVP | Must | Balances user needs with storage costs; industry standard |
| **FR-410** | Users shall be able to export logs before expiration | MVP | Should | Supports compliance needs; not blocking for basic usage |
| **FR-411** | Users shall be able to toggle input anonymization per intelligence | Growth | Should | Privacy enhancement; not required for MVP launch |

---

## 5.5 Schema & Validation (FR-500 Series)

| ID | Requirement | Scope | Priority | Rationale |
|----|-------------|-------|----------|-----------|
| **FR-501** | Every intelligence shall enforce output against a defined JSON schema | MVP | Must | Core differentiator — "schema-constrained output" enables ERP integration |
| **FR-502** | The system shall perform type validation on all outputs | MVP | Must | Prevents integration failures; supports ≤2% schema failure target |
| **FR-503** | All incoming API requests shall be validated against the intelligence's expected input schema | MVP | Must | Prevents wasted LLM costs on invalid requests |
| **FR-504** | Malformed requests shall be rejected with 400 error before processing | MVP | Must | Standard API behavior; saves LLM costs |
| **FR-505** | Validation errors shall return specific field-level feedback | MVP | Must | Reduces developer debugging time; improves DX |
| **FR-506** | 4xx errors shall be returned for client errors (invalid input, auth failure, rate limit) | MVP | Must | Standard HTTP semantics; required for any API |
| **FR-507** | 5xx errors shall be returned for server errors (processing failures, upstream timeouts) | MVP | Must | Standard HTTP semantics; enables proper error handling |
| **FR-508** | Error responses shall include structured JSON with `error_code`, `message`, and `retry_after` | MVP | Must | Enables programmatic error handling in integrations |
| **FR-509** | Retryable errors (429, 503) shall include exponential backoff guidance in headers | MVP | Should | Best practice for API design; improves client behavior |
| **FR-510** | If LLM provider is unavailable, system shall return 503 error | MVP | Must | Graceful degradation; prevents hanging requests |
| **FR-511** | Successful responses shall be cached based on input hash | MVP | Must | Reduces LLM costs; supports 85-92% gross margin target |
| **FR-512** | Identical requests within TTL window shall return cached response | MVP | Must | Improves response time; reduces costs |
| **FR-513** | Cache TTL shall be configurable per intelligence (default: 15 minutes) | MVP | Should | Flexibility for different use cases; not blocking with default |

---

## 5.6 Environments (FR-600 Series)

| ID | Requirement | Scope | Priority | Rationale |
|----|-------------|-------|----------|-----------|
| **FR-601** | Each intelligence shall have a sandbox mode for testing | MVP | Must | Mirrors ERP deployment workflows; reduces production risk |
| **FR-602** | Each intelligence shall have a production mode for live usage | MVP | Must | Required for any real-world integration |
| **FR-603** | Users shall be able to promote an intelligence from sandbox to production | MVP | Must | Controlled deployment process; enterprise requirement |
| **FR-604** | Sandbox and production shall use separate API keys | MVP | Must | Security best practice; prevents test/prod confusion |
| **FR-605** | Sandbox calls shall not count against production quotas | MVP | Should | Encourages testing; fair billing practice |

---

## 5.7 Rate Limiting & Quotas (FR-700 Series)

| ID | Requirement | Scope | Priority | Rationale |
|----|-------------|-------|----------|-----------|
| **FR-701** | The system shall enforce per-endpoint rate limits (requests per minute) | MVP | Must | Prevents system abuse; ensures fair resource usage |
| **FR-702** | The system shall enforce tenant-level monthly quotas | MVP | Must | Enables usage-based pricing model; core to business model |
| **FR-703** | Users shall be able to configure overage behavior (throttle, alert, or allow with charges) | Growth | Should | Flexibility for different customer needs; not blocking MVP |
| **FR-704** | Rate limits and quotas shall be visible in the dashboard | MVP | Must | Transparency required; users need to monitor usage |
| **FR-705** | Rate limits shall be adjustable based on pricing tier | MVP | Must | Enables tiered pricing strategy |
| **FR-706** | Users shall receive alerts when approaching quota limits | Growth | Should | Nice-to-have UX improvement; not blocking MVP |

---

## 5.8 Security & Isolation (FR-800 Series)

| ID | Requirement | Scope | Priority | Rationale |
|----|-------------|-------|----------|-----------|
| **FR-801** | Each tenant shall have isolated prompt logic | MVP | Must | Core security — prevents prompt leakage between competitors |
| **FR-802** | Each tenant shall have isolated configuration stores | MVP | Must | Data isolation required for enterprise trust |
| **FR-803** | Each tenant shall have per-tenant encryption at rest | MVP | Must | Enterprise security requirement; protects against data breach |
| **FR-804** | Each tenant shall have dedicated API keys | MVP | Must | Standard multi-tenant security; enables key management |
| **FR-805** | The system shall maintain audit logs for all tenant actions | MVP | Must | Compliance requirement; supports debugging and accountability |
| **FR-806** | No cross-tenant data access shall be possible | MVP | Must | Fundamental security requirement; non-negotiable |
| **FR-807** | API tokens shall use Bearer authentication via Authorization header | MVP | Must | Industry standard; expected by developers |
| **FR-808** | Tokens shall be scopeable per-intelligence or tenant-wide | MVP | Should | Fine-grained access control; not blocking with tenant-wide default |
| **FR-809** | Tokens shall have configurable expiration (default 90 days) | MVP | Must | Security best practice; limits blast radius of leaked tokens |
| **FR-810** | Users shall be able to rotate tokens | MVP | Must | Security requirement; enables credential rotation policies |
| **FR-811** | Users shall be able to immediately revoke tokens via dashboard or API | MVP | Must | Critical security feature; must respond to compromises instantly |
| **FR-812** | Each tenant shall have isolated embeddings storage (if used) | Growth | Should | Future-proofing for RAG features; not needed for MVP |

---

## 5.9 User Management (FR-900 Series)

| ID | Requirement | Scope | Priority | Rationale |
|----|-------------|-------|----------|-----------|
| **FR-901** | Users shall be able to sign up for an account | MVP | Must | Entry point to product; required for any user |
| **FR-902** | Users shall be able to log in securely | MVP | Must | Basic authentication; non-negotiable |
| **FR-903** | Users shall be able to reset their password | MVP | Must | Standard account recovery; expected by all users |
| **FR-904** | Users shall be able to view and manage their subscription tier | MVP | Must | Self-serve subscription management; supports PLG motion |
| **FR-905** | Users shall be able to view usage metrics and billing | MVP | Must | Transparency for usage-based pricing; builds trust |
| **FR-906** | OAuth 2.0 support for enterprise SSO | Growth | Should | Enterprise requirement; not needed for mid-market beachhead |

---

## 5.10 Stripe Integration (FR-907 to FR-911)

| ID | Requirement | Scope | Priority | Rationale |
|----|-------------|-------|----------|-----------|
| **FR-907** | The system shall integrate with Stripe for subscription billing | MVP | Must | Core business model requires payment processing; Stripe is industry standard |
| **FR-908** | The system shall use Stripe Checkout for subscription upgrades | MVP | Must | Secure, PCI-compliant payment flow without custom forms |
| **FR-909** | The system shall handle Stripe webhook events for subscription lifecycle | MVP | Must | Real-time sync of subscription changes; required for accurate billing state |
| **FR-910** | Users shall be able to manage billing via Stripe Customer Portal | MVP | Must | Self-serve billing management reduces support burden; PLG requirement |
| **FR-911** | The system shall support separate Stripe test and live modes | MVP | Must | Prevents accidental charges during development; standard deployment practice |

---

## 5.11 External Integrations - N8N (FR-912 to FR-915)

| ID | Requirement | Scope | Priority | Rationale |
|----|-------------|-------|----------|-----------|
| **FR-912** | The system shall integrate with N8N via webhook triggers | MVP | Must | Per ADR-005: email handled externally via N8N workflows |
| **FR-913** | The system shall trigger welcome email workflow on user signup | MVP | Should | Improves activation; standard SaaS onboarding practice |
| **FR-914** | The system shall trigger quota alert workflow at 80% and 100% usage | MVP | Should | Proactive communication prevents surprise throttling; reduces churn |
| **FR-915** | The system shall trigger payment failure notification workflow | MVP | Should | Enables dunning flow; critical for revenue recovery |

---

## 5.12 Pricing & Billing (Business Requirements)

### Pricing Model: Hybrid (Platform Fee + Usage)

This model aligns with 2025 SaaS trends where 67% of companies use usage-based pricing, while providing predictable baseline revenue.

### Pricing Tiers

| Tier | Monthly Price | Annual Price | Included | Overage | Target Customer |
|------|---------------|--------------|----------|---------|-----------------|
| **Free** | $0 | $0 | 3 intelligences, 100 API calls/mo | N/A | Evaluation, small projects |
| **Starter** | $99 | $990 | 10 intelligences, 1,000 API calls/mo | $0.05/call | Small ecommerce teams |
| **Growth** | $299 | $2,990 | 25 intelligences, 5,000 API calls/mo | $0.03/call | Growing ecommerce |
| **Professional** | $699 | $6,990 | 100 intelligences, 25,000 API calls/mo | $0.02/call | Mid-market operations |
| **Enterprise** | Custom | Custom | Unlimited intelligences, volume pricing | Negotiated | Large organizations |

### Pricing Rationale
- **Free tier** enables product-led growth (expect 3-5% conversion to paid)
- **Starter at $99/mo** is below psychological barrier, captures small teams
- **Growth/Professional** targets mid-market ACV sweet spot ($3K-$8.4K)
- **Usage overage** aligns cost with value delivered
- **Enterprise** captures larger deals ($15K-$50K+)

### Market Positioning
- **Below** enterprise PIM (Salsify/Akeneo at $25K-$60K+) — accessible to mid-market
- **Above** pure content tools (Hypotenuse at $150/mo starting) — positioned as platform, not tool
- **Aligned** with API pricing norms (Twilio, Stripe model)

### Expected Metrics
- Freemium conversion: 3-5% (industry benchmark for self-serve)
- Blended ACV: $5,000-$8,000 (mid-market segment)
- Target LTV:CAC ratio: 3:1 or better

---

## Functional Requirements Summary

| Category | FR Range | MVP Count | Growth Count | Total |
|----------|----------|-----------|--------------|-------|
| Intelligence Definition | FR-100s | 10 | 0 | 10 |
| API Generation | FR-200s | 6 | 0 | 6 |
| Endpoint Management | FR-300s | 11 | 1 | 12 |
| Call History & Logging | FR-400s | 10 | 1 | 11 |
| Schema & Validation | FR-500s | 13 | 0 | 13 |
| Environments | FR-600s | 5 | 0 | 5 |
| Rate Limiting & Quotas | FR-700s | 4 | 2 | 6 |
| Security & Isolation | FR-800s | 11 | 1 | 12 |
| User Management | FR-900s | 5 | 1 | 6 |
| Stripe Integration | FR-907–911 | 5 | 0 | 5 |
| N8N Integration | FR-912–915 | 4 | 0 | 4 |
| **Total** | | **84** | **6** | **90** |

### Rationale Categories

All 90 FRs now include rationale explaining why they are in MVP or Growth scope:

| Rationale Theme | Example FRs |
|-----------------|-------------|
| **Core value prop** | FR-101, FR-105, FR-201, FR-501 — Enable the "no-code to API" magic |
| **Enterprise trust** | FR-302, FR-309, FR-801–806 — Security, isolation, audit trails |
| **Business model** | FR-511, FR-702, FR-705, FR-907–911 — Caching for margins, usage-based billing, Stripe integration |
| **Success metrics** | FR-204, FR-404, FR-502 — <5 min activation, P95 latency, ≤2% failures |
| **External integrations** | FR-912–915 — N8N webhook triggers for email workflows (per ADR-005) |
| **Not blocking MVP** | FR-312, FR-411, FR-703, FR-706, FR-812, FR-906 — Deferred to Growth |

---

# 6. Non-Goals
- No human-in-the-loop review queue  
- No deep ERP-native integrations  
- No workflow automation engine  
- No chat UI  
- No PIM replacement  
- No agent-style multi-step operations  

The product stays **backend, API-first, and intelligence-focused**.

---

# 7. Competitive Landscape

### Market Position

The Product Intelligence Layer occupies a strategic gap in the market:

```
                    High Technical Complexity
                            │
    ┌───────────────────────┼───────────────────────┐
    │                       │                       │
    │   LLM APIs            │    Developer Tools    │
    │   (OpenAI, Claude)    │    (PromptLayer)      │
    │                       │                       │
Low ├───────────────────────┼───────────────────────┤ High
Price│                       │                       │ Price
    │                       │                       │
    │   ★ OPPORTUNITY ★     │    Enterprise PIM     │
    │   Product Intelligence│    (Salsify, Akeneo)  │
    │   Layer               │                       │
    │                       │                       │
    └───────────────────────┼───────────────────────┘
                            │
                    Low Technical Complexity
```

### Competitive Differentiation

| Competitor | Category | How We Differ |
|------------|----------|---------------|
| **Unstract** | No-code LLM platform | They process *documents* → JSON. We process *product metadata* → intelligence APIs. Different use case (KYC/compliance vs. product intelligence). |
| **Zoovu** | Product discovery | They enrich data *within their platform* for discovery. We provide standalone APIs callable from any system. |
| **Hypotenuse AI** | Content generation | They generate *content* (descriptions, copy). We generate *structured intelligence* (JSON endpoints). |
| **Salsify/Akeneo** | Enterprise PIM | They're monolithic platforms at $25K-$60K+/year. We're 10x faster, 10x cheaper, mid-market accessible. |
| **PromptLayer** | Prompt management | They help manage prompts—users still write them. We eliminate prompt writing entirely. |
| **Direct LLM APIs** | Raw infrastructure | Requires engineering expertise, prompt engineering, output parsing. We abstract all of that. |

### Unique Value Proposition

> "The only no-code platform that turns product metadata definitions into reusable, private intelligence APIs—without writing prompts, managing LLMs, or buying an enterprise PIM."

### Key Differentiators
1. **Schema-to-API** — Define structure, get endpoint (vs. write prompts)
2. **Mid-market accessible** — Price and complexity below enterprise PIM
3. **API-first** — Intelligence callable from anywhere (vs. locked in platform)
4. **Product-focused** — Purpose-built for product intelligence (vs. general-purpose)

---

# 8. Technical Architecture Overview

## Frontend
- Web dashboard
- API documentation viewer
- Test console
- Version control UI
- Logs viewer

## Backend
- Intelligence Definition Service
- API Generation Engine
- Schema Processor
- LLM Gateway
- Call Logging Service
- Tenant Sandbox Manager
- Metrics Aggregator

## Data
- Relational database for config & metadata
- Object storage for logs (optional)
- Caching layer
- Isolated vector store per tenant (if used)  

## Security
- Tenant isolation
- Audit logs
- Encryption at rest & in transit

### Authentication Model
- **API tokens**: Bearer tokens passed via `Authorization` header
- **Token scope**: Tokens can be scoped per-intelligence or tenant-wide
- **Rotation**: Tokens have configurable expiration (default 90 days) with rotation support
- **Revocation**: Immediate revocation available via dashboard or API
- OAuth 2.0 support planned for post-MVP enterprise integrations

## External Dependencies

The platform requires integration with the following external services:

| Service | Purpose | Criticality | Fallback |
|---------|---------|-------------|----------|
| **Anthropic Claude** | LLM provider for intelligence generation | Critical | Provider-agnostic gateway enables future multi-provider support |
| **Stripe** | Subscription billing, payment processing, customer portal | Critical | None for MVP; manual billing not viable at scale |
| **N8N** | Email workflow automation (welcome, alerts, dunning) | Important | Emails delayed but core product functions; can queue for retry |
| **Railway** | Hosting (app + PostgreSQL database) | Critical | Standard containerized app; portable to other PaaS |

### Dependency Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Anthropic API unavailability | Circuit breaker pattern; 503 response with retry guidance; future multi-provider support |
| Stripe API unavailability | Graceful degradation; cache subscription state locally; webhook replay on recovery |
| N8N webhook failure | Fire-and-forget with logging; emails are non-blocking; manual notification backup |
| Railway outage | Standard infrastructure; daily database backups; documented migration path |

### API Keys Required

| Service | Environment Variables | Notes |
|---------|----------------------|-------|
| Anthropic | `ANTHROPIC_API_KEY` | Single key for all LLM calls |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Separate test/live keys |
| N8N | `N8N_WEBHOOK_SECRET`, `N8N_WEBHOOK_*` URLs | Webhook URLs per workflow |

---

# 9. User Flow (MVP)

1. User signs up  
2. Creates their first “Intelligence”  
3. Defines structure (attributes, components, goals)  
4. Saves → backend generates endpoint  
5. User tests the endpoint in browser  
6. Integrates endpoint into ERP, ecommerce, workflow, or script  
7. Views call history to validate behavior  
8. Creates additional intelligences as needed  

---

# 10. Success Metrics

### Activation
- Time to first intelligence: **< 5 minutes**  
- 80% of users test an API within 10 minutes  

### Usage
- ≥ 100 API calls within first 14 days  
- ≤ 2% schema failures  

### Performance
- P95 response time < 2 seconds
- P99 response time < 5 seconds

### Business
- High endpoint expansion (3+ intelligences per customer)
- ACV (Annual Contract Value) growth from expanded intelligence usage
- Target gross margin: 85-92%

### Gross Margin Cost Model (Requires Validation)

Target gross margin depends on LLM provider costs and caching effectiveness:

| Factor | Assumption | Impact |
|--------|------------|--------|
| Primary LLM Provider | Anthropic Claude | Base cost driver |
| Model Selection | Haiku for simple, Sonnet for complex | Cost optimization |
| Avg tokens per call | 500-2,000 tokens | ~$0.001-0.01/call at current pricing |
| Response caching (15-min TTL) | 30-50% cache hit rate | Significant cost reduction |
| Target COGS per API call | < $0.005 | Enables 85%+ margin at $0.03/call |

**Note:** Gross margin target of 92% is achievable with aggressive caching and Haiku-tier models. Sonnet/Opus usage for complex intelligences may reduce margin to 85-88%. Detailed cost modeling required before launch pricing is finalized.

---

# 11. Risk Assessment

### Critical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Fast followers copy positioning** | High | High | Move fast to establish brand and customer relationships. Build proprietary industry templates. Create switching costs through deep integrations. |
| **No design partner for validation** | High | Current | Prioritize early customer discovery. Offer free pilots to 3-5 target customers. Validate core assumptions before full build. |

### High Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Enterprise incumbents add similar features** | High | Medium | Maintain 5-10x price advantage. Focus on simplicity and fast time-to-value. Consider partnerships over direct competition. |
| **Slow enterprise sales cycles** | Medium | High | Build PLG revenue base with self-serve ecommerce first. Land-and-expand strategy. Standardized 30-day POC process. |
| **Data quality issues in customer data** | Medium | High | Input validation before LLM processing. Basic data normalization. Feedback loops for output correction. Pre-built schema templates. |

### Medium Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **LLM cost increases** | Medium | Low | Multi-provider support (Anthropic primary, others as backup). Aggressive caching strategy. Model selection optimization. |
| **AI pilot fatigue** | Medium | Medium | Emphasize fast time-to-value (< 5 min to first intelligence). Clear ROI demonstration. Focus on production use, not experiments. |

### Low Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Regulatory changes (AI governance)** | Low | Medium | Monitor regulatory landscape. Design for auditability. Maintain clear data handling policies. |

### Assumptions Requiring Validation

1. Mid-market ecommerce teams will pay $99-699/mo for intelligence APIs (vs. building in-house or using content tools)
2. "No prompt writing" is a compelling differentiator (vs. prompt management tools)
3. 15-minute cache TTL is acceptable for most use cases
4. Schema-constrained output reliability meets enterprise integration requirements
5. Self-serve onboarding can achieve < 5 min time to first intelligence

---

# 12. Future Enhancements (Post-MVP)
- Intelligence Marketplace
- Automated intelligence suggestions
- Industry-themed templates
- Bulk product ingestion
- Customer-specific fine-tuning
- Custom transformer rules
- Advanced monitoring
- Webhook push mode

---

# 13. References

## Source Documents

| Document | Location | Description |
|----------|----------|-------------|
| **Market Research Report** | `docs/research-market-2025-11-24.md` | Comprehensive market analysis including TAM/SAM/SOM, competitive landscape, customer segments, and pricing strategy |

## Key Data Sources (from Market Research)

| Source | Data Used |
|--------|-----------|
| Dataintelo | Product Attribute Extraction AI market size ($1.19B → $10.26B by 2033) |
| Mordor Intelligence | Enterprise AI market data ($97B, 18.9% CAGR) |
| Aras | 91% of manufacturers increasing AI investment; 65% lack AI skills |
| ERP Today / Rootstock | 82% of manufacturers increasing AI budgets in 2025 |
| Maxio | 67% of SaaS companies using usage-based pricing |
| Crunchbase / PitchBook | Competitor funding and revenue data (Zoovu, Salsify, Hypotenuse AI) |
| First Page Sage | Freemium conversion rate benchmarks (3-5%) |

## Related Documents (To Be Created)

| Document | Status | Purpose |
|----------|--------|---------|
| `epics.md` | Pending | Epic and story breakdown with FR traceability |
| `architecture.md` | Pending | Technical architecture decisions |
| `data-model.md` | Pending | Database schema and data flow |
| `api-spec.md` | Pending | OpenAPI specification for intelligence endpoints |

---

# Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-24 | Zac | Initial PRD draft |
| 1.1 | 2025-11-24 | John (PM Agent) | Added: segment prioritization, pricing strategy, competitive landscape, key definitions, risk assessment, formal FRs (81 requirements), project classification, references |
| 1.2 | 2025-11-25 | John (PM Agent) | Added: Stripe Integration FRs (FR-907–911), N8N Integration FRs (FR-912–915), updated FR summary (now 90 FRs total) |
| 1.3 | 2025-11-25 | John (PM Agent) | Added: External Dependencies section with service inventory, risk mitigation, and required API keys |

---

# End of Document
