import { apiKeyRouter } from "~/server/api/routers/apiKey";
import { auditLogRouter } from "~/server/api/routers/auditLog";
import { authRouter } from "~/server/api/routers/auth";
import { postRouter } from "~/server/api/routers/post";
import { processRouter } from "~/server/api/routers/process";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  apiKey: apiKeyRouter,
  auditLog: auditLogRouter,
  auth: authRouter,
  post: postRouter,
  process: processRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
