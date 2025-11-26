/**
 * tRPC Test Caller Utilities
 *
 * Provides helper functions to create authenticated and unauthenticated
 * tRPC callers for integration testing of tRPC routers.
 *
 * @module tests/support/trpc
 */

import { createCaller, type AppRouter } from "~/server/api/root";
import { testDb } from "./db";

/** Session user type matching NextAuth session structure */
interface SessionUser {
  id: string;
  tenantId: string;
  email?: string;
  name?: string | null;
  image?: string | null;
}

/** Session type matching NextAuth session structure */
interface MockSession {
  user: SessionUser;
  expires: string;
}

/** Options for creating an authenticated caller */
interface AuthenticatedCallerOptions {
  userId: string;
  tenantId: string;
  email?: string;
  name?: string | null;
}

/**
 * Creates an authenticated tRPC caller for testing protected procedures.
 *
 * The caller has a mocked session with the provided user and tenant IDs,
 * allowing it to pass authentication middleware.
 *
 * @param options - User and tenant information for the mock session
 * @returns Typed tRPC caller with access to all routers
 *
 * @example
 * ```typescript
 * const caller = createAuthenticatedCaller({
 *   userId: "usr_test123",
 *   tenantId: "ten_test456",
 * });
 *
 * const result = await caller.apiKey.list();
 * ```
 */
export function createAuthenticatedCaller(
  options: AuthenticatedCallerOptions
): ReturnType<typeof createCaller> {
  const { userId, tenantId, email, name } = options;

  const mockSession: MockSession = {
    user: {
      id: userId,
      tenantId: tenantId,
      email: email ?? `${userId}@test.example.com`,
      name: name ?? "Test User",
      image: null,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
  };

  return createCaller({
    db: testDb,
    session: mockSession,
    headers: new Headers(),
  });
}

/**
 * Creates an unauthenticated tRPC caller for testing public procedures
 * and verifying auth errors on protected procedures.
 *
 * The caller has no session, which should cause protected procedures
 * to throw UNAUTHORIZED errors.
 *
 * @returns Typed tRPC caller with null session
 *
 * @example
 * ```typescript
 * const caller = createUnauthenticatedCaller();
 *
 * // This should throw UNAUTHORIZED
 * await expect(caller.apiKey.list()).rejects.toThrow("UNAUTHORIZED");
 *
 * // Public procedures should still work
 * const result = await caller.auth.register({ ... });
 * ```
 */
export function createUnauthenticatedCaller(): ReturnType<typeof createCaller> {
  return createCaller({
    db: testDb,
    session: null,
    headers: new Headers(),
  });
}

/**
 * Creates a caller with custom headers for testing header-dependent functionality.
 *
 * @param options - Authentication options (optional) and custom headers
 * @returns Typed tRPC caller with custom headers
 *
 * @example
 * ```typescript
 * const caller = createCallerWithHeaders({
 *   auth: { userId: "usr_test", tenantId: "ten_test" },
 *   headers: { "x-forwarded-for": "192.168.1.1" },
 * });
 * ```
 */
export function createCallerWithHeaders(options: {
  auth?: AuthenticatedCallerOptions;
  headers: Record<string, string>;
}): ReturnType<typeof createCaller> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(options.headers)) {
    headers.set(key, value);
  }

  const session: MockSession | null = options.auth
    ? {
        user: {
          id: options.auth.userId,
          tenantId: options.auth.tenantId,
          email:
            options.auth.email ?? `${options.auth.userId}@test.example.com`,
          name: options.auth.name ?? "Test User",
          image: null,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }
    : null;

  return createCaller({
    db: testDb,
    session,
    headers,
  });
}

// Re-export AppRouter type for convenience
export type { AppRouter };
