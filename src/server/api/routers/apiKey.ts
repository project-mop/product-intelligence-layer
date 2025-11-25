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
        const result = await rotateApiKey({
          keyId: input.id,
          tenantId,
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
