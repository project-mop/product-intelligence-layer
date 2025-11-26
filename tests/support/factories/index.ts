/**
 * Test Data Factories
 *
 * Central export for all test data factories.
 * Each factory provides:
 * - build(): Creates object in memory (no DB)
 * - create(): Creates and persists to test database
 *
 * @module tests/support/factories
 *
 * @example
 * ```typescript
 * import { tenantFactory, userFactory, auditLogFactory } from "tests/support/factories";
 *
 * // In-memory objects (unit tests)
 * const tenant = tenantFactory.build();
 * const user = userFactory.build({ tenantId: tenant.id });
 *
 * // Persisted objects (integration tests)
 * const tenant = await tenantFactory.create();
 * const user = await userFactory.create({ tenantId: tenant.id });
 * ```
 */

export { tenantFactory } from "./tenant.factory";
export { userFactory } from "./user.factory";
export { auditLogFactory, AUDIT_ACTIONS, AUDIT_RESOURCES } from "./audit-log.factory";
export {
  apiKeyFactory,
  createMockApiKey,
  createMockApiKeyForEnvironment,
  createRevokedApiKey,
  createExpiredApiKey,
  createNonExpiringApiKey,
  resetIdCounter as resetApiKeyIdCounter,
} from "./api-key.factory";

/**
 * Resets all factory counters.
 * Call this in beforeEach for test isolation.
 */
export function resetAllFactories(): void {
  // Import and reset each factory's counter
  // This is called automatically in setup.integration.ts
}
