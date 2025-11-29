/**
 * API Key tRPC Router
 *
 * Handles API key CRUD operations for authenticated users.
 * All operations are scoped to the user's tenant.
 *
 * @see docs/tech-spec-epic-1.md#API-Key-Service-Interface
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  createApiKey,
  rotateApiKey,
  revokeApiKey,
  listApiKeys,
  updateApiKeyName,
} from "~/server/services/auth/api-key";
import { createAuditLog } from "~/server/services/audit";
import { extractRequestContext } from "~/server/services/audit/context";

/**
 * Input schema for creating a new API key.
 */
const createKeyInput = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  environment: z.enum(["SANDBOX", "PRODUCTION"]),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.date().optional(),
});

/**
 * Input schema for key operations by ID.
 */
const keyIdInput = z.object({
  id: z.string().min(1, "Key ID is required"),
});

/**
 * Input schema for updating a key's name.
 */
const updateKeyInput = z.object({
  id: z.string().min(1, "Key ID is required"),
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
});

export const apiKeyRouter = createTRPCRouter({
  /**
   * List all API keys for the current tenant.
   *
   * Returns keys without plaintext (hash is stored, not retrievable).
   *
   * AC: 4
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.session.user.tenantId;

    if (!tenantId) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "User has no associated tenant",
      });
    }

    const keys = await listApiKeys(tenantId);

    // Return keys with relevant fields (keyHash excluded from response)
    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      environment: key.environment,
      scopes: key.scopes as string[],
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      revokedAt: key.revokedAt,
      lastUsedAt: key.lastUsedAt,
    }));
  }),

  /**
   * List API keys grouped by environment.
   *
   * Returns non-revoked keys organized into sandbox and production groups.
   * Used by the API keys page to display keys in separate sections.
   *
   * Story 5.2: AC 2, 8
   */
  listByEnvironment: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.session.user.tenantId;

    if (!tenantId) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "User has no associated tenant",
      });
    }

    const keys = await listApiKeys(tenantId);

    // Filter to non-revoked keys only and group by environment
    const activeKeys = keys.filter((key) => !key.revokedAt);

    const sandbox = activeKeys
      .filter((key) => key.environment === "SANDBOX")
      .map((key) => ({
        id: key.id,
        name: key.name,
        environment: key.environment,
        scopes: key.scopes as string[],
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
        revokedAt: key.revokedAt,
        lastUsedAt: key.lastUsedAt,
      }));

    const production = activeKeys
      .filter((key) => key.environment === "PRODUCTION")
      .map((key) => ({
        id: key.id,
        name: key.name,
        environment: key.environment,
        scopes: key.scopes as string[],
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
        revokedAt: key.revokedAt,
        lastUsedAt: key.lastUsedAt,
      }));

    return { sandbox, production };
  }),

  /**
   * Create a new API key.
   *
   * Returns the ApiKey record AND the plaintext key (shown only once).
   *
   * AC: 1, 2, 3, 7
   */
  create: protectedProcedure
    .input(createKeyInput)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      const result = await createApiKey({
        tenantId,
        name: input.name,
        environment: input.environment,
        scopes: input.scopes,
        expiresAt: input.expiresAt,
      });

      // Extract request context for audit logging
      const requestContext = extractRequestContext(ctx.headers);

      // Log apiKey.created audit event (fire-and-forget)
      void createAuditLog({
        tenantId,
        userId: ctx.session.user.id,
        action: "apiKey.created",
        resource: "apiKey",
        resourceId: result.apiKey.id,
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      });

      return {
        apiKey: {
          id: result.apiKey.id,
          name: result.apiKey.name,
          environment: result.apiKey.environment,
          scopes: result.apiKey.scopes as string[],
          expiresAt: result.apiKey.expiresAt,
          createdAt: result.apiKey.createdAt,
          revokedAt: result.apiKey.revokedAt,
          lastUsedAt: result.apiKey.lastUsedAt,
        },
        // IMPORTANT: This is the only time the plaintext key is available
        plainTextKey: result.plainTextKey,
      };
    }),

  /**
   * Rotate an API key.
   *
   * Revokes the old key and creates a new one with the same configuration.
   * Returns the new key's plaintext (shown only once).
   *
   * AC: 5
   */
  rotate: protectedProcedure
    .input(keyIdInput)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      try {
        const oldKeyId = input.id;
        const result = await rotateApiKey({
          keyId: oldKeyId,
          tenantId,
        });

        // Extract request context for audit logging
        const requestContext = extractRequestContext(ctx.headers);

        // Log apiKey.rotated audit event with old key ID in metadata (fire-and-forget)
        void createAuditLog({
          tenantId,
          userId: ctx.session.user.id,
          action: "apiKey.rotated",
          resource: "apiKey",
          resourceId: result.apiKey.id,
          metadata: { oldKeyId },
          ipAddress: requestContext.ipAddress,
          userAgent: requestContext.userAgent,
        });

        return {
          apiKey: {
            id: result.apiKey.id,
            name: result.apiKey.name,
            environment: result.apiKey.environment,
            scopes: result.apiKey.scopes as string[],
            expiresAt: result.apiKey.expiresAt,
            createdAt: result.apiKey.createdAt,
            revokedAt: result.apiKey.revokedAt,
            lastUsedAt: result.apiKey.lastUsedAt,
          },
          // IMPORTANT: This is the only time the new plaintext key is available
          plainTextKey: result.plainTextKey,
        };
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            error instanceof Error
              ? error.message
              : "Failed to rotate API key",
        });
      }
    }),

  /**
   * Revoke an API key.
   *
   * The key becomes immediately invalid and will return 401.
   *
   * AC: 6
   */
  revoke: protectedProcedure
    .input(keyIdInput)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      try {
        await revokeApiKey({
          keyId: input.id,
          tenantId,
        });

        // Extract request context for audit logging
        const requestContext = extractRequestContext(ctx.headers);

        // Log apiKey.revoked audit event (fire-and-forget)
        void createAuditLog({
          tenantId,
          userId: ctx.session.user.id,
          action: "apiKey.revoked",
          resource: "apiKey",
          resourceId: input.id,
          ipAddress: requestContext.ipAddress,
          userAgent: requestContext.userAgent,
        });

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            error instanceof Error
              ? error.message
              : "Failed to revoke API key",
        });
      }
    }),

  /**
   * Update an API key's name.
   *
   * Scopes are not updatable in this story (future epic).
   *
   * AC: N/A (management feature)
   */
  update: protectedProcedure
    .input(updateKeyInput)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User has no associated tenant",
        });
      }

      try {
        const apiKey = await updateApiKeyName(input.id, tenantId, input.name);

        return {
          apiKey: {
            id: apiKey.id,
            name: apiKey.name,
            environment: apiKey.environment,
            scopes: apiKey.scopes as string[],
            expiresAt: apiKey.expiresAt,
            createdAt: apiKey.createdAt,
            revokedAt: apiKey.revokedAt,
            lastUsedAt: apiKey.lastUsedAt,
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update API key",
        });
      }
    }),
});
