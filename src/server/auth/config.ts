import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

import { db } from "~/server/db";
import { createAuditLog } from "~/server/services/audit";

/**
 * Session max age in seconds (30 days default, configurable via env)
 */
const SESSION_MAX_AGE = process.env.NEXTAUTH_SESSION_MAX_AGE
  ? parseInt(process.env.NEXTAUTH_SESSION_MAX_AGE, 10)
  : 30 * 24 * 60 * 60; // 30 days

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      tenantId: string;
    } & DefaultSession["user"];
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find user by email
        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            tenantId: true,
          },
        });

        if (!user || !user.passwordHash) {
          // User doesn't exist or has no password (OAuth-only account)
          return null;
        }

        // Verify password
        const isValidPassword = await compare(password, user.passwordHash);

        if (!isValidPassword) {
          return null;
        }

        // Return user object (without passwordHash)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  adapter: PrismaAdapter(db) as Adapter,
  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE,
  },
  callbacks: {
    signIn: async ({ user }) => {
      // Log user.login audit event on successful sign in
      if (user.id) {
        // Fetch tenantId for audit log
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { tenantId: true },
        });

        if (dbUser?.tenantId) {
          // Fire-and-forget audit log (don't block sign in)
          void createAuditLog({
            tenantId: dbUser.tenantId,
            userId: user.id,
            action: "user.login",
            resource: "user",
            resourceId: user.id,
            // Note: Request headers not available in NextAuth callback
            // IP/userAgent tracking for login would require custom middleware
          });
        }
      }
      return true;
    },
    session: async ({ session, user }) => {
      // Fetch tenantId from database since it's not part of the default User type
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { tenantId: true },
      });

      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          tenantId: dbUser?.tenantId ?? "",
        },
      };
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
} satisfies NextAuthConfig;
