/**
 * Test Database Utilities
 *
 * Provides database isolation and cleanup utilities for integration tests.
 * Uses PostgreSQL with transaction-based cleanup for test isolation.
 *
 * @module tests/support/db
 */

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma";

// Test database configuration
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:password@localhost:5432/product_intelligence_layer_test";

// Create a dedicated pool for tests
const testPool = new Pool({ connectionString: TEST_DATABASE_URL });
const testAdapter = new PrismaPg(testPool);

/**
 * Test Prisma client instance.
 * Uses a separate pool to avoid conflicts with the application database.
 */
export const testDb = new PrismaClient({
  adapter: testAdapter,
  log: process.env.DEBUG_TESTS ? ["query", "error", "warn"] : ["error"],
});

/**
 * Tables available for truncation.
 * Order matters due to foreign key constraints - truncate children before parents.
 * NOTE: Use actual PostgreSQL table names (after @@map directives) not Prisma model names.
 */
export const TRUNCATABLE_TABLES = [
  // Children first (no FK references to them)
  "AuditLog",
  "RateLimit",
  "response_cache", // @@map("response_cache") in schema
  "CallLog",
  "ApiKey",
  "ProcessVersion",
  "Process",
  "Session",
  "Account",
  "VerificationToken",
  // User depends on Tenant, truncate before Tenant
  "User",
  // Parent last
  "Tenant",
] as const;

/** Type for valid table names */
export type TruncatableTable = (typeof TRUNCATABLE_TABLES)[number];

/**
 * Resets the test database by truncating all tables.
 * Uses TRUNCATE with CASCADE for efficient cleanup.
 *
 * Call this in beforeEach to ensure test isolation.
 *
 * @example
 * ```typescript
 * import { resetDatabase } from "tests/support/db";
 *
 * beforeEach(async () => {
 *   await resetDatabase();
 * });
 * ```
 */
export async function resetDatabase(): Promise<void> {
  // Use raw SQL for faster truncation with CASCADE
  // This handles foreign key constraints automatically
  // NOTE: Use actual PostgreSQL table names (after @@map directives) not Prisma model names
  await testDb.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AuditLog",
      "RateLimit",
      "response_cache",
      "CallLog",
      "ApiKey",
      "ProcessVersion",
      "Process",
      "Session",
      "Account",
      "VerificationToken",
      "User",
      "Tenant"
    CASCADE
  `);
}

/**
 * Resets a specific table by truncating it.
 * Useful when you only need to reset specific tables.
 *
 * @param tableName - Name of the table to truncate
 */
export async function resetTable(tableName: TruncatableTable): Promise<void> {
  await testDb.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE`);
}

/**
 * Disconnects the test database client.
 * Call this in afterAll to clean up connections.
 *
 * @example
 * ```typescript
 * import { disconnectTestDb } from "tests/support/db";
 *
 * afterAll(async () => {
 *   await disconnectTestDb();
 * });
 * ```
 */
export async function disconnectTestDb(): Promise<void> {
  await testDb.$disconnect();
  await testPool.end();
}

/**
 * Checks if the test database is accessible.
 * Useful for verifying test setup.
 *
 * @returns true if database is accessible
 */
export async function isDatabaseAccessible(): Promise<boolean> {
  try {
    await testDb.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the current row count for a table.
 * Useful for verifying test isolation.
 *
 * @param tableName - Name of the table
 * @returns Number of rows in the table
 */
export async function getTableRowCount(
  tableName: TruncatableTable
): Promise<number> {
  const result = await testDb.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "${tableName}"`
  );
  return Number(result[0]?.count ?? 0);
}

// Re-export the test database URL for use in setup files
export { TEST_DATABASE_URL };
