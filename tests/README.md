# Test Suite

Product Intelligence Layer test suite using Vitest.

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run only unit tests
pnpm test:unit

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test tests/unit/api-key.test.ts
```

## Test Structure

```
tests/
├── unit/                      # Unit tests (mocked dependencies)
│   ├── api-key.test.ts       # API key service tests (50 tests)
│   ├── auth.test.ts          # Authentication tests (15 tests)
│   └── n8n-client.test.ts    # N8N webhook client tests (7 tests)
├── integration/              # Integration tests (requires DB)
├── support/
│   └── factories/            # Test data factories
│       └── api-key.factory.ts
└── setup.ts                  # Global test setup
```

## Priority Tags

Tests are tagged with priority levels in their names:

- **[P0]**: Critical paths, run every commit
- **[P1]**: High priority, run on PR to main
- **[P2]**: Medium priority, run nightly
- **[P3]**: Low priority, run on-demand

Run by priority:
```bash
# P0 only (critical)
pnpm test -- --grep '\[P0\]'

# P0 + P1 (pre-merge)
pnpm test -- --grep '\[P0\]|\[P1\]'
```

## Test Patterns

### Given-When-Then Format

All tests follow the Given-When-Then format:

```typescript
it('[P1] should create key with correct format', async () => {
  // GIVEN: Valid tenant and key parameters
  const mockCreatedKey = { /* ... */ };
  vi.mocked(db.apiKey.create).mockResolvedValue(mockCreatedKey);

  // WHEN: Creating a new API key
  const result = await createApiKey({ /* ... */ });

  // THEN: Returns plaintext key and stored record
  expect(result.plainTextKey).toMatch(/^pil_live_[a-f0-9]{64}$/);
});
```

### Mocking Database

```typescript
vi.mock("~/server/db", () => ({
  db: {
    apiKey: {
      findUnique: vi.fn(),
      create: vi.fn(),
      // ...
    },
    $transaction: vi.fn(),
  },
}));
```

### Test Data Factories

Use factories for consistent test data:

```typescript
import { createMockApiKey, createExpiredApiKey } from '../support/factories/api-key.factory';

const validKey = createMockApiKey({ name: 'Test Key' });
const expiredKey = createExpiredApiKey();
```

## Coverage by Story

### Story 1.4: API Token Management (50 tests)

| Acceptance Criteria | Test Coverage |
|---------------------|---------------|
| AC 1: Create API token | `createApiKey` tests |
| AC 2: Token displayed once | Plaintext key return tests |
| AC 3: Environment prefix | `generateKey` format tests |
| AC 4: View token list | `listApiKeys` tests |
| AC 5: Token rotation | `rotateApiKey` atomic tests |
| AC 6: Token revocation | `revokeApiKey` + validation tests |
| AC 7: Configurable expiration | Default 90-day expiration tests |
| AC 8: Expired token 401 | `EXPIRED_KEY` error code tests |

## Writing New Tests

1. Use Given-When-Then format
2. Tag with priority: `[P0]`, `[P1]`, `[P2]`, `[P3]`
3. Mock external dependencies
4. Use factories for test data
5. One assertion per test when possible
6. No hard waits or flaky patterns
