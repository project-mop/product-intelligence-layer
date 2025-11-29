/**
 * Environment Guard Middleware Unit Tests
 *
 * Story 5.2: Separate API Keys per Environment
 * Tests for environment detection and enforcement functions.
 */

import { describe, expect, it } from "vitest";

import {
  getEndpointEnvironment,
  assertEnvironmentMatch,
  validateEnvironmentAccess,
  EnvironmentMismatchError,
} from "~/server/middleware/environment-guard";

describe("Environment Guard Middleware", () => {
  describe("getEndpointEnvironment", () => {
    describe("Sandbox path detection", () => {
      it("should return SANDBOX for /api/v1/sandbox/intelligence/proc_123/generate", () => {
        const result = getEndpointEnvironment(
          "/api/v1/sandbox/intelligence/proc_123/generate"
        );
        expect(result).toBe("SANDBOX");
      });

      it("should return SANDBOX for /api/v1/sandbox/other/path", () => {
        const result = getEndpointEnvironment("/api/v1/sandbox/other/path");
        expect(result).toBe("SANDBOX");
      });

      it("should return SANDBOX when /sandbox/ appears anywhere in path", () => {
        const result = getEndpointEnvironment("/some/sandbox/endpoint");
        expect(result).toBe("SANDBOX");
      });
    });

    describe("Production path detection", () => {
      it("should return PRODUCTION for /api/v1/intelligence/proc_123/generate", () => {
        const result = getEndpointEnvironment(
          "/api/v1/intelligence/proc_123/generate"
        );
        expect(result).toBe("PRODUCTION");
      });

      it("should return PRODUCTION for paths without /sandbox/", () => {
        const result = getEndpointEnvironment("/api/v1/other/endpoint");
        expect(result).toBe("PRODUCTION");
      });

      it("should return PRODUCTION for root path", () => {
        const result = getEndpointEnvironment("/");
        expect(result).toBe("PRODUCTION");
      });

      it("should return PRODUCTION for empty path", () => {
        const result = getEndpointEnvironment("");
        expect(result).toBe("PRODUCTION");
      });
    });

    describe("Edge cases", () => {
      it("should handle sandbox as substring correctly (e.g., /sandboxes/ is PRODUCTION)", () => {
        // "sandboxes" contains "sandbox" but not "/sandbox/"
        const result = getEndpointEnvironment("/api/v1/sandboxes/list");
        expect(result).toBe("PRODUCTION");
      });

      it("should handle case sensitivity (uppercase SANDBOX is PRODUCTION)", () => {
        const result = getEndpointEnvironment("/api/v1/SANDBOX/test");
        expect(result).toBe("PRODUCTION");
      });
    });
  });

  describe("assertEnvironmentMatch", () => {
    describe("Matching environments", () => {
      it("should not throw when SANDBOX key matches SANDBOX endpoint", () => {
        expect(() =>
          assertEnvironmentMatch("SANDBOX", "SANDBOX")
        ).not.toThrow();
      });

      it("should not throw when PRODUCTION key matches PRODUCTION endpoint", () => {
        expect(() =>
          assertEnvironmentMatch("PRODUCTION", "PRODUCTION")
        ).not.toThrow();
      });
    });

    describe("Mismatched environments", () => {
      it("should throw EnvironmentMismatchError when SANDBOX key used on PRODUCTION endpoint", () => {
        expect(() =>
          assertEnvironmentMatch("SANDBOX", "PRODUCTION")
        ).toThrow(EnvironmentMismatchError);
      });

      it("should throw EnvironmentMismatchError when PRODUCTION key used on SANDBOX endpoint", () => {
        expect(() =>
          assertEnvironmentMatch("PRODUCTION", "SANDBOX")
        ).toThrow(EnvironmentMismatchError);
      });

      it("should include correct message for sandbox key on production endpoint", () => {
        try {
          assertEnvironmentMatch("SANDBOX", "PRODUCTION");
          expect.fail("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(EnvironmentMismatchError);
          expect((error as EnvironmentMismatchError).message).toBe(
            "sandbox API key cannot access production endpoints"
          );
        }
      });

      it("should include correct message for production key on sandbox endpoint", () => {
        try {
          assertEnvironmentMatch("PRODUCTION", "SANDBOX");
          expect.fail("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(EnvironmentMismatchError);
          expect((error as EnvironmentMismatchError).message).toBe(
            "production API key cannot access sandbox endpoints"
          );
        }
      });
    });
  });

  describe("EnvironmentMismatchError", () => {
    it("should have code ENVIRONMENT_MISMATCH", () => {
      const error = new EnvironmentMismatchError("SANDBOX", "PRODUCTION");
      expect(error.code).toBe("ENVIRONMENT_MISMATCH");
    });

    it("should have name EnvironmentMismatchError", () => {
      const error = new EnvironmentMismatchError("SANDBOX", "PRODUCTION");
      expect(error.name).toBe("EnvironmentMismatchError");
    });

    it("should store keyEnvironment and endpointEnvironment", () => {
      const error = new EnvironmentMismatchError("SANDBOX", "PRODUCTION");
      expect(error.keyEnvironment).toBe("SANDBOX");
      expect(error.endpointEnvironment).toBe("PRODUCTION");
    });

    it("should be an instance of Error", () => {
      const error = new EnvironmentMismatchError("SANDBOX", "PRODUCTION");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("validateEnvironmentAccess", () => {
    describe("Valid access", () => {
      it("should not throw for SANDBOX key on sandbox path", () => {
        expect(() =>
          validateEnvironmentAccess(
            "/api/v1/sandbox/intelligence/proc_123/generate",
            "SANDBOX"
          )
        ).not.toThrow();
      });

      it("should not throw for PRODUCTION key on production path", () => {
        expect(() =>
          validateEnvironmentAccess(
            "/api/v1/intelligence/proc_123/generate",
            "PRODUCTION"
          )
        ).not.toThrow();
      });
    });

    describe("Invalid access", () => {
      it("should throw for SANDBOX key on production path", () => {
        expect(() =>
          validateEnvironmentAccess(
            "/api/v1/intelligence/proc_123/generate",
            "SANDBOX"
          )
        ).toThrow(EnvironmentMismatchError);
      });

      it("should throw for PRODUCTION key on sandbox path", () => {
        expect(() =>
          validateEnvironmentAccess(
            "/api/v1/sandbox/intelligence/proc_123/generate",
            "PRODUCTION"
          )
        ).toThrow(EnvironmentMismatchError);
      });
    });
  });
});

describe("Story 5.2 Acceptance Criteria - Unit Tests", () => {
  describe("AC 3: Sandbox keys only authenticate requests to /api/v1/sandbox/... endpoints", () => {
    it("should detect sandbox endpoints correctly", () => {
      const sandboxPaths = [
        "/api/v1/sandbox/intelligence/proc_123/generate",
        "/api/v1/sandbox/test/endpoint",
        "/api/v1/sandbox/",
      ];

      for (const path of sandboxPaths) {
        expect(getEndpointEnvironment(path)).toBe("SANDBOX");
      }
    });

    it("should allow SANDBOX key access to sandbox endpoints", () => {
      expect(() =>
        assertEnvironmentMatch("SANDBOX", "SANDBOX")
      ).not.toThrow();
    });
  });

  describe("AC 4: Production keys only authenticate requests to /api/v1/intelligence/... endpoints", () => {
    it("should detect production endpoints correctly", () => {
      const productionPaths = [
        "/api/v1/intelligence/proc_123/generate",
        "/api/v1/other/endpoint",
        "/",
      ];

      for (const path of productionPaths) {
        expect(getEndpointEnvironment(path)).toBe("PRODUCTION");
      }
    });

    it("should allow PRODUCTION key access to production endpoints", () => {
      expect(() =>
        assertEnvironmentMatch("PRODUCTION", "PRODUCTION")
      ).not.toThrow();
    });
  });

  describe("AC 5: Using sandbox key on production endpoint returns 403 Forbidden with clear message", () => {
    it("should throw error with clear message", () => {
      try {
        assertEnvironmentMatch("SANDBOX", "PRODUCTION");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(EnvironmentMismatchError);
        const err = error as EnvironmentMismatchError;
        expect(err.message).toContain("sandbox");
        expect(err.message).toContain("production");
        expect(err.message).toContain("cannot access");
      }
    });
  });

  describe("AC 6: Using production key on sandbox endpoint returns 403 Forbidden with clear message", () => {
    it("should throw error with clear message", () => {
      try {
        assertEnvironmentMatch("PRODUCTION", "SANDBOX");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(EnvironmentMismatchError);
        const err = error as EnvironmentMismatchError;
        expect(err.message).toContain("production");
        expect(err.message).toContain("sandbox");
        expect(err.message).toContain("cannot access");
      }
    });
  });
});
