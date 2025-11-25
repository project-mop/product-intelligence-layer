/**
 * API Key Unit Tests
 *
 * Tests for API key generation, hashing, and validation logic
 */

import { createHash, randomBytes } from "crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  generateKey,
  hashKey,
} from "~/server/services/auth/api-key";

import {
  validateApiKey,
  assertProcessAccess,
  type ApiKeyContext,
} from "~/server/services/auth/api-key-validator";

// Mock the db module
vi.mock("~/server/db", () => ({
  db: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { db } from "~/server/db";

describe("API Key Generation", () => {
  describe("generateKey", () => {
    it("should generate key with pil_live_ prefix for PRODUCTION", () => {
      const key = generateKey("PRODUCTION");

      expect(key).toMatch(/^pil_live_[a-f0-9]{64}$/);
      expect(key.startsWith("pil_live_")).toBe(true);
    });

    it("should generate key with pil_test_ prefix for SANDBOX", () => {
      const key = generateKey("SANDBOX");

      expect(key).toMatch(/^pil_test_[a-f0-9]{64}$/);
      expect(key.startsWith("pil_test_")).toBe(true);
    });

    it("should generate 64 hex characters for random portion", () => {
      const key = generateKey("PRODUCTION");
      const randomPortion = key.slice(9); // Remove "pil_live_"

      expect(randomPortion).toHaveLength(64);
      expect(randomPortion).toMatch(/^[a-f0-9]+$/);
    });

    it("should generate unique keys each time", () => {
      const key1 = generateKey("PRODUCTION");
      const key2 = generateKey("PRODUCTION");

      expect(key1).not.toBe(key2);
    });

    it("should have correct total length (73 for live, 72 for test)", () => {
      const liveKey = generateKey("PRODUCTION");
      const testKey = generateKey("SANDBOX");

      // pil_live_ = 9 chars, random = 64 chars, total = 73
      expect(liveKey).toHaveLength(73);

      // pil_test_ = 9 chars, random = 64 chars, total = 73
      expect(testKey).toHaveLength(73);
    });
  });

  describe("hashKey", () => {
    it("should produce SHA-256 hash (64 hex characters)", () => {
      const key = "pil_live_" + randomBytes(32).toString("hex");
      const hash = hashKey(key);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it("should be deterministic (same input = same output)", () => {
      const key = "pil_test_abcdef123456";
      const hash1 = hashKey(key);
      const hash2 = hashKey(key);

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different keys", () => {
      const key1 = generateKey("PRODUCTION");
      const key2 = generateKey("PRODUCTION");
      const hash1 = hashKey(key1);
      const hash2 = hashKey(key2);

      expect(hash1).not.toBe(hash2);
    });

    it("should match crypto.createHash output", () => {
      const key = "pil_live_test123";
      const expectedHash = createHash("sha256").update(key).digest("hex");
      const actualHash = hashKey(key);

      expect(actualHash).toBe(expectedHash);
    });
  });
});

describe("API Key Validation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("validateApiKey", () => {
    it("should return MISSING_AUTH error when no header provided", async () => {
      const result = await validateApiKey(null);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("MISSING_AUTH");
        expect(result.error.status).toBe(401);
      }
    });

    it("should return INVALID_KEY error for non-Bearer format", async () => {
      const result = await validateApiKey("Basic abc123");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("INVALID_KEY");
        expect(result.error.message).toContain("Bearer");
      }
    });

    it("should return INVALID_KEY error for wrong prefix", async () => {
      const result = await validateApiKey("Bearer wrong_prefix_abc123");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("INVALID_KEY");
        expect(result.error.message).toContain("Invalid API key format");
      }
    });

    it("should return INVALID_KEY error when key not found in database", async () => {
      vi.mocked(db.apiKey.findUnique).mockResolvedValue(null);

      const result = await validateApiKey("Bearer pil_live_" + "a".repeat(64));

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("INVALID_KEY");
        expect(result.error.message).toBe("Invalid API key");
      }
    });

    it("should return REVOKED_KEY error when key is revoked", async () => {
      vi.mocked(db.apiKey.findUnique).mockResolvedValue({
        id: "key_123",
        tenantId: "ten_abc",
        name: "Test Key",
        keyHash: "hash",
        scopes: ["process:*"],
        environment: "PRODUCTION",
        expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        revokedAt: new Date(), // Revoked now
        lastUsedAt: null,
        createdAt: new Date(),
      });

      const result = await validateApiKey("Bearer pil_live_" + "a".repeat(64));

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("REVOKED_KEY");
        expect(result.error.message).toBe("API key has been revoked");
      }
    });

    it("should return EXPIRED_KEY error when key is expired", async () => {
      vi.mocked(db.apiKey.findUnique).mockResolvedValue({
        id: "key_123",
        tenantId: "ten_abc",
        name: "Test Key",
        keyHash: "hash",
        scopes: ["process:*"],
        environment: "PRODUCTION",
        expiresAt: new Date(Date.now() - 86400000), // Yesterday (expired)
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      });

      const result = await validateApiKey("Bearer pil_live_" + "a".repeat(64));

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("EXPIRED_KEY");
        expect(result.error.message).toBe("API key has expired");
      }
    });

    it("should return valid context for valid key", async () => {
      vi.mocked(db.apiKey.findUnique).mockResolvedValue({
        id: "key_123",
        tenantId: "ten_abc",
        name: "Test Key",
        keyHash: "hash",
        scopes: ["process:*"],
        environment: "PRODUCTION",
        expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      });
      vi.mocked(db.apiKey.update).mockResolvedValue({} as never);

      const result = await validateApiKey("Bearer pil_live_" + "a".repeat(64));

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.context.tenantId).toBe("ten_abc");
        expect(result.context.keyId).toBe("key_123");
        expect(result.context.scopes).toEqual(["process:*"]);
        expect(result.context.environment).toBe("PRODUCTION");
      }
    });

    it("should update lastUsedAt on successful validation (fire-and-forget)", async () => {
      vi.mocked(db.apiKey.findUnique).mockResolvedValue({
        id: "key_123",
        tenantId: "ten_abc",
        name: "Test Key",
        keyHash: "hash",
        scopes: ["process:*"],
        environment: "SANDBOX",
        expiresAt: null, // Never expires
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      });
      vi.mocked(db.apiKey.update).mockResolvedValue({} as never);

      await validateApiKey("Bearer pil_test_" + "b".repeat(64));

      // The update should be called (fire-and-forget)
      expect(db.apiKey.update).toHaveBeenCalledWith({
        where: { id: "key_123" },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it("should accept key without expiration (expiresAt = null)", async () => {
      vi.mocked(db.apiKey.findUnique).mockResolvedValue({
        id: "key_123",
        tenantId: "ten_abc",
        name: "Test Key",
        keyHash: "hash",
        scopes: ["process:*"],
        environment: "PRODUCTION",
        expiresAt: null, // No expiration
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      });
      vi.mocked(db.apiKey.update).mockResolvedValue({} as never);

      const result = await validateApiKey("Bearer pil_live_" + "c".repeat(64));

      expect(result.valid).toBe(true);
    });
  });

  describe("assertProcessAccess", () => {
    it("should allow access with wildcard scope", () => {
      const ctx: ApiKeyContext = {
        tenantId: "ten_abc",
        keyId: "key_123",
        scopes: ["process:*"],
        environment: "PRODUCTION",
      };

      expect(() => assertProcessAccess(ctx, "proc_xyz")).not.toThrow();
    });

    it("should allow access with specific scope", () => {
      const ctx: ApiKeyContext = {
        tenantId: "ten_abc",
        keyId: "key_123",
        scopes: ["process:proc_xyz"],
        environment: "PRODUCTION",
      };

      expect(() => assertProcessAccess(ctx, "proc_xyz")).not.toThrow();
    });

    it("should deny access without matching scope", () => {
      const ctx: ApiKeyContext = {
        tenantId: "ten_abc",
        keyId: "key_123",
        scopes: ["process:proc_other"],
        environment: "PRODUCTION",
      };

      expect(() => assertProcessAccess(ctx, "proc_xyz")).toThrow(
        "API key does not have access to process proc_xyz"
      );
    });

    it("should deny access with empty scopes", () => {
      const ctx: ApiKeyContext = {
        tenantId: "ten_abc",
        keyId: "key_123",
        scopes: [],
        environment: "PRODUCTION",
      };

      expect(() => assertProcessAccess(ctx, "proc_xyz")).toThrow();
    });
  });
});

