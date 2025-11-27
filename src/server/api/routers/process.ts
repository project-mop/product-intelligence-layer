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
    cacheTtlSeconds: z.number().int().nonnegative().optional(),
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
});
