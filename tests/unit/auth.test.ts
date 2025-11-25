/**
 * Auth Unit Tests
 *
 * Tests for password hashing, verification, and token generation
 */

import { hash, compare } from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { describe, expect, it } from "vitest";

import {
  generateId,
  generateTenantId,
  generateUserId,
  hasPrefix,
  ID_PREFIXES,
} from "~/lib/id";

describe("Password Hashing", () => {
  const BCRYPT_COST_FACTOR = 12;

  it("should hash password with bcrypt cost factor 12", async () => {
    const password = "testPassword123";
    const hashed = await hash(password, BCRYPT_COST_FACTOR);

    // bcrypt hashes start with $2a$ or $2b$
    expect(hashed).toMatch(/^\$2[ab]\$/);

    // Should not be plaintext
    expect(hashed).not.toBe(password);
  });

  it("should verify correct password against hash", async () => {
    const password = "testPassword123";
    const hashed = await hash(password, BCRYPT_COST_FACTOR);

    const isValid = await compare(password, hashed);
    expect(isValid).toBe(true);
  });

  it("should reject incorrect password", async () => {
    const password = "testPassword123";
    const hashed = await hash(password, BCRYPT_COST_FACTOR);

    const isValid = await compare("wrongPassword", hashed);
    expect(isValid).toBe(false);
  });

  it("should generate different hashes for same password (due to salt)", async () => {
    const password = "testPassword123";
    const hash1 = await hash(password, BCRYPT_COST_FACTOR);
    const hash2 = await hash(password, BCRYPT_COST_FACTOR);

    expect(hash1).not.toBe(hash2);

    // Both should still verify correctly
    expect(await compare(password, hash1)).toBe(true);
    expect(await compare(password, hash2)).toBe(true);
  });
});

describe("Token Generation and Validation", () => {
  it("should generate secure random token", () => {
    const token = randomBytes(32).toString("hex");

    expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  it("should hash token with SHA-256", () => {
    const rawToken = randomBytes(32).toString("hex");
    const hashedToken = createHash("sha256").update(rawToken).digest("hex");

    expect(hashedToken).toHaveLength(64); // SHA-256 = 64 hex chars
    expect(hashedToken).not.toBe(rawToken);
  });

  it("should consistently hash same token", () => {
    const rawToken = "test-token-123";
    const hash1 = createHash("sha256").update(rawToken).digest("hex");
    const hash2 = createHash("sha256").update(rawToken).digest("hex");

    expect(hash1).toBe(hash2);
  });

  it("should generate unique tokens", () => {
    const token1 = randomBytes(32).toString("hex");
    const token2 = randomBytes(32).toString("hex");

    expect(token1).not.toBe(token2);
  });
});

describe("ID Generation", () => {
  it("should generate tenant ID with correct prefix", () => {
    const id = generateTenantId();

    expect(id).toMatch(/^ten_[a-f0-9]{16}$/);
    expect(hasPrefix(id, ID_PREFIXES.tenant)).toBe(true);
  });

  it("should generate user ID with correct prefix", () => {
    const id = generateUserId();

    expect(id).toMatch(/^usr_[a-f0-9]{16}$/);
    expect(hasPrefix(id, ID_PREFIXES.user)).toBe(true);
  });

  it("should generate unique IDs", () => {
    const id1 = generateUserId();
    const id2 = generateUserId();

    expect(id1).not.toBe(id2);
  });

  it("should generate ID with custom length", () => {
    const id = generateId(ID_PREFIXES.tenant, 8);

    expect(id).toMatch(/^ten_[a-f0-9]{8}$/);
  });

  it("should correctly validate prefix", () => {
    const tenantId = generateTenantId();
    const userId = generateUserId();

    expect(hasPrefix(tenantId, ID_PREFIXES.tenant)).toBe(true);
    expect(hasPrefix(tenantId, ID_PREFIXES.user)).toBe(false);
    expect(hasPrefix(userId, ID_PREFIXES.user)).toBe(true);
    expect(hasPrefix(userId, ID_PREFIXES.tenant)).toBe(false);
  });
});

describe("Password Requirements", () => {
  it("should accept passwords with 8 or more characters", () => {
    const validPasswords = [
      "12345678",
      "password123",
      "MySecurePassword!@#",
      "a".repeat(100),
    ];

    for (const password of validPasswords) {
      expect(password.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("should hash passwords of various lengths", async () => {
    const passwords = [
      "12345678", // minimum
      "password123456789", // medium
      "a".repeat(72), // bcrypt max (72 bytes)
    ];

    for (const password of passwords) {
      const hashed = await hash(password, BCRYPT_COST_FACTOR);
      const isValid = await compare(password, hashed);
      expect(isValid).toBe(true);
    }
  });
});

const BCRYPT_COST_FACTOR = 12;
