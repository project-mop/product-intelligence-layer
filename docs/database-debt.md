# Database Setup & Testing Infrastructure

This document describes the local and test database setup for the Product Intelligence Layer project.

## Local Development Database

### Prerequisites

- PostgreSQL 16 (via Homebrew recommended)
- Local PostgreSQL service running

### macOS Setup (Homebrew)

```bash
# Install PostgreSQL 16
brew install postgresql@16

# Start the service
brew services start postgresql@16

# Verify it's running
brew services list | grep postgres
```

### Database Configuration

The project uses two databases:

| Database | Purpose | URL Pattern |
|----------|---------|-------------|
| `product-intelligence-layer` | Development | `postgresql://USER@localhost:5432/product-intelligence-layer` |
| `product_intelligence_layer_test` | Integration tests | `postgresql://USER@localhost:5432/product_intelligence_layer_test` |

### Environment Variables

Configure in `.env`:

```env
# Development database
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/product-intelligence-layer"
```

For integration tests, set `TEST_DATABASE_URL` or the tests will fall back to `DATABASE_URL`:

```env
# Test database (optional - falls back to DATABASE_URL)
TEST_DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/product_intelligence_layer_test"
```

## Test Database Setup

### Creating the Test Database

```bash
# Create the test database (using your local username)
/opt/homebrew/opt/postgresql@16/bin/createdb -U YOUR_USERNAME "product_intelligence_layer_test"

# Push the schema to the test database
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/product_intelligence_layer_test" pnpm prisma db push
```

### Running Integration Tests

```bash
# Run integration tests with explicit test database URL
TEST_DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/product_intelligence_layer_test" pnpm test:integration

# Or set it in your environment and run
export TEST_DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/product_intelligence_layer_test"
pnpm test:integration
```

## Test Infrastructure Architecture

### Directory Structure

```
tests/
├── unit/                          # Unit tests (mocked, no real DB)
│   ├── auth.test.ts
│   ├── api-key.test.ts
│   ├── audit.test.ts
│   └── n8n-client.test.ts
├── integration/                   # Integration tests (real database)
│   ├── database-isolation.test.ts # DB cleanup verification (12 tests)
│   ├── api-key-router.test.ts     # apiKey router (29 tests)
│   ├── audit-log-router.test.ts   # auditLog router (19 tests)
│   └── auth-router.test.ts        # auth router (23 tests)
├── support/
│   ├── db.ts                      # Test database utilities
│   ├── trpc.ts                    # tRPC test callers
│   └── factories/                 # Test data factories
├── setup.ts                       # Unit test setup
└── setup.integration.ts           # Integration test setup (mocks NextAuth, audit service)
```

### Vitest Configuration

Two separate Vitest configurations:

1. **`vitest.config.ts`** - Unit tests
   - Uses `jsdom` environment
   - Excludes integration tests
   - Mocked database

2. **`vitest.config.integration.ts`** - Integration tests
   - Uses `node` environment
   - Sequential execution (no parallel to avoid DB conflicts)
   - Real database with cleanup between tests

### Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm test` | Run all unit tests |
| `pnpm test:unit` | Run unit tests only |
| `pnpm test:integration` | Run integration tests (requires test DB) |
| `pnpm test:all` | Run unit + integration tests |
| `pnpm test:watch` | Watch mode for unit tests |
| `pnpm test:integration:watch` | Watch mode for integration tests |
| `pnpm test:coverage` | Run tests with coverage report |

## Test Database Utilities

### Key Functions (`tests/support/db.ts`)

```typescript
import { testDb, resetDatabase, getTableRowCount } from "tests/support/db";

// Reset all tables before each test (automatic in integration setup)
await resetDatabase();

// Query the test database
const tenant = await testDb.tenant.create({ data: { ... } });

// Check table state
const count = await getTableRowCount("Tenant");
```

### Database Isolation

The integration test setup (`tests/setup.integration.ts`) provides:

1. **Automatic cleanup**: `beforeEach` calls `resetDatabase()` to truncate all tables
2. **Connection management**: `afterAll` disconnects the test database client
3. **Verification**: `beforeAll` verifies database is accessible

### Writing Integration Tests

```typescript
import { describe, expect, it } from "vitest";
import { testDb, getTableRowCount } from "../support/db";
import { generateTenantId } from "~/lib/id";

describe("My Integration Test", () => {
  it("should work with real database", async () => {
    // Database is automatically reset before this test
    const tenantId = generateTenantId();

    const tenant = await testDb.tenant.create({
      data: {
        id: tenantId,
        name: "Test Tenant",
      },
    });

    expect(tenant.name).toBe("Test Tenant");

    // Data will be cleaned up before the next test
  });
});
```

## CI/CD Integration

GitHub Actions is configured to run integration tests with a PostgreSQL service container.

### CI Workflow (`.github/workflows/ci.yml`)

The `test-integration` job:
1. Spins up PostgreSQL 16 service container
2. Pushes Prisma schema to test database
3. Runs all 83 integration tests
4. Container is destroyed after workflow completes

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: test_db
    ports:
      - 5432:5432
```

No cloud database required — the container is ephemeral and exists only for the CI run.

## Known Limitations & Technical Debt

### Current Limitations

1. **Sequential Execution**: Integration tests run sequentially to avoid database conflicts
2. **Manual Test DB Setup**: Developers must manually create the local test database

### Future Improvements (Post-MVP)

1. **Parallel Test Execution**: Use separate schemas per test file for parallel execution
2. **Automatic DB Creation**: Script to auto-create test database if missing
3. **Docker Compose**: Alternative setup using Docker for consistent environments
4. **Transaction Rollback**: Consider transaction-based isolation instead of truncation for speed

## Troubleshooting

### "Test database is not accessible"

1. Verify PostgreSQL is running: `brew services list | grep postgres`
2. Verify test database exists: `/opt/homebrew/opt/postgresql@16/bin/psql -U YOUR_USERNAME -c "SELECT datname FROM pg_database;"`
3. Check `TEST_DATABASE_URL` environment variable

### "relation does not exist"

The schema hasn't been pushed to the test database:

```bash
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/product_intelligence_layer_test" pnpm prisma db push
```

### Slow Integration Tests

Integration tests run sequentially to ensure isolation. If tests become slow:

1. Consider reducing test data volume
2. Use more specific test scenarios
3. Future: Implement parallel execution with separate schemas

## References

- [Vitest Documentation](https://vitest.dev/)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- Story 1.6: Test Infrastructure Setup
- `docs/testing-strategy-mvp.md` - Testing patterns and coverage strategy
