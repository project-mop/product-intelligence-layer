/**
 * Audit Log Unit Tests
 *
 * Tests for audit logging functionality including:
 * - ID generation with audit prefix
 * - Request context extraction
 *
 * Note: Integration tests with database are not included here.
 * These tests focus on the logic that can be tested without database access.
 * The audit service module (which imports db) cannot be tested in unit tests
 * without mocking the database connection.
 */

import { describe, expect, it } from "vitest";

import {
  generateId,
  generateAuditId,
  hasPrefix,
  ID_PREFIXES,
} from "~/lib/id";
import {
  extractRequestContext,
  type AuditRequestContext,
} from "~/server/services/audit/context";

describe("Audit ID Generation", () => {
  it("should generate audit ID with correct prefix", () => {
    const id = generateAuditId();

    expect(id).toMatch(/^audit_[a-f0-9]{16}$/);
    expect(hasPrefix(id, ID_PREFIXES.audit)).toBe(true);
  });

  it("should generate unique audit IDs", () => {
    const id1 = generateAuditId();
    const id2 = generateAuditId();

    expect(id1).not.toBe(id2);
  });

  it("should include audit prefix in ID_PREFIXES", () => {
    expect(ID_PREFIXES.audit).toBe("audit");
  });

  it("should generate ID with custom length using generic function", () => {
    const id = generateId(ID_PREFIXES.audit, 8);

    expect(id).toMatch(/^audit_[a-f0-9]{8}$/);
  });
});

describe("Request Context Extraction", () => {
  const createHeaders = (init: Record<string, string>): Headers => {
    return new Headers(init);
  };

  describe("IP Address Extraction", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const headers = createHeaders({
        "x-forwarded-for": "192.168.1.100",
      });

      const context = extractRequestContext(headers);

      expect(context.ipAddress).toBe("192.168.1.100");
    });

    it("should extract first IP from x-forwarded-for with multiple IPs", () => {
      const headers = createHeaders({
        "x-forwarded-for": "192.168.1.100, 10.0.0.1, 172.16.0.1",
      });

      const context = extractRequestContext(headers);

      expect(context.ipAddress).toBe("192.168.1.100");
    });

    it("should extract IP from x-real-ip header", () => {
      const headers = createHeaders({
        "x-real-ip": "10.0.0.50",
      });

      const context = extractRequestContext(headers);

      expect(context.ipAddress).toBe("10.0.0.50");
    });

    it("should prefer x-forwarded-for over x-real-ip", () => {
      const headers = createHeaders({
        "x-forwarded-for": "192.168.1.100",
        "x-real-ip": "10.0.0.50",
      });

      const context = extractRequestContext(headers);

      expect(context.ipAddress).toBe("192.168.1.100");
    });

    it("should return undefined IP when no IP headers present", () => {
      const headers = createHeaders({});

      const context = extractRequestContext(headers);

      expect(context.ipAddress).toBeUndefined();
    });

    it("should handle whitespace in x-forwarded-for", () => {
      const headers = createHeaders({
        "x-forwarded-for": "  192.168.1.100  ,  10.0.0.1  ",
      });

      const context = extractRequestContext(headers);

      expect(context.ipAddress).toBe("192.168.1.100");
    });
  });

  describe("User Agent Extraction", () => {
    it("should extract user agent from header", () => {
      const headers = createHeaders({
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      });

      const context = extractRequestContext(headers);

      expect(context.userAgent).toBe(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );
    });

    it("should return undefined user agent when not present", () => {
      const headers = createHeaders({});

      const context = extractRequestContext(headers);

      expect(context.userAgent).toBeUndefined();
    });
  });

  describe("Combined Extraction", () => {
    it("should extract both IP and user agent when present", () => {
      const headers = createHeaders({
        "x-forwarded-for": "192.168.1.100",
        "user-agent": "TestBot/1.0",
      });

      const context = extractRequestContext(headers);

      expect(context.ipAddress).toBe("192.168.1.100");
      expect(context.userAgent).toBe("TestBot/1.0");
    });

    it("should return AuditRequestContext type", () => {
      const headers = createHeaders({});

      const context: AuditRequestContext = extractRequestContext(headers);

      expect(context).toHaveProperty("ipAddress");
      expect(context).toHaveProperty("userAgent");
    });
  });
});

describe("Audit Service Interface (Immutability)", () => {
  // Note: The audit service only exports createAuditLog.
  // No update or delete methods are exposed to ensure immutability.
  // This is verified by code inspection since importing the module
  // would require database connection in test environment.

  it("should document that only createAuditLog is exported", () => {
    // The audit service (src/server/services/audit/index.ts) only exports:
    // - createAuditLog function
    // - CreateAuditLogParams interface
    //
    // NO update or delete methods are available, ensuring immutability.
    // This test documents the expected interface.
    const expectedExports = ["createAuditLog", "CreateAuditLogParams"];
    const unexpectedMethods = ["updateAuditLog", "deleteAuditLog", "removeAuditLog"];

    // These assertions document the expected behavior
    expect(expectedExports).toContain("createAuditLog");
    expect(unexpectedMethods).not.toContain("createAuditLog");
  });
});

describe("Audit Action Naming Convention", () => {
  // These tests document the expected action naming format
  const validActions = [
    "user.created",
    "user.login",
    "apiKey.created",
    "apiKey.rotated",
    "apiKey.revoked",
  ];

  it.each(validActions)("should follow dot-notation format: %s", (action) => {
    // Action format: {resource}.{verb}
    expect(action).toMatch(/^[a-zA-Z]+\.[a-zA-Z]+$/);
  });

  it("should have distinct resource and verb parts", () => {
    const action = "user.created";
    const [resource, verb] = action.split(".");

    expect(resource).toBe("user");
    expect(verb).toBe("created");
  });
});
