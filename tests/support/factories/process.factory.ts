/**
 * Process Test Factory
 *
 * Generates test data for Process entities.
 * Provides both in-memory (build) and persisted (create) methods.
 *
 * @module tests/support/factories/process.factory
 */

import { Prisma, type Process } from "../../../generated/prisma";
import { generateProcessId, generateTenantId } from "~/lib/id";
import { testDb } from "../db";

let counter = 0;

/**
 * Default process input schema for testing.
 */
const defaultInputSchema = {
  type: "object",
  required: ["input"],
  properties: {
    input: { type: "string", description: "Test input" },
  },
};

/**
 * Default process output schema for testing.
 */
const defaultOutputSchema = {
  type: "object",
  required: ["output"],
  properties: {
    output: { type: "string", description: "Test output" },
  },
};

/**
 * Default process data for testing.
 */
const defaultProcess = (): Omit<Process, "id" | "tenantId"> => ({
  name: `Test Process ${++counter}`,
  description: `Test process description ${counter}`,
  inputSchema: defaultInputSchema,
  outputSchema: defaultOutputSchema,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

/** Options for building/creating a process */
interface ProcessFactoryOptions extends Partial<Process> {
  /** If provided, uses this tenantId. If not, generates a new one. */
  tenantId?: string;
}

/**
 * Builds a process object in memory without persisting to database.
 * Useful for unit tests that don't need database interaction.
 *
 * @param overrides - Partial Process fields to override defaults
 * @returns Complete Process object
 *
 * @example
 * ```typescript
 * const process = processFactory.build({ name: "Custom Process" });
 * const processWithTenant = processFactory.build({ tenantId: "ten_123" });
 * ```
 */
function build(overrides: ProcessFactoryOptions = {}): Process {
  return {
    id: overrides.id ?? generateProcessId(),
    tenantId: overrides.tenantId ?? generateTenantId(),
    ...defaultProcess(),
    ...overrides,
  };
}

/**
 * Creates a process and persists it to the test database.
 * If tenantId is not provided, also creates a tenant.
 *
 * @param overrides - Partial Process fields to override defaults
 * @returns Promise resolving to the created Process
 *
 * @example
 * ```typescript
 * // Creates process with auto-created tenant
 * const process = await processFactory.create();
 *
 * // Creates process for existing tenant
 * const process = await processFactory.create({ tenantId: tenant.id });
 * ```
 */
async function create(overrides: ProcessFactoryOptions = {}): Promise<Process> {
  // If no tenantId provided, create a tenant first
  let tenantId = overrides.tenantId;
  if (!tenantId) {
    const tenant = await testDb.tenant.create({
      data: {
        id: generateTenantId(),
        name: `Tenant for Process ${counter + 1}`,
      },
    });
    tenantId = tenant.id;
  }

  const builtData = build({ ...overrides, tenantId });
  // Extract JSON fields to ensure proper typing for Prisma
  const { inputSchema, outputSchema, ...rest } = builtData;

  // Respect explicit null values for schemas (allows "no schema" tests)
  const hasExplicitNullInput = "inputSchema" in overrides && overrides.inputSchema === null;
  const hasExplicitNullOutput = "outputSchema" in overrides && overrides.outputSchema === null;

  return testDb.process.create({
    data: {
      ...rest,
      inputSchema: hasExplicitNullInput ? Prisma.JsonNull : (inputSchema ?? defaultInputSchema),
      outputSchema: hasExplicitNullOutput ? Prisma.JsonNull : (outputSchema ?? defaultOutputSchema),
    },
  });
}

/**
 * Creates a process with a specific tenant in a single transaction.
 * Useful when you need both entities and want to ensure they're related.
 *
 * @param processOverrides - Partial Process fields
 * @param tenantOverrides - Partial Tenant fields
 * @returns Promise resolving to { process, tenant }
 *
 * @example
 * ```typescript
 * const { process, tenant } = await processFactory.createWithTenant(
 *   { name: "Product Generator" },
 *   { name: "Acme Corp" }
 * );
 * ```
 */
async function createWithTenant(
  processOverrides: Partial<Omit<Process, "id" | "tenantId">> = {},
  tenantOverrides: Partial<{ name: string }> = {}
): Promise<{
  process: Process;
  tenant: Awaited<ReturnType<typeof testDb.tenant.create>>;
}> {
  const tenantId = generateTenantId();

  const tenant = await testDb.tenant.create({
    data: {
      id: tenantId,
      name: tenantOverrides.name ?? `Tenant ${counter + 1}`,
    },
  });

  const defaults = defaultProcess();
  const process = await testDb.process.create({
    data: {
      id: generateProcessId(),
      tenantId,
      name: processOverrides.name ?? defaults.name,
      description: processOverrides.description ?? defaults.description,
      inputSchema: processOverrides.inputSchema ?? defaults.inputSchema ?? defaultInputSchema,
      outputSchema: processOverrides.outputSchema ?? defaults.outputSchema ?? defaultOutputSchema,
      createdAt: processOverrides.createdAt ?? defaults.createdAt,
      updatedAt: processOverrides.updatedAt ?? defaults.updatedAt,
      deletedAt: processOverrides.deletedAt ?? defaults.deletedAt,
    },
  });

  return { process, tenant };
}

/**
 * Creates multiple processes for the same tenant.
 *
 * @param count - Number of processes to create
 * @param tenantId - Tenant ID (creates new tenant if not provided)
 * @returns Promise resolving to array of created Processes
 */
async function createMany(
  count: number,
  tenantId?: string
): Promise<Process[]> {
  // Create tenant if not provided
  let tid = tenantId;
  if (!tid) {
    const tenant = await testDb.tenant.create({
      data: {
        id: generateTenantId(),
        name: `Tenant for ${count} processes`,
      },
    });
    tid = tenant.id;
  }

  const processes: Process[] = [];
  for (let i = 0; i < count; i++) {
    processes.push(await create({ tenantId: tid }));
  }
  return processes;
}

/**
 * Resets the internal counter (for test isolation).
 */
function resetCounter(): void {
  counter = 0;
}

export const processFactory = {
  build,
  create,
  createWithTenant,
  createMany,
  resetCounter,
  /** Default schemas for reference in tests */
  defaults: {
    inputSchema: defaultInputSchema,
    outputSchema: defaultOutputSchema,
  },
};
