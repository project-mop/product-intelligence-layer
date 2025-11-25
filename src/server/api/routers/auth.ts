/**
 * Auth Router
 *
 * Handles user authentication operations: signup, password reset
 * Login is handled by NextAuth.js signIn function
 */

import { TRPCError } from "@trpc/server";
import { hash } from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { generateTenantId, generateUserId } from "~/lib/id";
import { triggerWelcomeEmail, triggerPasswordResetEmail } from "~/server/services/n8n/client";

/**
 * bcrypt cost factor per security requirements
 */
const BCRYPT_COST_FACTOR = 12;

/**
 * Password reset token expiration (1 hour)
 */
const PASSWORD_RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Input validation schemas
 */
const signupInput = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
});

const requestPasswordResetInput = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordInput = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const authRouter = createTRPCRouter({
  /**
   * User signup
   *
   * Creates a new tenant and user account with hashed password.
   * Returns user info on success (session is created via NextAuth signIn).
   *
   * AC: 1, 2, 7
   */
  signup: publicProcedure.input(signupInput).mutation(async ({ ctx, input }) => {
    const { email, password, name } = input;

    // Check if email already exists
    const existingUser = await ctx.db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An account with this email already exists",
      });
    }

    // Hash password with bcrypt cost factor 12
    const passwordHash = await hash(password, BCRYPT_COST_FACTOR);

    // Generate IDs
    const tenantId = generateTenantId();
    const userId = generateUserId();

    // Create tenant and user in a transaction
    const user = await ctx.db.$transaction(async (tx) => {
      // Create tenant
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: name ?? email.split("@")[0] ?? "My Organization",
        },
      });

      // Create user
      const newUser = await tx.user.create({
        data: {
          id: userId,
          tenantId,
          email,
          name,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          name: true,
          tenantId: true,
          createdAt: true,
        },
      });

      return newUser;
    });

    // Trigger welcome email via N8N (fire-and-forget)
    void triggerWelcomeEmail({
      email: user.email,
      name: user.name ?? undefined,
      tenantId: user.tenantId,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
      },
      message: "Account created successfully",
    };
  }),

  /**
   * Request password reset
   *
   * Generates a reset token and triggers password reset email via N8N.
   * Always returns success to prevent email enumeration.
   *
   * AC: 5
   */
  requestPasswordReset: publicProcedure
    .input(requestPasswordResetInput)
    .mutation(async ({ ctx, input }) => {
      const { email } = input;

      // Find user (but don't reveal if exists)
      const user = await ctx.db.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true },
      });

      if (user) {
        // Generate secure token
        const rawToken = randomBytes(32).toString("hex");
        const hashedToken = createHash("sha256").update(rawToken).digest("hex");
        const expires = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MS);

        // Delete any existing tokens for this email
        await ctx.db.verificationToken.deleteMany({
          where: { identifier: email },
        });

        // Create verification token
        await ctx.db.verificationToken.create({
          data: {
            identifier: email,
            token: hashedToken,
            expires,
          },
        });

        // Build reset URL
        const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
        const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

        // Trigger password reset email via N8N (fire-and-forget)
        void triggerPasswordResetEmail({
          email: user.email,
          name: user.name ?? undefined,
          resetToken: rawToken,
          resetUrl,
        });
      }

      // Always return success to prevent email enumeration
      return {
        success: true,
        message: "If an account exists with this email, a password reset link has been sent",
      };
    }),

  /**
   * Reset password
   *
   * Validates token and updates user password.
   *
   * AC: 6
   */
  resetPassword: publicProcedure
    .input(resetPasswordInput)
    .mutation(async ({ ctx, input }) => {
      const { token, newPassword } = input;

      // Hash the provided token to compare with stored hash
      const hashedToken = createHash("sha256").update(token).digest("hex");

      // Find valid token
      const verificationToken = await ctx.db.verificationToken.findFirst({
        where: {
          token: hashedToken,
          expires: { gt: new Date() },
        },
      });

      if (!verificationToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset token",
        });
      }

      // Find user by email (identifier)
      const user = await ctx.db.user.findUnique({
        where: { email: verificationToken.identifier },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset token",
        });
      }

      // Hash new password
      const passwordHash = await hash(newPassword, BCRYPT_COST_FACTOR);

      // Update password and delete token in transaction
      await ctx.db.$transaction(async (tx) => {
        // Update user password
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash },
        });

        // Delete used token
        await tx.verificationToken.delete({
          where: {
            identifier_token: {
              identifier: verificationToken.identifier,
              token: hashedToken,
            },
          },
        });
      });

      return {
        success: true,
        message: "Password has been reset successfully",
      };
    }),
});
