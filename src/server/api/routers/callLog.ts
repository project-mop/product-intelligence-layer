/**
 * Call Log tRPC Router
 *
 * Provides read-only access to call logs for authenticated users.
 * All operations are scoped to the user's tenant.
 *
 * @see docs/stories/6-1-call-logging-infrastructure.md
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const callLogRouter = createTRPCRouter({
  /**
   * List call logs with pagination and filtering.
   *
   * Supports filtering by:
   * - processId: Filter to specific process
   * - startDate/endDate: Filter by date range
   * - statusCode: Filter by HTTP status code
   *
   * Returns cursor-based pagination for efficient traversal.
   */
  list: protectedProcedure
    .input(
      z.object({
        processId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        statusCode: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User must belong to a tenant",
        });
      }

      const logs = await ctx.db.callLog.findMany({
        where: {
          tenantId,
          processId: input.processId,
          createdAt: {
            gte: input.startDate,
            lte: input.endDate,
          },
          statusCode: input.statusCode,
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        select: {
          id: true,
          processId: true,
          processVersionId: true,
          statusCode: true,
          errorCode: true,
          latencyMs: true,
          cached: true,
          modelUsed: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined;
      if (logs.length > input.limit) {
        const nextItem = logs.pop();
        nextCursor = nextItem?.id;
      }

      return { logs, nextCursor };
    }),

  /**
   * Get a single call log with full details.
   *
   * Includes input and output data.
   * Returns 404 if log not found or belongs to another tenant.
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User must belong to a tenant",
        });
      }

      const log = await ctx.db.callLog.findFirst({
        where: {
          id: input.id,
          tenantId,
        },
      });

      if (!log) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Call log not found",
        });
      }

      return log;
    }),

  /**
   * Get call log statistics for a process.
   *
   * Returns aggregated metrics grouped by status code:
   * - Count per status code
   * - Average latency per status code
   */
  stats: protectedProcedure
    .input(
      z.object({
        processId: z.string(),
        days: z.number().min(1).max(90).default(7),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User must belong to a tenant",
        });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const stats = await ctx.db.callLog.groupBy({
        by: ["statusCode"],
        where: {
          tenantId,
          processId: input.processId,
          createdAt: { gte: startDate },
        },
        _count: true,
        _avg: { latencyMs: true },
      });

      // Calculate totals
      const totalCount = stats.reduce((sum, s) => sum + s._count, 0);
      const successCount = stats
        .filter((s) => s.statusCode >= 200 && s.statusCode < 300)
        .reduce((sum, s) => sum + s._count, 0);
      const errorCount = stats
        .filter((s) => s.statusCode >= 400)
        .reduce((sum, s) => sum + s._count, 0);

      return {
        byStatusCode: stats.map((s) => ({
          statusCode: s.statusCode,
          count: s._count,
          avgLatencyMs: Math.round(s._avg.latencyMs ?? 0),
        })),
        totals: {
          total: totalCount,
          success: successCount,
          error: errorCount,
          successRate: totalCount > 0 ? (successCount / totalCount) * 100 : 0,
        },
      };
    }),
});
