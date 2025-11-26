/**
 * User Test Factory
 *
 * Generates test data for User entities.
 * Provides both in-memory (build) and persisted (create) methods.
 *
 * @module tests/support/factories/user.factory
 */

import type { User } from "../../../generated/prisma";
import { generateUserId, generateTenantId } from "~/lib/id";
import { testDb } from "../db";

let counter = 0;

/**
 * Default user data for testing.
 */
const defaultUser = (): Omit<User, "id" | "tenantId"> => ({
  email: `user${++counter}@test.example.com`,
  emailVerified: null,
  name: `Test User ${counter}`,
  image: null,
  passwordHash: null, // Can be overridden with a real bcrypt hash if needed
  createdAt: new Date(),
  updatedAt: new Date(),
});

/** Options for building/creating a user */
interface UserFactoryOptions extends Partial<User> {
  /** If provided, uses this tenantId. If not, generates a new one. */
  tenantId?: string;
}

/**
 * Builds a user object in memory without persisting to database.
 * Useful for unit tests that don't need database interaction.
 *
 * @param overrides - Partial User fields to override defaults
 * @returns Complete User object
 *
 * @example
 * ```typescript
 * const user = userFactory.build({ name: "Alice" });
 * const userWithTenant = userFactory.build({ tenantId: "ten_123" });
 * ```
 */
function build(overrides: UserFactoryOptions = {}): User {
  return {
    id: generateUserId(),
    tenantId: overrides.tenantId ?? generateTenantId(),
    ...defaultUser(),
    ...overrides,
  };
}

/**
 * Creates a user and persists it to the test database.
 * If tenantId is not provided, also creates a tenant.
 *
 * @param overrides - Partial User fields to override defaults
 * @returns Promise resolving to the created User
 *
 * @example
 * ```typescript
 * // Creates user with auto-created tenant
 * const user = await userFactory.create();
 *
 * // Creates user for existing tenant
 * const user = await userFactory.create({ tenantId: tenant.id });
 * ```
 */
async function create(overrides: UserFactoryOptions = {}): Promise<User> {
  // If no tenantId provided, create a tenant first
  let tenantId = overrides.tenantId;
  if (!tenantId) {
    const tenant = await testDb.tenant.create({
      data: {
        id: generateTenantId(),
        name: `Tenant for User ${counter + 1}`,
      },
    });
    tenantId = tenant.id;
  }

  const data = build({ ...overrides, tenantId });
  return testDb.user.create({ data });
}

/**
 * Creates a user with a specific tenant in a single transaction.
 * Useful when you need both entities and want to ensure they're related.
 *
 * @param userOverrides - Partial User fields
 * @param tenantOverrides - Partial Tenant fields
 * @returns Promise resolving to { user, tenant }
 *
 * @example
 * ```typescript
 * const { user, tenant } = await userFactory.createWithTenant(
 *   { name: "Alice" },
 *   { name: "Alice's Company" }
 * );
 * ```
 */
async function createWithTenant(
  userOverrides: Partial<Omit<User, "id" | "tenantId">> = {},
  tenantOverrides: Partial<{ name: string }> = {}
): Promise<{ user: User; tenant: Awaited<ReturnType<typeof testDb.tenant.create>> }> {
  const tenantId = generateTenantId();

  const tenant = await testDb.tenant.create({
    data: {
      id: tenantId,
      name: tenantOverrides.name ?? `Tenant ${counter + 1}`,
    },
  });

  const user = await testDb.user.create({
    data: {
      id: generateUserId(),
      tenantId,
      ...defaultUser(),
      ...userOverrides,
    },
  });

  return { user, tenant };
}

/**
 * Creates multiple users for the same tenant.
 *
 * @param count - Number of users to create
 * @param tenantId - Tenant ID (creates new tenant if not provided)
 * @returns Promise resolving to array of created Users
 */
async function createMany(
  count: number,
  tenantId?: string
): Promise<User[]> {
  // Create tenant if not provided
  let tid = tenantId;
  if (!tid) {
    const tenant = await testDb.tenant.create({
      data: {
        id: generateTenantId(),
        name: `Tenant for ${count} users`,
      },
    });
    tid = tenant.id;
  }

  const users: User[] = [];
  for (let i = 0; i < count; i++) {
    users.push(await create({ tenantId: tid }));
  }
  return users;
}

/**
 * Resets the internal counter (for test isolation).
 */
function resetCounter(): void {
  counter = 0;
}

export const userFactory = {
  build,
  create,
  createWithTenant,
  createMany,
  resetCounter,
};