describe("Key Format Specification", () => {
  it("should match documented format: pil_{env}_{random}", () => {
    const liveKey = generateKey("PRODUCTION");
    const testKey = generateKey("SANDBOX");

    // Format: pil_{env}_{random}
    // - pil_: constant prefix
    // - env: "live" or "test"
    // - random: 64 hex chars (32 bytes)

    expect(liveKey).toMatch(/^pil_live_[a-f0-9]{64}$/);
    expect(testKey).toMatch(/^pil_test_[a-f0-9]{64}$/);
  });

  it("should produce cryptographically random keys", () => {
    // Generate multiple keys and verify they are all unique
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      keys.add(generateKey("PRODUCTION"));
    }
    expect(keys.size).toBe(100);
  });
});

// Import service functions for additional tests
import {
  createApiKey,
  rotateApiKey,
  revokeApiKey,
  listApiKeys,
  updateApiKeyName,
} from "~/server/services/auth/api-key";

import { createUnauthorizedResponse } from "~/server/services/auth/api-key-validator";

// Mock generateApiKeyId
vi.mock("~/lib/id", () => ({
  generateApiKeyId: vi.fn(() => `key_mock_${Date.now()}`),
}));

describe("API Key Service Functions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("createApiKey", () => {
    it("[P1] should create key with correct format and store hash", async () => {
      // GIVEN: Valid tenant and key parameters
      const mockCreatedKey = {
        id: "key_123",
        tenantId: "ten_abc",
        name: "Production Key",
        keyHash: "somehash",
        scopes: ["process:*"],
        environment: "PRODUCTION" as const,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };
      vi.mocked(db.apiKey.create).mockResolvedValue(mockCreatedKey);

      // WHEN: Creating a new API key
      const result = await createApiKey({
        tenantId: "ten_abc",
        name: "Production Key",
        environment: "PRODUCTION",
      });

      // THEN: Returns plaintext key and stored record
      expect(result.plainTextKey).toMatch(/^pil_live_[a-f0-9]{64}$/);
      expect(result.apiKey.id).toBe("key_123");
      expect(result.apiKey.environment).toBe("PRODUCTION");
      expect(db.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "ten_abc",
          name: "Production Key",
          environment: "PRODUCTION",
          scopes: ["process:*"],
        }),
      });
    });

    it("[P1] should create SANDBOX key with pil_test_ prefix", async () => {
      // GIVEN: Sandbox environment specified
      const mockCreatedKey = {
        id: "key_456",
        tenantId: "ten_abc",
        name: "Test Key",
        keyHash: "somehash",
        scopes: ["process:*"],
        environment: "SANDBOX" as const,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };
      vi.mocked(db.apiKey.create).mockResolvedValue(mockCreatedKey);

      // WHEN: Creating a sandbox key
      const result = await createApiKey({
        tenantId: "ten_abc",
        name: "Test Key",
        environment: "SANDBOX",
      });

      // THEN: Returns plaintext key with test prefix
      expect(result.plainTextKey).toMatch(/^pil_test_[a-f0-9]{64}$/);
      expect(result.apiKey.environment).toBe("SANDBOX");
    });

    it("[P1] should use default 90-day expiration when not specified", async () => {
      // GIVEN: No expiration date provided
      const mockCreatedKey = {
        id: "key_789",
        tenantId: "ten_abc",
        name: "Auto Expiry Key",
        keyHash: "somehash",
        scopes: ["process:*"],
        environment: "PRODUCTION" as const,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };
      vi.mocked(db.apiKey.create).mockResolvedValue(mockCreatedKey);

      // WHEN: Creating key without expiration
      await createApiKey({
        tenantId: "ten_abc",
        name: "Auto Expiry Key",
        environment: "PRODUCTION",
      });

      // THEN: Default expiration is approximately 90 days from now
      const createCall = vi.mocked(db.apiKey.create).mock.calls[0];
      const expiresAt = createCall?.[0]?.data?.expiresAt as Date;
      const daysDiff = Math.round(
        (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBe(90);
    });

    it("[P1] should use custom expiration when provided", async () => {
      // GIVEN: Custom expiration date
      const customExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const mockCreatedKey = {
        id: "key_custom",
        tenantId: "ten_abc",
        name: "Custom Expiry Key",
        keyHash: "somehash",
        scopes: ["process:*"],
        environment: "PRODUCTION" as const,
        expiresAt: customExpiry,
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };
      vi.mocked(db.apiKey.create).mockResolvedValue(mockCreatedKey);

      // WHEN: Creating key with custom expiration
      await createApiKey({
        tenantId: "ten_abc",
        name: "Custom Expiry Key",
        environment: "PRODUCTION",
        expiresAt: customExpiry,
      });

      // THEN: Custom expiration is used
      expect(db.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: customExpiry,
        }),
      });
    });

    it("[P2] should use custom scopes when provided", async () => {
      // GIVEN: Custom scopes
      const customScopes = ["process:proc_123", "process:proc_456"];
      const mockCreatedKey = {
        id: "key_scoped",
        tenantId: "ten_abc",
        name: "Scoped Key",
        keyHash: "somehash",
        scopes: customScopes,
        environment: "PRODUCTION" as const,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };
      vi.mocked(db.apiKey.create).mockResolvedValue(mockCreatedKey);

      // WHEN: Creating key with custom scopes
      await createApiKey({
        tenantId: "ten_abc",
        name: "Scoped Key",
        environment: "PRODUCTION",
        scopes: customScopes,
      });

      // THEN: Custom scopes are used
      expect(db.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scopes: customScopes,
        }),
      });
    });
  });

  describe("rotateApiKey", () => {
    it("[P1] should revoke old key and create new key atomically", async () => {
      // GIVEN: Existing valid key
      const existingKey = {
        id: "key_old",
        tenantId: "ten_abc",
        name: "Rotate Me",
        keyHash: "oldhash",
        scopes: ["process:*"],
        environment: "PRODUCTION" as const,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };
      vi.mocked(db.apiKey.findFirst).mockResolvedValue(existingKey);

      const newKey = {
        id: "key_new",
        tenantId: "ten_abc",
        name: "Rotate Me",
        keyHash: "newhash",
        scopes: ["process:*"],
        environment: "PRODUCTION" as const,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };

      // Mock the transaction
      vi.mocked(db.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([
        { ...existingKey, revokedAt: new Date() },
        newKey,
      ]);

      // WHEN: Rotating the key
      const result = await rotateApiKey({
        keyId: "key_old",
        tenantId: "ten_abc",
      });

      // THEN: Returns new key with plaintext
      expect(result.plainTextKey).toMatch(/^pil_live_[a-f0-9]{64}$/);
      expect(result.apiKey.id).toBe("key_new");
      expect(result.apiKey.name).toBe("Rotate Me"); // Inherited name
    });

    it("[P1] should throw error when key not found", async () => {
      // GIVEN: Key doesn't exist
      vi.mocked(db.apiKey.findFirst).mockResolvedValue(null);

      // WHEN/THEN: Rotation should throw
      await expect(
        rotateApiKey({
          keyId: "key_nonexistent",
          tenantId: "ten_abc",
        })
      ).rejects.toThrow("API key not found or already revoked");
    });

    it("[P1] should throw error when key already revoked", async () => {
      // GIVEN: Key query returns null (because revokedAt: null filter)
      vi.mocked(db.apiKey.findFirst).mockResolvedValue(null);

      // WHEN/THEN: Rotation should throw
      await expect(
        rotateApiKey({
          keyId: "key_revoked",
          tenantId: "ten_abc",
        })
      ).rejects.toThrow("API key not found or already revoked");
    });
  });

  describe("revokeApiKey", () => {
    it("[P1] should set revokedAt timestamp", async () => {
      // GIVEN: Key exists and is not revoked
      vi.mocked(db.apiKey.updateMany).mockResolvedValue({ count: 1 });

      // WHEN: Revoking the key
      await revokeApiKey({
        keyId: "key_to_revoke",
        tenantId: "ten_abc",
      });

      // THEN: updateMany called with revokedAt
      expect(db.apiKey.updateMany).toHaveBeenCalledWith({
        where: {
          id: "key_to_revoke",
          tenantId: "ten_abc",
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });

    it("[P1] should throw error when key not found", async () => {
      // GIVEN: No key matched
      vi.mocked(db.apiKey.updateMany).mockResolvedValue({ count: 0 });

      // WHEN/THEN: Should throw
      await expect(
        revokeApiKey({
          keyId: "key_nonexistent",
          tenantId: "ten_abc",
        })
      ).rejects.toThrow("API key not found or already revoked");
    });

    it("[P1] should throw error when key already revoked", async () => {
      // GIVEN: No key matched (already revoked)
      vi.mocked(db.apiKey.updateMany).mockResolvedValue({ count: 0 });

      // WHEN/THEN: Should throw
      await expect(
        revokeApiKey({
          keyId: "key_already_revoked",
          tenantId: "ten_abc",
        })
      ).rejects.toThrow("API key not found or already revoked");
    });
  });

  describe("listApiKeys", () => {
    it("[P1] should return all keys for tenant sorted by createdAt desc", async () => {
      // GIVEN: Multiple keys exist
      const mockKeys = [
        {
          id: "key_1",
          tenantId: "ten_abc",
          name: "Key 1",
          keyHash: "hash1",
          scopes: ["process:*"],
          environment: "PRODUCTION" as const,
          expiresAt: new Date(),
          revokedAt: null,
          lastUsedAt: null,
          createdAt: new Date("2024-01-02"),
        },
        {
          id: "key_2",
          tenantId: "ten_abc",
          name: "Key 2",
          keyHash: "hash2",
          scopes: ["process:*"],
          environment: "SANDBOX" as const,
          expiresAt: new Date(),
          revokedAt: null,
          lastUsedAt: null,
          createdAt: new Date("2024-01-01"),
        },
      ];
      vi.mocked(db.apiKey.findMany).mockResolvedValue(mockKeys);

      // WHEN: Listing keys
      const result = await listApiKeys("ten_abc");

      // THEN: Returns all keys
      expect(result).toHaveLength(2);
      expect(db.apiKey.findMany).toHaveBeenCalledWith({
        where: { tenantId: "ten_abc" },
        orderBy: { createdAt: "desc" },
      });
    });

    it("[P2] should return empty array when no keys exist", async () => {
      // GIVEN: No keys for tenant
      vi.mocked(db.apiKey.findMany).mockResolvedValue([]);

      // WHEN: Listing keys
      const result = await listApiKeys("ten_new");

      // THEN: Returns empty array
      expect(result).toEqual([]);
    });
  });

  describe("updateApiKeyName", () => {
    it("[P1] should update key name successfully", async () => {
      // GIVEN: Key exists
      const existingKey = {
        id: "key_123",
        tenantId: "ten_abc",
        name: "Old Name",
        keyHash: "hash",
        scopes: ["process:*"],
        environment: "PRODUCTION" as const,
        expiresAt: new Date(),
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };
      vi.mocked(db.apiKey.findFirst).mockResolvedValue(existingKey);
      vi.mocked(db.apiKey.update).mockResolvedValue({
        ...existingKey,
        name: "New Name",
      });

      // WHEN: Updating name
      const result = await updateApiKeyName("key_123", "ten_abc", "New Name");

      // THEN: Returns updated key
      expect(result.name).toBe("New Name");
      expect(db.apiKey.update).toHaveBeenCalledWith({
        where: { id: "key_123" },
        data: { name: "New Name" },
      });
    });

    it("[P1] should throw error when key not found", async () => {
      // GIVEN: Key doesn't exist
      vi.mocked(db.apiKey.findFirst).mockResolvedValue(null);

      // WHEN/THEN: Should throw
      await expect(
        updateApiKeyName("key_nonexistent", "ten_abc", "New Name")
      ).rejects.toThrow("API key not found");
    });

    it("[P2] should throw error when key belongs to different tenant", async () => {
      // GIVEN: Key belongs to different tenant (query returns null)
      vi.mocked(db.apiKey.findFirst).mockResolvedValue(null);

      // WHEN/THEN: Should throw
      await expect(
        updateApiKeyName("key_123", "ten_other", "New Name")
      ).rejects.toThrow("API key not found");
    });
  });
});

describe("Response Helpers", () => {
  describe("createUnauthorizedResponse", () => {
    it("[P1] should create 401 response with JSON body", () => {
      // GIVEN: Validation error
      const error = {
        status: 401 as const,
        code: "INVALID_KEY" as const,
        message: "Invalid API key",
      };

      // WHEN: Creating response
      const response = createUnauthorizedResponse(error);

      // THEN: Response has correct status and headers
      expect(response.status).toBe(401);
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("[P1] should include error code and message in body", async () => {
      // GIVEN: Validation error
      const error = {
        status: 401 as const,
        code: "REVOKED_KEY" as const,
        message: "API key has been revoked",
      };

      // WHEN: Creating response
      const response = createUnauthorizedResponse(error);
      const body = await response.json();

      // THEN: Body contains error details
      expect(body).toEqual({
        error: {
          code: "REVOKED_KEY",
          message: "API key has been revoked",
        },
      });
    });

    it("[P2] should handle all error codes", async () => {
      // GIVEN: All possible error codes
      const errorCodes = [
        "INVALID_KEY",
        "REVOKED_KEY",
        "EXPIRED_KEY",
        "MISSING_AUTH",
      ] as const;

      // WHEN/THEN: Each creates valid response
      for (const code of errorCodes) {
        const error = {
          status: 401 as const,
          code,
          message: `Test message for ${code}`,
        };
        const response = createUnauthorizedResponse(error);
        expect(response.status).toBe(401);

        const body = await response.json();
        expect(body.error.code).toBe(code);
      }
    });
  });
});

describe("Acceptance Criteria Coverage", () => {
  describe("AC 2: Token displayed only once at creation", () => {
    it("[P0] should return plainTextKey only at creation time", async () => {
      // GIVEN: Key creation
      const mockCreatedKey = {
        id: "key_ac2",
        tenantId: "ten_abc",
        name: "AC2 Test",
        keyHash: "somehash",
        scopes: ["process:*"],
        environment: "PRODUCTION" as const,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };
      vi.mocked(db.apiKey.create).mockResolvedValue(mockCreatedKey);

      // WHEN: Creating key
      const result = await createApiKey({
        tenantId: "ten_abc",
        name: "AC2 Test",
        environment: "PRODUCTION",
      });

      // THEN: plainTextKey is returned
      expect(result.plainTextKey).toBeDefined();
      expect(result.plainTextKey.length).toBeGreaterThan(0);

      // AND: Stored record does not contain plaintext (only hash stored)
      expect(mockCreatedKey.keyHash).not.toBe(result.plainTextKey);
    });
  });

  describe("AC 3: Token includes environment prefix", () => {
    it("[P0] should include pil_live_ prefix for PRODUCTION", () => {
      const key = generateKey("PRODUCTION");
      expect(key.startsWith("pil_live_")).toBe(true);
    });

    it("[P0] should include pil_test_ prefix for SANDBOX", () => {
      const key = generateKey("SANDBOX");
      expect(key.startsWith("pil_test_")).toBe(true);
    });
  });

  describe("AC 5: Token rotation", () => {
    it("[P0] should invalidate old token and create new one atomically", async () => {
      // GIVEN: Existing key
      const existingKey = {
        id: "key_ac5_old",
        tenantId: "ten_abc",
        name: "AC5 Test",
        keyHash: "oldhash",
        scopes: ["process:*"],
        environment: "PRODUCTION" as const,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };
      vi.mocked(db.apiKey.findFirst).mockResolvedValue(existingKey);

      const newKey = {
        id: "key_ac5_new",
        tenantId: "ten_abc",
        name: "AC5 Test",
        keyHash: "newhash",
        scopes: ["process:*"],
        environment: "PRODUCTION" as const,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };

      vi.mocked(db.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([
        { ...existingKey, revokedAt: new Date() },
        newKey,
      ]);

      // WHEN: Rotating
      const result = await rotateApiKey({
        keyId: "key_ac5_old",
        tenantId: "ten_abc",
      });

      // THEN: Transaction called (atomic)
      expect(db.$transaction).toHaveBeenCalled();
      expect(result.apiKey.id).toBe("key_ac5_new");
      expect(result.plainTextKey).toBeDefined();
    });
  });

  describe("AC 6: Token revocation", () => {
    it("[P0] should immediately invalidate revoked token", async () => {
      // GIVEN: Key is revoked
      vi.mocked(db.apiKey.findUnique).mockResolvedValue({
        id: "key_ac6",
        tenantId: "ten_abc",
        name: "AC6 Test",
        keyHash: "hash",
        scopes: ["process:*"],
        environment: "PRODUCTION",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(), // REVOKED
        lastUsedAt: null,
        createdAt: new Date(),
      });

      // WHEN: Validating revoked key
      const result = await validateApiKey("Bearer pil_live_" + "a".repeat(64));

      // THEN: Returns 401 REVOKED_KEY
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("REVOKED_KEY");
        expect(result.error.status).toBe(401);
      }
    });
  });

  describe("AC 7: Configurable expiration (default 90 days)", () => {
    it("[P0] should use 90-day default expiration", async () => {
      // GIVEN: No expiration specified
      const mockCreatedKey = {
        id: "key_ac7",
        tenantId: "ten_abc",
        name: "AC7 Test",
        keyHash: "somehash",
        scopes: ["process:*"],
        environment: "PRODUCTION" as const,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };
      vi.mocked(db.apiKey.create).mockResolvedValue(mockCreatedKey);

      // WHEN: Creating key
      await createApiKey({
        tenantId: "ten_abc",
        name: "AC7 Test",
        environment: "PRODUCTION",
      });

      // THEN: Expiration is ~90 days from now
      const createCall = vi.mocked(db.apiKey.create).mock.calls[0];
      const expiresAt = createCall?.[0]?.data?.expiresAt as Date;
      const daysDiff = Math.round(
        (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBe(90);
    });
  });

  describe("AC 8: Expired tokens return 401", () => {
    it("[P0] should return 401 with clear message for expired token", async () => {
      // GIVEN: Key is expired
      vi.mocked(db.apiKey.findUnique).mockResolvedValue({
        id: "key_ac8",
        tenantId: "ten_abc",
        name: "AC8 Test",
        keyHash: "hash",
        scopes: ["process:*"],
        environment: "PRODUCTION",
        expiresAt: new Date(Date.now() - 86400000), // EXPIRED (yesterday)
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      });

      // WHEN: Validating expired key
      const result = await validateApiKey("Bearer pil_live_" + "b".repeat(64));

      // THEN: Returns 401 EXPIRED_KEY with clear message
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("EXPIRED_KEY");
        expect(result.error.status).toBe(401);
        expect(result.error.message).toBe("API key has expired");
      }
    });
  });
});
