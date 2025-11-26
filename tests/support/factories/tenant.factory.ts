/**
 * Tenant Test Factory
 *
 * Generates test data for Tenant entities.
 * Provides both in-memory (build) and persisted (create) methods.
 *
 * @module tests/support/factories/tenant.factory
 */

import type { Tenant } from "../../../generated/prisma";
import { generateTenantId } from "~/lib/id";
import { testDb } from "../db";

let counter = 0;

/**
 * Default tenant data for testing.
 */
const defaultTenant = (): Omit<Tenant, "id"> => ({
  name: `Test Tenant ${++counter}`,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

/**
 * Builds a tenant object in memory without persisting to database.
 * Useful for unit tests that don't need database interaction.
 *
 * @param overrides - Partial Tenant fields to override defaults
 * @returns Complete Tenant object
 *
 * @example
 * ```typescript
 * const tenant = tenantFactory.build({ name: "Custom Corp" });
 * ```
 */
function build(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: generateTenantId(),
    ...defaultTenant(),
    ...overrides,
  };
}

/**
 * Creates a tenant and persists it to the test database.
 * Use this for integration tests that need real database records.
 *
 * @param overrides - Partial Tenant fields to override defaults
 * @returns Promise resolving to the created Tenant
 *
 * @example
 * ```typescript
 * const tenant = await tenantFactory.create({ name: "Acme Inc" });
 * ```
 */
async function create(overrides: Partial<Tenant> = {}): Promise<Tenant> {
  const data = build(overrides);
  return testDb.tenant.create({ data });
}

/**
 * Creates multiple tenants and persists them to the test database.
 *
 * @param count - Number of tenants to create
 * @param overrides - Partial Tenant fields to apply to all tenants
 * @returns Promise resolving to array of created Tenants
 *
 * @example
 * ```typescript
 * const tenants = await tenantFactory.createMany(3);
 * ```
 */
async function createMany(
  count: number,
  overrides: Partial<Omit<Tenant, "id">> = {}
): Promise<Tenant[]> {
  const tenants: Tenant[] = [];
  for (let i = 0; i < count; i++) {
    tenants.push(await create(overrides));
  }
  return tenants;
}

/**
 * Resets the internal counter (for test isolation).
 */
function resetCounter(): void {
  counter = 0;
}

export const tenantFactory = {
  build,
  create,
  createMany,
  resetCounter,
};
