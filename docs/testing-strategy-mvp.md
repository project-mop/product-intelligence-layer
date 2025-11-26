# Testing Strategy (MVP)

This document defines the testing patterns, conventions, and best practices for the Product Intelligence Layer project.

## Test Types Overview

| Type | Framework | Directory | Naming | Purpose |
|------|-----------|-----------|--------|---------|
| Unit | Vitest | `tests/unit/` | `*.test.ts` | Test isolated functions/modules |
| Integration | Vitest | `tests/integration/` | `*.test.ts` | Test with real database |
| Component | Vitest + RTL | `tests/unit/components/` | `*.test.tsx` | Test React components |
| E2E | Playwright | `tests/e2e/` | `*.spec.ts` | Test user flows |

## Directory Structure

```
tests/
├── unit/                          # Unit tests (mocked dependencies)
│   ├── auth.test.ts               # Password hashing, auth utilities
│   ├── api-key.test.ts            # API key service (50 tests)
│   ├── audit.test.ts              # Audit context extraction
│   ├── n8n-client.test.ts         # N8N webhook client
│   └── components/                # Component unit tests
│       └── example.test.tsx
├── integration/                   # Integration tests (real database)
│   ├── database-isolation.test.ts # DB cleanup verification
│   ├── api-key-router.test.ts     # apiKey router (29 tests)
│   ├── audit-log-router.test.ts   # auditLog router (19 tests)
│   └── auth-router.test.ts        # auth router (23 tests)
├── e2e/                           # End-to-end tests (deferred)
│   └── example.spec.ts
├── support/
│   ├── db.ts                      # Test database utilities
│   ├── trpc.ts                    # tRPC test callers
│   ├── render.tsx                 # React render utilities
│   └── factories/
│       ├── index.ts               # Factory exports
│       ├── tenant.factory.ts
│       ├── user.factory.ts
│       ├── audit-log.factory.ts
│       └── api-key.factory.ts
├── setup.ts                       # Unit test setup
└── setup.integration.ts           # Integration test setup (mocks NextAuth, audit service)
```

## NPM Scripts

```bash
# Unit Tests
pnpm test              # Run all unit tests
pnpm test:unit         # Run unit tests only
pnpm test:watch        # Watch mode

# Integration Tests
pnpm test:integration  # Run integration tests (requires DB)

# E2E Tests
pnpm test:e2e          # Run E2E tests
pnpm test:e2e:ui       # Run with Playwright UI
pnpm test:e2e:headed   # Run in headed browser
pnpm test:e2e:debug    # Debug mode

# Combined
pnpm test:all          # Run unit + integration tests
pnpm test:coverage     # Run with coverage report
```

## Coverage Requirements

**Current thresholds:** 90% lines, 70% functions, 90% branches, 90% statements

Coverage is enforced in CI — builds fail if coverage drops below threshold.

### Running Coverage

```bash
pnpm test:coverage
```

Coverage reports are generated in:
- `coverage/` directory (HTML, JSON, lcov)
- Terminal output (text summary)

### Excluded from Coverage

Files excluded from **unit test** coverage (configured in `vitest.config.ts`):

| Exclusion | Reason |
|-----------|--------|
| `src/**/*.test.{ts,tsx}` | Test files themselves |
| `src/**/index.ts` | Barrel exports |
| `src/app/**/*` | Next.js pages (tested via E2E) |
| `src/env.js` | Environment validation |
| `src/trpc/**/*` | tRPC client setup |
| `src/server/api/routers/**/*` | **Covered by integration tests** |
| `src/server/api/root.ts` | Router aggregation |
| `src/server/api/trpc.ts` | tRPC context/middleware |
| `src/server/auth/**/*` | NextAuth config (requires runtime) |
| `src/server/db.ts` | Database client setup |

### Coverage Strategy Decision (2024-11)

**Why routers are excluded from unit coverage:**

tRPC routers are thoroughly tested via **integration tests** (83 tests) that run against a real PostgreSQL database. These tests verify:
- All CRUD operations
- Tenant isolation
- Authentication/authorization
- Input validation
- Audit logging

Writing additional unit tests with mocked databases would duplicate coverage without adding value. The integration tests provide higher confidence because they test the actual database queries.

**Trade-off:** Integration tests are slower (~30s) but catch real issues. Unit tests are fast but require mocking the database, which can hide bugs in query logic.

**Decision:** Accept the split coverage model:
- **Unit tests** → Services, utilities, pure functions (fast, mocked)
- **Integration tests** → Routers, database operations (slower, real DB)

## Test Patterns

### Unit Tests

Unit tests should mock external dependencies (database, APIs, etc.).

```typescript
import { describe, expect, it, vi } from "vitest";

describe("MyFunction", () => {
  it("should do something", () => {
    // Arrange
    const input = "test";

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe("expected");
  });
});
```

### Integration Tests

Integration tests use a real database with automatic cleanup.

```typescript
import { describe, expect, it } from "vitest";
import { testDb } from "../support/db";
import { tenantFactory } from "../support/factories";

describe("Tenant Operations", () => {
  // Database is automatically reset before each test

  it("should create a tenant", async () => {
    const tenant = await tenantFactory.create({ name: "Test Corp" });

    const found = await testDb.tenant.findUnique({
      where: { id: tenant.id },
    });

    expect(found?.name).toBe("Test Corp");
  });
});
```

### tRPC Router Tests

Use the tRPC test callers for router testing.

