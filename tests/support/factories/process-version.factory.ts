/**
 * ProcessVersion Test Factory
 *
 * Generates test data for ProcessVersion entities.
 * Provides both in-memory (build) and persisted (create) methods.
 *
 * @module tests/support/factories/process-version.factory
 */

import type { ProcessVersion, Environment, Process } from "../../../generated/prisma";
import { generateProcessVersionId, generateProcessId, generateTenantId } from "~/lib/id";
import { testDb } from "../db";

let counter = 0;

/**
 * Default process config for testing.
 */
const defaultConfig = {
  goal: "Test goal for process",
  systemPrompt: "You are a test assistant.",
  maxTokens: 512,
  temperature: 0.7,
  cacheTtlSeconds: 300,
  cacheEnabled: true,
  requestsPerMinute: 60,
};

/**
 * Default process version data for testing.
 */
const defaultProcessVersion = (): Omit<ProcessVersion, "id" | "processId"> => ({
  version: `1.0.${++counter}`,
  config: defaultConfig,
  environment: "SANDBOX" as Environment,
  publishedAt: null,
  deprecatedAt: null,
  createdAt: new Date(),
});

/** Options for building/creating a process version */
interface ProcessVersionFactoryOptions extends Partial<ProcessVersion> {
  /** If provided, uses this processId. If not, generates a new one. */
  processId?: string;
}

/**
 * Builds a process version object in memory without persisting to database.
 * Useful for unit tests that don't need database interaction.
 *
 * @param overrides - Partial ProcessVersion fields to override defaults
 * @returns Complete ProcessVersion object
 *
 * @example
 * ```typescript
 * const version = processVersionFactory.build({ version: "2.0.0" });
 * const versionWithProcess = processVersionFactory.build({ processId: "proc_123" });
 * ```
 */
function build(overrides: ProcessVersionFactoryOptions = {}): ProcessVersion {
  return {
    id: overrides.id ?? generateProcessVersionId(),
    processId: overrides.processId ?? generateProcessId(),
    ...defaultProcessVersion(),
    ...overrides,
  };
}

/**
 * Creates a process version and persists it to the test database.
 * If processId is not provided, also creates a process (and tenant).
 *
 * @param overrides - Partial ProcessVersion fields to override defaults
 * @returns Promise resolving to the created ProcessVersion
 *
 * @example
 * ```typescript
 * // Creates version with auto-created process and tenant
 * const version = await processVersionFactory.create();
 *
 * // Creates version for existing process
 * const version = await processVersionFactory.create({ processId: process.id });
 * ```
 */
async function create(
  overrides: ProcessVersionFactoryOptions = {}
): Promise<ProcessVersion> {
  // If no processId provided, create a process (and tenant) first
  let processId = overrides.processId;
  if (!processId) {
    const tenantId = generateTenantId();
    await testDb.tenant.create({
      data: {
        id: tenantId,
        name: `Tenant for ProcessVersion ${counter + 1}`,
      },
    });

    const process = await testDb.process.create({
      data: {
        id: generateProcessId(),
        tenantId,
        name: `Process for Version ${counter + 1}`,
        description: "Auto-created process for version test",
        inputSchema: { type: "object", properties: {} },
        outputSchema: { type: "object", properties: {} },
      },
    });
    processId = process.id;
  }

  const builtData = build({ ...overrides, processId });
  const { config, ...rest } = builtData;
  return testDb.processVersion.create({
    data: {
      ...rest,
      config: config ?? defaultConfig,
    },
  });
}

/**
 * Creates a process version with a specific process in a single transaction.
 * Also creates the tenant if not provided.
 *
 * @param versionOverrides - Partial ProcessVersion fields
 * @param processOverrides - Partial Process fields
 * @param tenantId - Optional tenant ID (creates new if not provided)
 * @returns Promise resolving to { processVersion, process, tenant }
 */
