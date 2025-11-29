/**
 * Process tRPC Router
 *
 * Handles intelligence definition CRUD operations for authenticated users.
 * All operations are scoped to the user's tenant.
 *
 * @see docs/stories/2-1-intelligence-definition-data-model.md
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import Ajv from "ajv";
import type { Prisma } from "../../../../generated/prisma";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { generateProcessId, generateProcessVersionId, generateRequestId } from "~/lib/id";
import { createAuditLog } from "~/server/services/audit";
import { extractRequestContext } from "~/server/services/audit/context";
import { DEFAULT_PROCESS_CONFIG, type ProcessConfig } from "~/server/services/process/types";
import { ProcessEngine, ProcessEngineError } from "~/server/services/process/engine";
import { AnthropicGateway } from "~/server/services/llm/anthropic";
import { LLMError } from "~/server/services/llm/types";
import { getTestGatewayOverride } from "./process.testing";
import { computeProcessStatus } from "~/lib/process/status";
import { getCacheService } from "~/server/services/cache";
import { logger } from "~/lib/logger";
import { promoteToProduction, getPromotionPreview } from "~/server/services/process/promotion";
import { compareVersions } from "~/server/services/process/version-diff";
import { rollbackToVersion } from "~/server/services/process/rollback";
import { getAvailableVersions } from "~/server/services/process/version-resolver";

// Initialize AJV for JSON Schema Draft 7 validation
const ajv = new Ajv({ strict: false });

/**
 * Validates that a value is a valid JSON Schema Draft 7.
 * Uses AJV to compile the schema (which validates its structure).
 */
function validateJsonSchema(schema: unknown): boolean {
  if (typeof schema !== "object" || schema === null) {
    return false;
  }
  try {
    ajv.compile(schema as object);
    return true;
  } catch {
    return false;
  }
}

/**
 * Custom Zod refinement for JSON Schema validation.
 */
const jsonSchemaValidator = z
  .record(z.unknown())
  .refine(validateJsonSchema, {
    message: "Must be a valid JSON Schema Draft 7",
  });

/**
 * Zod schema for attribute definition.
 */
const attributeSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "array", "object"]),
  description: z.string().optional(),
  required: z.boolean(),
});

/**
 * Maximum nesting depth for components.
 */
const MAX_COMPONENT_DEPTH = 3;

/**
 * Component definition type for Zod schema.
 */
interface ComponentInput {
  name: string;
  type: string;
  attributes?: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "array" | "object";
    description?: string;
    required: boolean;
  }>;
  subcomponents?: ComponentInput[];
}

/**
 * Validate that components don't exceed maximum nesting depth.
 */
function validateComponentDepth(
  components: ComponentInput[],
  currentDepth = 1
): boolean {
  if (currentDepth > MAX_COMPONENT_DEPTH) {
    return false;
  }
  for (const comp of components) {
    if (comp.subcomponents?.length) {
      if (!validateComponentDepth(comp.subcomponents, currentDepth + 1)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Zod schema for component definition (recursive).
 */
const componentSchema: z.ZodType<ComponentInput> = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    attributes: z.array(attributeSchema).optional(),
    subcomponents: z.array(componentSchema).optional(),
  })
);

/**
 * Zod schema for ProcessConfig partial input.
 */
const processConfigInputSchema = z
  .object({
    systemPrompt: z.string().min(1),
    additionalInstructions: z.string().optional(),
    maxTokens: z.number().int().positive().optional(),
    temperature: z.number().min(0).max(2).optional(),
    inputSchemaDescription: z.string().min(1),
    outputSchemaDescription: z.string().min(1),
    goal: z.string().min(1),
    components: z.array(componentSchema).optional(),
    cacheTtlSeconds: z
      .number()
      .int()
      .min(0, "Cache TTL must be at least 0 (disabled)")
      .max(86400, "Cache TTL cannot exceed 24 hours (86400 seconds)")
      .optional(),
    cacheEnabled: z.boolean().optional(),
    requestsPerMinute: z.number().int().positive().optional(),
  })
  .partial()
  .refine(
    (data) => {
      // If any config fields provided, require the mandatory ones
      const hasAnyField = Object.keys(data).length > 0;
      if (!hasAnyField) return true;
      // When config is provided, these are required
      if (data.systemPrompt !== undefined && data.systemPrompt.length === 0)
        return false;
      return true;
    },
    { message: "Invalid config structure" }
  )
  .refine(
    (data) => {
      // Validate component nesting depth (max 3 levels)
      if (data.components?.length) {
        return validateComponentDepth(data.components);
      }
      return true;
    },
    { message: `Components cannot be nested more than ${MAX_COMPONENT_DEPTH} levels deep` }
  );

/**
 * Input schema for creating a new process.
 * AC: 4, 9, 11
 */
const createProcessInput = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  inputSchema: jsonSchemaValidator,
  outputSchema: jsonSchemaValidator,
  config: processConfigInputSchema.optional(),
});

/**
 * Input schema for updating a process.
 * AC: 5, 9, 11
 */
