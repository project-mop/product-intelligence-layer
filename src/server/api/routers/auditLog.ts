/**
 * Audit Log tRPC Router
 *
 * Provides query access to audit logs for authenticated users.
 * All queries are scoped to the user's tenant.
 *
 * @see docs/stories/1-5-audit-logging-foundation.md
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * Input schema for listing audit logs with optional filters.
 */
const listInput = z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  action: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export const auditLogRouter = createTRPCRouter({
  /**
   * List audit logs for the current tenant.
   *
   * Supports filtering by date range and action, with cursor-based pagination.
   *
   * AC: 8
   */
  list: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const tenantId = ctx.session.user.tenantId;

    if (!tenantId) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "User has no associated tenant",
      });
    }

    const { dateFrom, dateTo, action, limit, cursor } = input;

    // Build where clause with tenant scope
    const where: {
      tenantId: string;
      createdAt?: { gte?: Date; lte?: Date };
      action?: string;
    } = {
      tenantId,
    };

    // Add date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = dateFrom;
      }
      if (dateTo) {
        where.createdAt.lte = dateTo;
      }
    }

    // Add action filter
    if (action) {
      where.action = action;
    }

    // Fetch audit logs with cursor-based pagination
    const auditLogs = await ctx.db.auditLog.findMany({
      where,
      take: limit + 1, // Fetch one extra to determine if there are more
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        action: true,
        resource: true,
        resourceId: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    });

    // Determine if there are more results
    let nextCursor: string | undefined;
    if (auditLogs.length > limit) {
      const nextItem = auditLogs.pop();
      nextCursor = nextItem?.id;
    }

    return {
      items: auditLogs,
      nextCursor,
    };
  }),
});