async function createWithProcess(
  versionOverrides: Partial<Omit<ProcessVersion, "id" | "processId">> = {},
  processOverrides: Partial<Omit<Process, "id" | "tenantId">> = {},
  tenantId?: string
): Promise<{
  processVersion: ProcessVersion;
  process: Process;
  tenant: Awaited<ReturnType<typeof testDb.tenant.create>>;
}> {
  const tid = tenantId ?? generateTenantId();

  // Create tenant if new
  let tenant: Awaited<ReturnType<typeof testDb.tenant.create>>;
  if (tenantId) {
    const existing = await testDb.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) {
      throw new Error(`Tenant with id ${tenantId} not found`);
    }
    tenant = existing;
  } else {
    tenant = await testDb.tenant.create({
      data: {
        id: tid,
        name: `Tenant ${counter + 1}`,
      },
    });
  }

  const processId = generateProcessId();
  const process = await testDb.process.create({
    data: {
      id: processId,
      tenantId: tid,
      name: processOverrides.name ?? `Process ${counter + 1}`,
      description: processOverrides.description ?? "Test process",
      inputSchema: processOverrides.inputSchema ?? { type: "object", properties: {} },
      outputSchema: processOverrides.outputSchema ?? { type: "object", properties: {} },
    },
  });

  const defaults = defaultProcessVersion();
  const processVersion = await testDb.processVersion.create({
    data: {
      id: generateProcessVersionId(),
      processId,
      version: versionOverrides.version ?? defaults.version,
      config: versionOverrides.config ?? defaults.config ?? defaultConfig,
      environment: versionOverrides.environment ?? defaults.environment,
      publishedAt: versionOverrides.publishedAt ?? defaults.publishedAt,
      deprecatedAt: versionOverrides.deprecatedAt ?? defaults.deprecatedAt,
      createdAt: versionOverrides.createdAt ?? defaults.createdAt,
    },
  });

  return { processVersion, process, tenant };
}

/**
 * Creates multiple process versions for the same process.
 *
 * @param count - Number of versions to create
 * @param processId - Process ID (creates new process if not provided)
 * @returns Promise resolving to array of created ProcessVersions
 */
async function createMany(
  count: number,
  processId?: string
): Promise<ProcessVersion[]> {
  // Create process if not provided
  let pid = processId;
  if (!pid) {
    const tenantId = generateTenantId();
    await testDb.tenant.create({
      data: {
        id: tenantId,
        name: `Tenant for ${count} versions`,
      },
    });

    const process = await testDb.process.create({
      data: {
        id: generateProcessId(),
        tenantId,
        name: `Process for ${count} versions`,
        description: "Auto-created process",
        inputSchema: { type: "object", properties: {} },
        outputSchema: { type: "object", properties: {} },
      },
    });
    pid = process.id;
  }

  const versions: ProcessVersion[] = [];
  for (let i = 0; i < count; i++) {
    versions.push(
      await create({
        processId: pid,
        version: `1.${i}.0`,
      })
    );
  }
  return versions;
}

/**
 * Creates a production-ready process version (published, PRODUCTION environment).
 */
async function createProduction(
  overrides: ProcessVersionFactoryOptions = {}
): Promise<ProcessVersion> {
  return create({
    environment: "PRODUCTION" as Environment,
    publishedAt: new Date(),
    ...overrides,
  });
}

/**
 * Creates a deprecated process version.
 */
async function createDeprecated(
  overrides: ProcessVersionFactoryOptions = {}
): Promise<ProcessVersion> {
  return create({
    deprecatedAt: new Date(),
    ...overrides,
  });
}

/**
 * Resets the internal counter (for test isolation).
 */
function resetCounter(): void {
  counter = 0;
}

export const processVersionFactory = {
  build,
  create,
  createWithProcess,
  createMany,
  createProduction,
  createDeprecated,
  resetCounter,
  /** Default config for reference in tests */
  defaults: {
    config: defaultConfig,
  },
};