const updateProcessInput = z.object({
  id: z.string().min(1, "Process ID is required"),
  name: z.string().min(1, "Name is required").max(255, "Name too long").optional(),
  description: z.string().max(1000, "Description too long").nullish(),
  inputSchema: jsonSchemaValidator.optional(),
  outputSchema: jsonSchemaValidator.optional(),
});

/**
 * Input schema for getting a process by ID.
 */
const processIdInput = z.object({
  id: z.string().min(1, "Process ID is required"),
});

/**
 * Input schema for listing processes.
 * AC: 2
 */
const listProcessInput = z.object({
  status: z.enum(["SANDBOX", "PRODUCTION"]).optional(),
  search: z.string().optional(),
});

/**
 * Input schema for listing processes with computed status.
 * Story 3.4 AC: 1, 4, 5, 6
 */
const listWithStatsInput = z.object({
  search: z.string().optional(),
  status: z.enum(["DRAFT", "SANDBOX", "PRODUCTION"]).optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).optional().default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * Input schema for duplicating a process.
 * AC: 6
 */
const duplicateProcessInput = z.object({
  id: z.string().min(1, "Process ID is required"),
  newName: z.string().min(1).max(255).optional(),
});

/**
 * Input schema for creating a draft version from a published version.
 * Story 2.4 AC: 4
 */
const createDraftVersionInput = z.object({
  processId: z.string().min(1, "Process ID is required"),
});

export const processRouter = createTRPCRouter({
  /**
   * List all processes for the current tenant.
   *
   * AC: 2, 8 - Returns non-deleted processes with optional filtering.
   */
  list: protectedProcedure
    .input(listProcessInput)
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Build where clause with tenant isolation and soft delete filter
      const where: Prisma.ProcessWhereInput = {
        tenantId,
        deletedAt: null,
      };

      // Add search filter if provided
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
        ];
      }

      // Fetch processes with version data
      const processes = await db.process.findMany({
        where,
        include: {
          versions: {
            select: {
              id: true,
              environment: true,
              version: true,
              publishedAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      // Filter by environment status if requested
      let filtered = processes;
      if (input.status) {
        filtered = processes.filter((p) =>
          p.versions.some((v) => v.environment === input.status)
        );
      }

      // Return with computed fields
      return filtered.map((process) => ({
        id: process.id,
        name: process.name,
        description: process.description,
        inputSchema: process.inputSchema,
        outputSchema: process.outputSchema,
        createdAt: process.createdAt,
        updatedAt: process.updatedAt,
        versionCount: process.versions.length,
        latestVersionStatus: process.versions[0]?.environment ?? null,
        hasProductionVersion: process.versions.some(
          (v) => v.environment === "PRODUCTION"
        ),
      }));
    }),

  /**
   * List all processes with computed status for dashboard display.
   *
   * Story 3.4 AC: 1, 4, 5, 6
   * - Returns processes with computed status (DRAFT/SANDBOX/PRODUCTION)
   * - Supports search by name (case-insensitive)
   * - Supports filter by computed status
   * - Supports sorting by name, createdAt, updatedAt
   */
  listWithStats: protectedProcedure
    .input(listWithStatsInput)
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Build where clause with tenant isolation and soft delete filter
      const where: Prisma.ProcessWhereInput = {
        tenantId,
        deletedAt: null,
      };

      // Add search filter if provided (case-insensitive name search)
      if (input.search) {
        where.name = { contains: input.search, mode: "insensitive" };
      }

      // Build orderBy based on sortBy and sortOrder
      const orderBy: Prisma.ProcessOrderByWithRelationInput = {
        [input.sortBy]: input.sortOrder,
      };

      // Fetch processes with version data for status computation
      const processes = await db.process.findMany({
        where,
        include: {
          versions: {
            select: {
              id: true,
              environment: true,
              deprecatedAt: true,
            },
          },
        },
        orderBy,
      });

      // Map processes and compute status
      const processesWithStatus = processes.map((process) => {
        const status = computeProcessStatus(process.versions);
        // Story 5.1 AC: 8 - Environment indicators visible in process list
        const hasSandbox = process.versions.some(
          (v) => v.environment === "SANDBOX" && v.deprecatedAt === null
        );
        const hasProduction = process.versions.some(
          (v) => v.environment === "PRODUCTION" && v.deprecatedAt === null
        );
        return {
          id: process.id,
          name: process.name,
          description: process.description,
          status,
          hasSandbox,
          hasProduction,
          createdAt: process.createdAt,
          updatedAt: process.updatedAt,
        };
      });

      // Filter by computed status if provided
      if (input.status) {
        return processesWithStatus.filter((p) => p.status === input.status);
      }

      return processesWithStatus;
    }),

  /**
   * Get a single process with all its versions.
   *
   * AC: 3, 8 - Returns process with versions, tenant-scoped.
   */
  get: protectedProcedure
    .input(processIdInput)
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      const process = await db.process.findFirst({
        where: {
          id: input.id,
          tenantId,
          deletedAt: null,
        },
        include: {
          versions: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Process not found",
        });
      }

      return {
        ...process,
        versionCount: process.versions.length,
        hasProductionVersion: process.versions.some(
          (v) => v.environment === "PRODUCTION"
        ),
      };
    }),

  /**
   * Create a new process with initial SANDBOX version.
   *
   * AC: 4, 8, 10, 11 - Creates process + version in transaction.
   */
  create: protectedProcedure
    .input(createProcessInput)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      const processId = generateProcessId();
      const versionId = generateProcessVersionId();

      // Build initial config with defaults
      const initialConfig = {
        systemPrompt: input.config?.systemPrompt ?? "",
        additionalInstructions: input.config?.additionalInstructions,
        maxTokens: input.config?.maxTokens ?? DEFAULT_PROCESS_CONFIG.maxTokens,
        temperature:
          input.config?.temperature ?? DEFAULT_PROCESS_CONFIG.temperature,
        inputSchemaDescription: input.config?.inputSchemaDescription ?? "",
        outputSchemaDescription: input.config?.outputSchemaDescription ?? "",
        goal: input.config?.goal ?? "",
        components: input.config?.components,
        cacheTtlSeconds:
          input.config?.cacheTtlSeconds ??
          DEFAULT_PROCESS_CONFIG.cacheTtlSeconds,
        cacheEnabled:
          input.config?.cacheEnabled ?? DEFAULT_PROCESS_CONFIG.cacheEnabled,
        requestsPerMinute:
          input.config?.requestsPerMinute ??
          DEFAULT_PROCESS_CONFIG.requestsPerMinute,
      };

      // Use transaction for atomicity
      const result = await db.$transaction(async (tx) => {
        const process = await tx.process.create({
          data: {
            id: processId,
            tenantId,
            name: input.name,
            description: input.description,
            inputSchema: input.inputSchema as Prisma.InputJsonValue,
            outputSchema: input.outputSchema as Prisma.InputJsonValue,
          },
        });

        const version = await tx.processVersion.create({
          data: {
            id: versionId,
            processId: process.id,
            version: "1.0.0",
            config: initialConfig as Prisma.InputJsonValue,
            environment: "SANDBOX",
            status: "DRAFT",
          },
        });

        return { process, version };
      });

      // Log audit event (fire-and-forget)
      const requestContext = extractRequestContext(ctx.headers);
      void createAuditLog({
        tenantId,
        userId: ctx.session.user.id,
        action: "process.created",
        resource: "process",
        resourceId: processId,
        metadata: { versionId, name: input.name },
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      });

      return result;
    }),

  /**
   * Update process metadata.
   *
   * AC: 5, 8, 10, 11 - Updates only provided fields.
   */
  update: protectedProcedure
    .input(updateProcessInput)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Verify process exists and belongs to tenant
      const existing = await db.process.findFirst({
        where: {
          id: input.id,
          tenantId,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Process not found",
        });
      }

      // Build update data with only provided fields
      const updateData: Prisma.ProcessUpdateInput = {};

      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.description !== undefined) {
        updateData.description = input.description;
      }
      if (input.inputSchema !== undefined) {
        updateData.inputSchema = input.inputSchema as Prisma.InputJsonValue;
      }
      if (input.outputSchema !== undefined) {
        updateData.outputSchema = input.outputSchema as Prisma.InputJsonValue;
      }

      const process = await db.process.update({
        where: { id: input.id },
        data: updateData,
      });

      // Invalidate cache entries for this process (Story 4.6 AC: 10)
      // Fire-and-forget - cache invalidation failure shouldn't block the update
      const cacheService = getCacheService();
      void cacheService.invalidate(tenantId, input.id).then(() => {
        logger.info("[process.update] Cache invalidated", { processId: input.id });
      }).catch((error) => {
        logger.error("[process.update] Failed to invalidate cache", {
          processId: input.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      // Log audit event (fire-and-forget)
      const requestContext = extractRequestContext(ctx.headers);
      void createAuditLog({
        tenantId,
        userId: ctx.session.user.id,
        action: "process.updated",
        resource: "process",
        resourceId: input.id,
        metadata: { updatedFields: Object.keys(updateData) },
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      });

      return process;
    }),

  /**
   * Duplicate a process with a new name.
   *
   * AC: 6, 8, 10 - Deep copies process and creates new SANDBOX version.
   */
  duplicate: protectedProcedure
    .input(duplicateProcessInput)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Load source process with latest version
      const source = await db.process.findFirst({
        where: {
          id: input.id,
          tenantId,
          deletedAt: null,
        },
        include: {
          versions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!source) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Process not found",
        });
      }

      const newProcessId = generateProcessId();
      const newVersionId = generateProcessVersionId();
      const newName = input.newName ?? `${source.name} (Copy)`;

      // Get config from latest version or use defaults
      const sourceConfig =
        source.versions[0]?.config ?? DEFAULT_PROCESS_CONFIG;

      // Use transaction for atomicity
      const result = await db.$transaction(async (tx) => {
        const process = await tx.process.create({
          data: {
            id: newProcessId,
            tenantId,
            name: newName,
            description: source.description,
            inputSchema: source.inputSchema as Prisma.InputJsonValue,
            outputSchema: source.outputSchema as Prisma.InputJsonValue,
          },
        });

        const version = await tx.processVersion.create({
          data: {
            id: newVersionId,
            processId: process.id,
            version: "1.0.0",
            config: sourceConfig as Prisma.InputJsonValue,
            environment: "SANDBOX",
            status: "DRAFT",
          },
        });

        return { process, version };
      });

      // Log audit event (fire-and-forget)
      const requestContext = extractRequestContext(ctx.headers);
      void createAuditLog({
        tenantId,
        userId: ctx.session.user.id,
        action: "process.duplicated",
        resource: "process",
        resourceId: newProcessId,
        metadata: { sourceProcessId: input.id, newName },
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      });

      return result;
    }),

  /**
   * Soft delete a process.
   *
   * AC: 7, 8, 10 - Sets deletedAt timestamp.
   */
  delete: protectedProcedure
    .input(processIdInput)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Verify process exists and belongs to tenant
      const existing = await db.process.findFirst({
        where: {
          id: input.id,
          tenantId,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Process not found",
        });
      }

      await db.process.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });

      // Invalidate cache entries for this process (Story 4.6 AC: 10)
      // Fire-and-forget - cache invalidation failure shouldn't block the delete
      const cacheService = getCacheService();
      void cacheService.invalidate(tenantId, input.id).then(() => {
        logger.info("[process.delete] Cache invalidated", { processId: input.id });
      }).catch((error) => {
        logger.error("[process.delete] Failed to invalidate cache", {
          processId: input.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      // Log audit event (fire-and-forget)
      const requestContext = extractRequestContext(ctx.headers);
      void createAuditLog({
        tenantId,
        userId: ctx.session.user.id,
        action: "process.deleted",
        resource: "process",
        resourceId: input.id,
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      });

      return { success: true };
    }),

  /**
   * Restore a soft-deleted process.
   *
   * AC: 7 (bonus) - Clears deletedAt timestamp.
   */
  restore: protectedProcedure
    .input(processIdInput)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Find the deleted process belonging to tenant
      const existing = await db.process.findFirst({
        where: {
          id: input.id,
          tenantId,
          deletedAt: { not: null },
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deleted process not found",
        });
      }

      const process = await db.process.update({
        where: { id: input.id },
        data: { deletedAt: null },
      });

      // Log audit event (fire-and-forget)
      const requestContext = extractRequestContext(ctx.headers);
      void createAuditLog({
        tenantId,
        userId: ctx.session.user.id,
        action: "process.restored",
        resource: "process",
        resourceId: input.id,
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      });

      return process;
    }),

  /**
   * Create a new draft version from the latest version of a process.
   * Used when editing a published process - creates a new SANDBOX version.
   *
   * Story 2.4 AC: 4 - Changes to PUBLISHED versions create a new DRAFT version.
   */
  createDraftVersion: protectedProcedure
    .input(createDraftVersionInput)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Load process with all versions
      const process = await db.process.findFirst({
        where: {
          id: input.processId,
          tenantId,
          deletedAt: null,
        },
        include: {
          versions: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Process not found",
        });
      }

      // Check if there's already a SANDBOX version (draft)
      const existingDraft = process.versions.find(
        (v) => v.environment === "SANDBOX"
      );
      if (existingDraft) {
        // Return existing draft instead of creating a new one
        return existingDraft;
      }

      // Get the latest published version to copy config from
      const latestVersion = process.versions[0];
      if (!latestVersion) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Process has no versions",
        });
      }

      // Create new draft version
      const newVersionId = generateProcessVersionId();
      const newVersion = await db.processVersion.create({
        data: {
          id: newVersionId,
          processId: input.processId,
          version: `${latestVersion.version}-draft`,
          config: latestVersion.config as Prisma.InputJsonValue,
          environment: "SANDBOX",
          status: "DRAFT",
        },
      });

      // Log audit event (fire-and-forget)
      const requestContext = extractRequestContext(ctx.headers);
      void createAuditLog({
        tenantId,
        userId: ctx.session.user.id,
        action: "processVersion.draftCreated",
        resource: "processVersion",
        resourceId: newVersionId,
        metadata: {
          processId: input.processId,
          sourceVersionId: latestVersion.id,
        },
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      });

      return newVersion;
    }),

  /**
   * Test generate intelligence using the process configuration.
   *
   * Uses session authentication (no API key required) for dashboard testing.
   * Calls ProcessEngine.generateIntelligence() with the process config.
   *
   * Story 3.3 AC: 4, 9 - Session-based auth, test calls use dashboard context
   *
   * @see docs/stories/3-3-in-browser-endpoint-testing.md
   */
  testGenerate: protectedProcedure
    .input(
      z.object({
        processId: z.string().min(1, "Process ID is required"),
        input: z.record(z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Load process with latest version
      const process = await db.process.findFirst({
        where: {
          id: input.processId,
          tenantId,
          deletedAt: null,
        },
        include: {
          versions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Process not found",
        });
      }

      // Get latest version config
      const latestVersion = process.versions[0];
      if (!latestVersion) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Process has no versions",
        });
      }

      // Build ProcessConfig from stored config
      const storedConfig = latestVersion.config as Record<string, unknown>;
      const processConfig: ProcessConfig = {
        systemPrompt: (storedConfig.systemPrompt as string) ?? "",
        additionalInstructions: storedConfig.additionalInstructions as string | undefined,
        maxTokens: (storedConfig.maxTokens as number) ?? DEFAULT_PROCESS_CONFIG.maxTokens,
        temperature: (storedConfig.temperature as number) ?? DEFAULT_PROCESS_CONFIG.temperature,
        inputSchemaDescription: (storedConfig.inputSchemaDescription as string) ?? "",
        outputSchemaDescription: (storedConfig.outputSchemaDescription as string) ?? "",
        goal: (storedConfig.goal as string) ?? "",
        components: storedConfig.components as ProcessConfig["components"],
        cacheTtlSeconds: (storedConfig.cacheTtlSeconds as number) ?? DEFAULT_PROCESS_CONFIG.cacheTtlSeconds,
        cacheEnabled: (storedConfig.cacheEnabled as boolean) ?? DEFAULT_PROCESS_CONFIG.cacheEnabled,
        requestsPerMinute: (storedConfig.requestsPerMinute as number) ?? DEFAULT_PROCESS_CONFIG.requestsPerMinute,
      };

      const requestId = generateRequestId();
      const startTime = Date.now();

      try {
        // Initialize LLM gateway and ProcessEngine
        // Use test override if set, otherwise create real gateway
        const llmGateway = getTestGatewayOverride() ?? new AnthropicGateway();
        const processEngine = new ProcessEngine(llmGateway);

        // Call ProcessEngine.generateIntelligence()
        const result = await processEngine.generateIntelligence(
          processConfig,
          input.input as Record<string, unknown>
        );

        const latencyMs = Date.now() - startTime;

        // Log audit event (fire-and-forget)
        const requestContext = extractRequestContext(ctx.headers);
        void createAuditLog({
          tenantId,
          userId: ctx.session.user.id,
          action: "process.testGenerate",
          resource: "process",
          resourceId: input.processId,
          metadata: {
            requestId,
            latencyMs,
            model: result.meta.model,
            retried: result.meta.retried,
          },
          ipAddress: requestContext.ipAddress,
          userAgent: requestContext.userAgent,
        });

        return {
          success: true as const,
          data: result.data,
          meta: {
            latency_ms: latencyMs,
            request_id: requestId,
            model: result.meta.model,
            usage: result.meta.usage,
          },
        };
      } catch (error) {
        // Log error audit event
        const requestContext = extractRequestContext(ctx.headers);
        void createAuditLog({
          tenantId,
          userId: ctx.session.user.id,
          action: "process.testGenerate.error",
          resource: "process",
          resourceId: input.processId,
          metadata: {
            requestId,
            error: error instanceof Error ? error.message : "Unknown error",
            errorCode: error instanceof LLMError ? error.code :
                       error instanceof ProcessEngineError ? error.code : "UNKNOWN",
          },
          ipAddress: requestContext.ipAddress,
          userAgent: requestContext.userAgent,
        });

        // Map errors to appropriate tRPC error codes
        if (error instanceof LLMError) {
          switch (error.code) {
            case "LLM_TIMEOUT":
              throw new TRPCError({
                code: "TIMEOUT",
                message: "Request timed out waiting for LLM response",
                cause: error,
              });
            case "LLM_RATE_LIMITED":
              throw new TRPCError({
                code: "TOO_MANY_REQUESTS",
                message: "LLM rate limit exceeded. Please try again later.",
                cause: error,
              });
            default:
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `LLM error: ${error.message}`,
                cause: error,
              });
          }
        }

        if (error instanceof ProcessEngineError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Processing error: ${error.message}`,
            cause: error,
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    }),

  /**
   * Update version config (cache settings, etc.).
   *
   * Story 4.6 AC: 1, 5 - Update cacheTtlSeconds and cacheEnabled in version config.
   * TTL range is validated: 0 (disabled) to 86400 (24 hours).
   */
  updateVersionConfig: protectedProcedure
    .input(
      z.object({
        processId: z.string().min(1, "Process ID is required"),
        config: z.object({
          cacheTtlSeconds: z
            .number()
            .int()
            .min(0, "Cache TTL must be at least 0 (disabled)")
            .max(86400, "Cache TTL cannot exceed 24 hours (86400 seconds)")
            .optional(),
          cacheEnabled: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Load process with latest version
      const process = await db.process.findFirst({
        where: {
          id: input.processId,
          tenantId,
          deletedAt: null,
        },
        include: {
          versions: {
            where: { environment: "SANDBOX" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Process not found",
        });
      }

      // Get the SANDBOX version to update
      const version = process.versions[0];
      if (!version) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Process has no sandbox version to update",
        });
      }

      // Merge config updates with existing config
      const existingConfig = version.config as Record<string, unknown>;
      const updatedConfig = {
        ...existingConfig,
        ...(input.config.cacheTtlSeconds !== undefined && {
          cacheTtlSeconds: input.config.cacheTtlSeconds,
        }),
        ...(input.config.cacheEnabled !== undefined && {
          cacheEnabled: input.config.cacheEnabled,
        }),
      };

      // Update the version config
      const updatedVersion = await db.processVersion.update({
        where: { id: version.id },
        data: {
          config: updatedConfig as Prisma.InputJsonValue,
        },
      });

      // Log audit event (fire-and-forget)
      const requestContext = extractRequestContext(ctx.headers);
      void createAuditLog({
        tenantId,
        userId: ctx.session.user.id,
        action: "processVersion.configUpdated",
        resource: "processVersion",
        resourceId: version.id,
        metadata: {
          processId: input.processId,
          updatedFields: Object.keys(input.config),
        },
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      });

      return updatedVersion;
    }),

  /**
   * List all versions for a process with environment information.
   *
   * Story 5.1 AC: 5 - Process detail page shows both sandbox and production version status.
   */
  listVersions: protectedProcedure
    .input(processIdInput)
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Verify process exists and belongs to tenant
      const process = await db.process.findFirst({
        where: {
          id: input.id,
          tenantId,
          deletedAt: null,
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Process not found",
        });
      }

      // Get all versions for this process
      const versions = await db.processVersion.findMany({
        where: { processId: input.id },
        orderBy: { createdAt: "desc" },
      });

      // Find active version for each environment
      const sandboxVersion = versions.find(
        (v) =>
          v.environment === "SANDBOX" &&
          v.deprecatedAt === null &&
          (v.status === "ACTIVE" || v.status === "DRAFT")
      );

      const productionVersion = versions.find(
        (v) =>
          v.environment === "PRODUCTION" &&
          v.deprecatedAt === null &&
          v.status === "ACTIVE"
      );

      return {
        versions: versions.map((v) => ({
          id: v.id,
          version: v.version,
          environment: v.environment,
          status: v.status,
          publishedAt: v.publishedAt,
          deprecatedAt: v.deprecatedAt,
          changeNotes: v.changeNotes,
          createdAt: v.createdAt,
          isCurrent:
            (v.environment === "SANDBOX" && v.id === sandboxVersion?.id) ||
            (v.environment === "PRODUCTION" && v.id === productionVersion?.id),
        })),
        sandbox: sandboxVersion
          ? {
              id: sandboxVersion.id,
              version: sandboxVersion.version,
              status: sandboxVersion.status,
              publishedAt: sandboxVersion.publishedAt,
            }
          : null,
        production: productionVersion
          ? {
              id: productionVersion.id,
              version: productionVersion.version,
              status: productionVersion.status,
              publishedAt: productionVersion.publishedAt,
            }
          : null,
      };
    }),

  /**
   * Get the active version for a specific environment.
   *
   * Story 5.1 AC: 5, 6 - Get active version per environment.
   */
  getActiveVersion: protectedProcedure
    .input(
      z.object({
        processId: z.string().min(1, "Process ID is required"),
        environment: z.enum(["SANDBOX", "PRODUCTION"]),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Verify process exists and belongs to tenant
      const process = await db.process.findFirst({
        where: {
          id: input.processId,
          tenantId,
          deletedAt: null,
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Process not found",
        });
      }

      // Find active version for the requested environment
      const versions = await db.processVersion.findMany({
        where: {
          processId: input.processId,
          environment: input.environment,
          deprecatedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });

      // For SANDBOX, accept ACTIVE or DRAFT status
      // For PRODUCTION, only accept ACTIVE status
      const activeVersion =
        input.environment === "SANDBOX"
          ? versions.find((v) => v.status === "ACTIVE" || v.status === "DRAFT")
          : versions.find((v) => v.status === "ACTIVE");

      if (!activeVersion) {
        return null;
      }

      return {
        id: activeVersion.id,
        version: activeVersion.version,
        environment: activeVersion.environment,
        status: activeVersion.status,
        config: activeVersion.config,
        publishedAt: activeVersion.publishedAt,
        createdAt: activeVersion.createdAt,
      };
    }),

  /**
   * Get promotion preview for confirmation dialog.
   *
   * Story 5.3 AC: 2, 3, 4 - Shows change summary, diff from current production, cache warning.
   *
   * @returns sourceVersion, currentProductionVersion, diff, cacheEntryCount
   */
  getPromotionPreview: protectedProcedure
    .input(
      z.object({
        processId: z.string().min(1, "Process ID is required"),
        versionId: z.string().min(1, "Version ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Get promotion preview from service
      const preview = await getPromotionPreview(
        input.processId,
        input.versionId,
        { tenantId }
      );

      // Calculate diff between versions
      const diff = compareVersions(
        preview.sourceVersion,
        preview.currentProductionVersion
      );

      return {
        sourceVersion: {
          id: preview.sourceVersion.id,
          version: preview.sourceVersion.version,
          environment: preview.sourceVersion.environment,
          status: preview.sourceVersion.status,
          config: preview.sourceVersion.config,
          createdAt: preview.sourceVersion.createdAt,
        },
        currentProductionVersion: preview.currentProductionVersion
          ? {
              id: preview.currentProductionVersion.id,
              version: preview.currentProductionVersion.version,
              environment: preview.currentProductionVersion.environment,
              status: preview.currentProductionVersion.status,
              config: preview.currentProductionVersion.config,
              publishedAt: preview.currentProductionVersion.publishedAt,
              createdAt: preview.currentProductionVersion.createdAt,
            }
          : null,
        diff,
        cacheEntryCount: preview.cacheEntryCount,
      };
    }),

  /**
   * Promote a sandbox version to production.
   *
   * Story 5.3 AC: 5, 6, 7, 8, 9 - Creates new PRODUCTION version, deprecates old,
   * atomic transaction, cache invalidation, audit log.
   *
   * @returns PromoteToProductionResult with promotedVersion, deprecatedVersion, cacheInvalidated
   */
  promoteToProduction: protectedProcedure
    .input(
      z.object({
        processId: z.string().min(1, "Process ID is required"),
        versionId: z.string().min(1, "Version ID is required"),
        changeNotes: z.string().max(1000, "Change notes too long").optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Execute promotion via service (handles validation, transaction, audit)
      const result = await promoteToProduction(
        {
          processId: input.processId,
          versionId: input.versionId,
          changeNotes: input.changeNotes,
        },
        {
          tenantId,
          userId: ctx.session.user.id,
        }
      );

      return {
        promotedVersion: {
          id: result.promotedVersion.id,
          version: result.promotedVersion.version,
          environment: result.promotedVersion.environment,
          status: result.promotedVersion.status,
          publishedAt: result.promotedVersion.publishedAt,
          changeNotes: result.promotedVersion.changeNotes,
          createdAt: result.promotedVersion.createdAt,
        },
        deprecatedVersion: result.deprecatedVersion
          ? {
              id: result.deprecatedVersion.id,
              version: result.deprecatedVersion.version,
              status: result.deprecatedVersion.status,
              deprecatedAt: result.deprecatedVersion.deprecatedAt,
            }
          : null,
        cacheInvalidated: result.cacheInvalidated,
      };
    }),

  /**
   * Get version history for a process.
   *
   * Story 5.4 AC: 1, 2, 3 - Returns version history with computed fields.
   * Ordered by version number descending (newest first).
   *
   * @returns Array of VersionHistoryEntry with computed fields (isCurrent, canPromote, canRollback)
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        processId: z.string().min(1, "Process ID is required"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Verify process exists and belongs to tenant
      const process = await db.process.findFirst({
        where: {
          id: input.processId,
          tenantId,
          deletedAt: null,
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Process not found",
        });
      }

      // Get all versions for this process, ordered by version number descending
      const versions = await db.processVersion.findMany({
        where: { processId: input.processId },
        orderBy: { createdAt: "desc" },
        skip: input.offset,
        take: input.limit,
      });

      // Find currently active versions for each environment
      const activeSandbox = versions.find(
        (v) =>
          v.environment === "SANDBOX" &&
          v.status === "ACTIVE" &&
          v.deprecatedAt === null
      );
      const activeProduction = versions.find(
        (v) =>
          v.environment === "PRODUCTION" &&
          v.status === "ACTIVE" &&
          v.deprecatedAt === null
      );

      // Get total count for pagination
      const totalCount = await db.processVersion.count({
        where: { processId: input.processId },
      });

      // Map versions with computed fields
      return {
        versions: versions.map((v) => {
          // isCurrent: true if this is the active version for its environment
          const isCurrent =
            (v.environment === "SANDBOX" && v.id === activeSandbox?.id) ||
            (v.environment === "PRODUCTION" && v.id === activeProduction?.id);

          // canPromote: true if SANDBOX, ACTIVE, and not deprecated
          const canPromote =
            v.environment === "SANDBOX" &&
            v.status === "ACTIVE" &&
            v.deprecatedAt === null;

          // canRollback: true if not the current active sandbox version
          const canRollback = v.id !== activeSandbox?.id;

          return {
            id: v.id,
            version: v.version,
            environment: v.environment,
            status: v.status,
            createdAt: v.createdAt,
            publishedAt: v.publishedAt,
            deprecatedAt: v.deprecatedAt,
            changeNotes: v.changeNotes,
            promotedBy: v.promotedBy,
            isCurrent,
            canPromote,
            canRollback,
          };
        }),
        totalCount,
        hasMore: input.offset + versions.length < totalCount,
      };
    }),

  /**
   * Get single version details with full config.
   *
   * Story 5.4 AC: 4 - Returns full ProcessVersion with config and schemas.
   */
  getVersionDetails: protectedProcedure
    .input(
      z.object({
        processId: z.string().min(1, "Process ID is required"),
        versionId: z.string().min(1, "Version ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Get version with tenant validation via process
      const version = await db.processVersion.findFirst({
        where: {
          id: input.versionId,
          processId: input.processId,
          process: { tenantId, deletedAt: null },
        },
        include: {
          process: {
            select: {
              id: true,
              name: true,
              inputSchema: true,
              outputSchema: true,
            },
          },
        },
      });

      if (!version) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found",
        });
      }

      return {
        id: version.id,
        version: version.version,
        environment: version.environment,
        status: version.status,
        config: version.config,
        createdAt: version.createdAt,
        publishedAt: version.publishedAt,
        deprecatedAt: version.deprecatedAt,
        changeNotes: version.changeNotes,
        promotedBy: version.promotedBy,
        process: {
          id: version.process.id,
          name: version.process.name,
          inputSchema: version.process.inputSchema,
          outputSchema: version.process.outputSchema,
        },
      };
    }),

  /**
   * Compare two versions and return diff.
   *
   * Story 5.4 AC: 5 - Allows selecting two versions for side-by-side diff.
   */
  diff: protectedProcedure
    .input(
      z.object({
        processId: z.string().min(1, "Process ID is required"),
        version1Id: z.string().min(1, "Version 1 ID is required"),
        version2Id: z.string().min(1, "Version 2 ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Verify process exists and belongs to tenant
      const process = await db.process.findFirst({
        where: {
          id: input.processId,
          tenantId,
          deletedAt: null,
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Process not found",
        });
      }

      // Load both versions
      const [version1, version2] = await Promise.all([
        db.processVersion.findFirst({
          where: {
            id: input.version1Id,
            processId: input.processId,
          },
        }),
        db.processVersion.findFirst({
          where: {
            id: input.version2Id,
            processId: input.processId,
          },
        }),
      ]);

      if (!version1) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version 1 not found",
        });
      }

      if (!version2) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version 2 not found",
        });
      }

      // Compare versions using existing diff service
      const diff = compareVersions(version1, version2);

      return {
        version1: {
          id: version1.id,
          version: version1.version,
          environment: version1.environment,
          createdAt: version1.createdAt,
        },
        version2: {
          id: version2.id,
          version: version2.version,
          environment: version2.environment,
          createdAt: version2.createdAt,
        },
        ...diff,
      };
    }),

  /**
   * Rollback to a previous version.
   *
   * Story 5.4 AC: 7, 8, 9, 10 - Creates new sandbox version from target version.
   * Version numbers auto-increment and are never reused.
   */
  rollback: protectedProcedure
    .input(
      z.object({
        processId: z.string().min(1, "Process ID is required"),
        targetVersionId: z.string().min(1, "Target version ID is required"),
        changeNotes: z.string().max(1000, "Change notes too long").optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Execute rollback via service (handles validation, transaction, audit)
      const result = await rollbackToVersion(
        {
          processId: input.processId,
          targetVersionId: input.targetVersionId,
          changeNotes: input.changeNotes,
        },
        {
          tenantId,
          userId: ctx.session.user.id,
        }
      );

      return {
        newVersion: {
          id: result.newVersion.id,
          version: result.newVersion.version,
          environment: result.newVersion.environment,
          status: result.newVersion.status,
          publishedAt: result.newVersion.publishedAt,
          changeNotes: result.newVersion.changeNotes,
          createdAt: result.newVersion.createdAt,
        },
        sourceVersion: {
          id: result.sourceVersion.id,
          version: result.sourceVersion.version,
        },
        deprecatedVersion: result.deprecatedVersion
          ? {
              id: result.deprecatedVersion.id,
              version: result.deprecatedVersion.version,
              status: result.deprecatedVersion.status,
              deprecatedAt: result.deprecatedVersion.deprecatedAt,
            }
          : null,
      };
    }),

  /**
   * Get available versions for a process.
   *
   * Story 5.5 AC: 7 - Returns available versions for error responses.
   * Useful for API consumers to see what versions are available.
   *
   * @returns { sandbox: number[], production: number[] }
   */
  getAvailableVersions: protectedProcedure
    .input(
      z.object({
        processId: z.string().min(1, "Process ID is required"),
        environment: z.enum(["SANDBOX", "PRODUCTION"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      // Verify process exists and belongs to tenant
      const process = await db.process.findFirst({
        where: {
          id: input.processId,
          tenantId,
          deletedAt: null,
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Process not found",
        });
      }

      // Get available versions using version resolver service
      const available = await getAvailableVersions(
        input.processId,
        tenantId,
        input.environment
      );

      // If environment filter is specified, return just that environment's versions
      if (input.environment) {
        const versions = input.environment === "SANDBOX"
          ? available.sandbox
          : available.production;
        return {
          versions,
          environment: input.environment,
        };
      }

      // Return all versions by environment
      return {
        sandbox: available.sandbox,
        production: available.production,
      };
    }),
});