```typescript
import { describe, expect, it } from "vitest";
import { createAuthenticatedCaller, createUnauthenticatedCaller } from "../support/trpc";
import { tenantFactory, userFactory } from "../support/factories";

describe("ApiKey Router", () => {
  it("should list API keys for authenticated user", async () => {
    // Create test data
    const tenant = await tenantFactory.create();
    const user = await userFactory.create({ tenantId: tenant.id });

    // Create authenticated caller
    const caller = createAuthenticatedCaller({
      userId: user.id,
      tenantId: tenant.id,
    });

    // Call the router
    const result = await caller.apiKey.list();

    expect(result).toEqual([]);
  });

  it("should reject unauthenticated requests", async () => {
    const caller = createUnauthenticatedCaller();

    await expect(caller.apiKey.list()).rejects.toThrow("UNAUTHORIZED");
  });
});
```

### Component Tests

Use the custom render function for component testing.

```typescript
import { describe, expect, it } from "vitest";
import { renderWithProviders, createMockSession, screen } from "../../support/render";
import { MyComponent } from "~/components/MyComponent";

describe("MyComponent", () => {
  it("should render for authenticated user", () => {
    const session = createMockSession({
      user: { name: "Alice" },
    });

    renderWithProviders(<MyComponent />, { session });

    expect(screen.getByText("Welcome, Alice")).toBeInTheDocument();
  });

  it("should show login prompt when unauthenticated", () => {
    renderWithProviders(<MyComponent />);

    expect(screen.getByText("Please sign in")).toBeInTheDocument();
  });
});
```

### E2E Tests

Use Playwright for end-to-end testing.

```typescript
import { test, expect } from "@playwright/test";

test.describe("User Flow", () => {
  test("should complete registration", async ({ page }) => {
    await page.goto("/register");

    await page.fill('[name="email"]', "test@example.com");
    await page.fill('[name="password"]', "securepassword");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/dashboard");
    await expect(page.locator("h1")).toContainText("Dashboard");
  });
});
```

## Factory Usage

### Building vs Creating

- **`build()`**: Creates object in memory (no database)
- **`create()`**: Creates and persists to database

```typescript
import { tenantFactory, userFactory } from "tests/support/factories";

// Unit tests - use build()
const tenant = tenantFactory.build({ name: "Test" });

// Integration tests - use create()
const tenant = await tenantFactory.create({ name: "Test" });

// With relationships
const { user, tenant } = await userFactory.createWithTenant();
```

### Available Factories

| Factory | Entity | Key Methods |
|---------|--------|-------------|
| `tenantFactory` | Tenant | `build`, `create`, `createMany` |
| `userFactory` | User | `build`, `create`, `createWithTenant`, `createMany` |
| `auditLogFactory` | AuditLog | `build`, `create`, `createUserAction`, `createApiKeyAction` |
| `apiKeyFactory` | ApiKey | `build`, `create`, `createForTenant`, `createMany` |

Legacy helpers (unit tests only):
- `createMockApiKey` — In-memory API key for unit tests
- `createExpiredApiKey`, `createRevokedApiKey` — Edge case testing

## Database Testing

### Test Database Setup

See [docs/database-debt.md](./database-debt.md) for setup instructions.

### Isolation

- Each test starts with a clean database (tables truncated)
- Tests run sequentially to avoid conflicts
- Use `testDb` from `tests/support/db.ts` for database access

```typescript
import { testDb, resetDatabase, getTableRowCount } from "tests/support/db";

// Check table is empty
const count = await getTableRowCount("Tenant");
expect(count).toBe(0);

// Query using test database
const tenants = await testDb.tenant.findMany();
```

## Troubleshooting

### Test Database Connection Failed

```
Error: Test database is not accessible
```

1. Verify PostgreSQL is running
2. Create the test database if it doesn't exist
3. Set `TEST_DATABASE_URL` environment variable

See [docs/database-debt.md](./database-debt.md) for detailed instructions.

### Coverage Threshold Failed

```
ERROR: Coverage threshold not met
```

1. Check which files are below threshold: `pnpm test:coverage`
2. Add tests for uncovered code paths
3. Review coverage exclusions in `vitest.config.ts`

### E2E Tests Timing Out

1. Increase timeout in `playwright.config.ts`
2. Check that dev server is starting correctly
3. Verify database is accessible for E2E environment

### Component Tests Failing

1. Ensure you're using `renderWithProviders` not plain `render`
2. Check that mock session is provided if component requires auth
3. Use `waitFor` for async operations

## Best Practices

1. **Test behavior, not implementation**: Focus on what code does, not how
2. **One assertion concept per test**: Keep tests focused
3. **Use descriptive test names**: `should return error when email is invalid`
4. **Arrange-Act-Assert**: Structure tests clearly
5. **Don't test third-party code**: Trust libraries, test your usage
6. **Keep tests fast**: Mock slow operations in unit tests
7. **Test edge cases**: Empty arrays, null values, error conditions
8. **Maintain test isolation**: No shared state between tests

## CI Integration

Tests run automatically in GitHub Actions on:
- Push to `main`
- Pull requests to `main`

### CI Jobs

1. **build**: Typecheck, lint, build
2. **test-unit**: Unit tests
3. **test-integration**: Integration tests with PostgreSQL
4. **test-e2e**: E2E tests with Playwright

### Viewing Results

- Check Actions tab in GitHub for test results
- Failed E2E tests upload artifacts (screenshots, traces)

## References

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Documentation](https://testing-library.com/)
- [docs/database-debt.md](./database-debt.md) - Database setup
- [docs/architecture.md](./architecture.md) - Architecture decisions
