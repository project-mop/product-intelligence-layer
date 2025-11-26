/**
 * Auth Router Integration Tests
 *
 * Tests the auth tRPC router with a real database.
 * Verifies signup, password reset request, and password reset flows.
 *
 * @module tests/integration/auth-router.test
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { createHash } from "crypto";
import { compare } from "bcryptjs";
import { createUnauthenticatedCaller } from "../support/trpc";
import { userFactory, tenantFactory } from "../support/factories";
import { testDb } from "../support/db";

// Mock N8N client to prevent actual email sending
vi.mock("~/server/services/n8n/client", () => ({
  triggerWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  triggerPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe("auth Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signup", () => {
    it("should create a new user and tenant", async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.auth.signup({
        email: "newuser@example.com",
        password: "securepassword123",
        name: "New User",
      });

      expect(result.user.email).toBe("newuser@example.com");
      expect(result.user.name).toBe("New User");
      expect(result.user.tenantId).toBeDefined();
      expect(result.message).toBe("Account created successfully");
    });

    it("should create a tenant when user signs up", async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.auth.signup({
        email: "tenanttest@example.com",
        password: "securepassword123",
        name: "Tenant Test User",
      });

      // Verify tenant was created
      const tenant = await testDb.tenant.findUnique({
        where: { id: result.user.tenantId },
      });

      expect(tenant).not.toBeNull();
    });

    it("should hash password with bcrypt", async () => {
      const caller = createUnauthenticatedCaller();
      const password = "myplaintextpassword";

      const result = await caller.auth.signup({
        email: "hashtest@example.com",
        password,
        name: "Hash Test",
      });

      // Verify password was hashed
      const user = await testDb.user.findUnique({
        where: { id: result.user.id },
        select: { passwordHash: true },
      });

      expect(user?.passwordHash).not.toBe(password);
      expect(user?.passwordHash).toMatch(/^\$2[ayb]\$/); // bcrypt prefix

      // Verify hash validates
      const isValid = await compare(password, user!.passwordHash!);
      expect(isValid).toBe(true);
    });

    it("should reject duplicate email", async () => {
      const caller = createUnauthenticatedCaller();

      // Create first user
      await caller.auth.signup({
        email: "duplicate@example.com",
        password: "password123",
        name: "First User",
      });

      // Try to create second user with same email
      await expect(
        caller.auth.signup({
          email: "duplicate@example.com",
          password: "differentpassword",
          name: "Second User",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should reject invalid email format", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.auth.signup({
          email: "not-an-email",
          password: "password123",
          name: "Invalid Email User",
        })
      ).rejects.toThrow();
    });

    it("should reject password shorter than 8 characters", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.auth.signup({
          email: "shortpass@example.com",
          password: "short",
          name: "Short Password User",
        })
      ).rejects.toThrow();
    });

    it("should allow signup without name (optional)", async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.auth.signup({
        email: "noname@example.com",
        password: "password123",
      });

      expect(result.user.email).toBe("noname@example.com");
      expect(result.user.name).toBeNull();
    });

    it("should create audit log entry", async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.auth.signup({
        email: "auditlog@example.com",
        password: "password123",
        name: "Audit Log User",
      });

      // Wait for fire-and-forget audit log
      await new Promise((r) => setTimeout(r, 100));

      const auditLog = await testDb.auditLog.findFirst({
        where: {
          tenantId: result.user.tenantId,
          action: "user.created",
          resourceId: result.user.id,
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.userId).toBe(result.user.id);
    });

    it("should use email prefix as tenant name when name not provided", async () => {
      const caller = createUnauthenticatedCaller();

      const result = await caller.auth.signup({
        email: "john.doe@company.com",
        password: "password123",
      });

      const tenant = await testDb.tenant.findUnique({
        where: { id: result.user.tenantId },
      });

      // Should use email prefix "john.doe" as tenant name
      expect(tenant?.name).toBe("john.doe");
    });
  });

  describe("requestPasswordReset", () => {
    it("should always return success (prevents email enumeration)", async () => {
      const caller = createUnauthenticatedCaller();

      // Non-existent email
      const result = await caller.auth.requestPasswordReset({
        email: "nonexistent@example.com",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("If an account exists");
    });

    it("should create verification token for existing user", async () => {
      // Create a user first
      await userFactory.create({
        email: "resetme@example.com",
      });

      const caller = createUnauthenticatedCaller();

      await caller.auth.requestPasswordReset({
        email: "resetme@example.com",
      });

      // Check token was created
      const token = await testDb.verificationToken.findFirst({
        where: { identifier: "resetme@example.com" },
      });

      expect(token).not.toBeNull();
      expect(token?.expires.getTime()).toBeGreaterThan(Date.now());
    });

    it("should delete existing tokens before creating new one", async () => {
      // Create a user
      await userFactory.create({
        email: "multitoken@example.com",
      });

      const caller = createUnauthenticatedCaller();

      // Request reset twice
      await caller.auth.requestPasswordReset({
        email: "multitoken@example.com",
      });
      await caller.auth.requestPasswordReset({
        email: "multitoken@example.com",
      });

      // Should only have one token
      const tokens = await testDb.verificationToken.findMany({
        where: { identifier: "multitoken@example.com" },
      });

      expect(tokens).toHaveLength(1);
    });

    it("should not create token for non-existent user", async () => {
      const caller = createUnauthenticatedCaller();

      await caller.auth.requestPasswordReset({
        email: "ghost@example.com",
      });

      const token = await testDb.verificationToken.findFirst({
        where: { identifier: "ghost@example.com" },
      });

      expect(token).toBeNull();
    });

    it("should set 1 hour expiration on token", async () => {
      await userFactory.create({
        email: "expiry@example.com",
      });

      const caller = createUnauthenticatedCaller();
      const beforeRequest = Date.now();

      await caller.auth.requestPasswordReset({
        email: "expiry@example.com",
      });

      const token = await testDb.verificationToken.findFirst({
        where: { identifier: "expiry@example.com" },
      });

      // Token should expire approximately 1 hour from now
      const oneHourMs = 60 * 60 * 1000;
      const expectedExpiry = beforeRequest + oneHourMs;

      expect(token?.expires.getTime()).toBeGreaterThan(expectedExpiry - 1000);
      expect(token?.expires.getTime()).toBeLessThan(expectedExpiry + 5000);
    });

    it("should reject invalid email format", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.auth.requestPasswordReset({
          email: "not-valid-email",
        })
      ).rejects.toThrow();
    });
  });

  describe("resetPassword", () => {
    it("should reset password with valid token", async () => {
      // Create a user
      const user = await userFactory.create({
        email: "reset@example.com",
        passwordHash: "oldhash",
      });

      // Create a valid token
      const rawToken = "validtoken123456";
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");
      await testDb.verificationToken.create({
        data: {
          identifier: "reset@example.com",
          token: hashedToken,
          expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        },
      });

      const caller = createUnauthenticatedCaller();
      const newPassword = "newSecurePassword123";

      const result = await caller.auth.resetPassword({
        token: rawToken,
        newPassword,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("Password has been reset successfully");

      // Verify password was updated
      const updatedUser = await testDb.user.findUnique({
        where: { id: user.id },
        select: { passwordHash: true },
      });

      const isValid = await compare(newPassword, updatedUser!.passwordHash!);
      expect(isValid).toBe(true);
    });

    it("should delete token after successful reset", async () => {
      await userFactory.create({
        email: "tokendelete@example.com",
      });

      const rawToken = "deletethistoken";
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");
      await testDb.verificationToken.create({
        data: {
          identifier: "tokendelete@example.com",
          token: hashedToken,
          expires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const caller = createUnauthenticatedCaller();

      await caller.auth.resetPassword({
        token: rawToken,
        newPassword: "newpassword123",
      });

      // Token should be deleted
      const token = await testDb.verificationToken.findFirst({
        where: { identifier: "tokendelete@example.com" },
      });

      expect(token).toBeNull();
    });

    it("should reject invalid token", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.auth.resetPassword({
          token: "invalidtoken",
          newPassword: "newpassword123",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should reject expired token", async () => {
      await userFactory.create({
        email: "expired@example.com",
      });

      const rawToken = "expiredtoken";
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");
      await testDb.verificationToken.create({
        data: {
          identifier: "expired@example.com",
          token: hashedToken,
          expires: new Date(Date.now() - 1000), // Already expired
        },
      });

      const caller = createUnauthenticatedCaller();

      await expect(
        caller.auth.resetPassword({
          token: rawToken,
          newPassword: "newpassword123",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should reject password shorter than 8 characters", async () => {
      await userFactory.create({
        email: "shortpass@example.com",
      });

      const rawToken = "validtoken";
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");
      await testDb.verificationToken.create({
        data: {
          identifier: "shortpass@example.com",
          token: hashedToken,
          expires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const caller = createUnauthenticatedCaller();

      await expect(
        caller.auth.resetPassword({
          token: rawToken,
          newPassword: "short",
        })
      ).rejects.toThrow();
    });

    it("should handle case where user was deleted after token creation", async () => {
      // Create user and token
      const user = await userFactory.create({
        email: "deleted@example.com",
      });

      const rawToken = "orphantoken";
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");
      await testDb.verificationToken.create({
        data: {
          identifier: "deleted@example.com",
          token: hashedToken,
          expires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // Delete the user (simulating edge case)
      await testDb.user.delete({ where: { id: user.id } });

      const caller = createUnauthenticatedCaller();

      await expect(
        caller.auth.resetPassword({
          token: rawToken,
          newPassword: "newpassword123",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should reject empty token", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.auth.resetPassword({
          token: "",
          newPassword: "newpassword123",
        })
      ).rejects.toThrow();
    });
  });

  describe("complete password reset flow", () => {
    it("should complete full reset flow: request -> reset", async () => {
      // 1. Create user with known password
      const originalPassword = "originalPassword123";
      const { user } = await userFactory.createWithTenant({
        email: "fullflow@example.com",
      });

      // Manually set the password hash (factory doesn't set it)
      const { hash } = await import("bcryptjs");
      const originalHash = await hash(originalPassword, 12);
      await testDb.user.update({
        where: { id: user.id },
        data: { passwordHash: originalHash },
      });

      const caller = createUnauthenticatedCaller();

      // 2. Request password reset
      await caller.auth.requestPasswordReset({
        email: "fullflow@example.com",
      });

      // 3. Get the token from database (in real flow, this comes from email)
      const storedToken = await testDb.verificationToken.findFirst({
        where: { identifier: "fullflow@example.com" },
      });
      expect(storedToken).not.toBeNull();

      // 4. We need to find the raw token - we can't reverse the hash,
      // so we'll create a new token directly for testing
      const rawToken = "testflowtoken123";
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");
      await testDb.verificationToken.update({
        where: {
          identifier_token: {
            identifier: "fullflow@example.com",
            token: storedToken!.token,
          },
        },
        data: { token: hashedToken },
      });

      // 5. Reset with new password
      const newPassword = "brandNewPassword456";
      await caller.auth.resetPassword({
        token: rawToken,
        newPassword,
      });

      // 6. Verify new password works
      const updatedUser = await testDb.user.findUnique({
        where: { id: user.id },
        select: { passwordHash: true },
      });

      const isNewValid = await compare(newPassword, updatedUser!.passwordHash!);
      expect(isNewValid).toBe(true);

      // 7. Verify old password no longer works
      const isOldValid = await compare(
        originalPassword,
        updatedUser!.passwordHash!
      );
      expect(isOldValid).toBe(false);
    });
  });
});
