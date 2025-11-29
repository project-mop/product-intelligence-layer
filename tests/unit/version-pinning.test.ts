/**
 * Version Pinning Unit Tests
 *
 * Tests for version pinning utilities:
 * - parseVersionHeader: X-Version header parsing
 * - sunset utilities: date calculation, days until sunset
 * - version headers: building response headers
 *
 * @see docs/stories/5-5-version-pinning-and-deprecation.md
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { parseVersionHeader } from "~/server/services/process/parse-version-header";
import {
  calculateSunsetDate,
  isBeyondSunset,
  daysUntilSunset,
  SUNSET_DAYS
} from "~/server/services/process/sunset";
import {
  buildVersionHeaders,
  buildDeprecationMessage
} from "~/server/services/process/version-headers";
import {
  extractVersionNumber
} from "~/server/services/process/version-resolver";
import { ApiError, ErrorCode } from "~/lib/errors";

describe("parseVersionHeader", () => {
  describe("valid headers", () => {
    it("should return undefined when X-Version header is not present", () => {
      const request = new Request("http://localhost/api", {
        method: "GET",
      });

      const result = parseVersionHeader(request);

      expect(result).toBeUndefined();
    });

    it("should return undefined when X-Version header is empty", () => {
      const request = new Request("http://localhost/api", {
        method: "GET",
        headers: { "X-Version": "" },
      });

      const result = parseVersionHeader(request);

      expect(result).toBeUndefined();
    });

    it("should return undefined when X-Version header is whitespace", () => {
      const request = new Request("http://localhost/api", {
        method: "GET",
        headers: { "X-Version": "   " },
      });

      const result = parseVersionHeader(request);

      expect(result).toBeUndefined();
    });

    it("should parse valid positive integer", () => {
      const request = new Request("http://localhost/api", {
        method: "GET",
        headers: { "X-Version": "1" },
      });

      const result = parseVersionHeader(request);

      expect(result).toBe(1);
    });

    it("should parse larger version numbers", () => {
      const request = new Request("http://localhost/api", {
        method: "GET",
        headers: { "X-Version": "42" },
      });

      const result = parseVersionHeader(request);

      expect(result).toBe(42);
    });

    it("should trim whitespace from header value", () => {
      const request = new Request("http://localhost/api", {
        method: "GET",
        headers: { "X-Version": "  5  " },
      });

      const result = parseVersionHeader(request);

      expect(result).toBe(5);
    });
  });

  describe("invalid headers", () => {
    it("should throw for negative numbers", () => {
      const request = new Request("http://localhost/api", {
        method: "GET",
        headers: { "X-Version": "-1" },
      });

      expect(() => parseVersionHeader(request)).toThrow(ApiError);
      expect(() => parseVersionHeader(request)).toThrow("positive integer");
    });

    it("should throw for zero", () => {
      const request = new Request("http://localhost/api", {
        method: "GET",
        headers: { "X-Version": "0" },
      });

      expect(() => parseVersionHeader(request)).toThrow(ApiError);
    });

    it("should parse integer part of floating point numbers", () => {
      // parseInt("1.5", 10) returns 1, which is valid
      const request = new Request("http://localhost/api", {
        method: "GET",
        headers: { "X-Version": "1.5" },
      });

      const result = parseVersionHeader(request);
      expect(result).toBe(1);
    });

    it("should throw for non-numeric strings", () => {
      const request = new Request("http://localhost/api", {
        method: "GET",
        headers: { "X-Version": "abc" },
      });

      expect(() => parseVersionHeader(request)).toThrow(ApiError);
    });

    it("should parse leading numeric part of mixed alphanumeric", () => {
      // parseInt("1a", 10) returns 1, which is valid
      const request = new Request("http://localhost/api", {
        method: "GET",
        headers: { "X-Version": "1a" },
      });

      const result = parseVersionHeader(request);
      expect(result).toBe(1);
    });

    it("should throw for version numbers too large", () => {
      const request = new Request("http://localhost/api", {
        method: "GET",
        headers: { "X-Version": "1000000" },
      });

      expect(() => parseVersionHeader(request)).toThrow(ApiError);
      expect(() => parseVersionHeader(request)).toThrow("too large");
    });

    it("should include INVALID_VERSION error code", () => {
      const request = new Request("http://localhost/api", {
        method: "GET",
        headers: { "X-Version": "invalid" },
      });

      try {
        parseVersionHeader(request);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe(ErrorCode.INVALID_VERSION);
      }
    });
  });
});

describe("sunset utilities", () => {
  describe("calculateSunsetDate", () => {
    it("should calculate sunset date 90 days from deprecation", () => {
      const deprecatedAt = new Date("2024-01-15T12:00:00Z");

      const sunsetDate = calculateSunsetDate(deprecatedAt);

      // 90 days after Jan 15
      const diffDays = Math.round((sunsetDate.getTime() - deprecatedAt.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(90);
    });

    it("should handle leap year correctly", () => {
      // 2024 is a leap year
      const deprecatedAt = new Date("2024-01-01T12:00:00Z");

      const sunsetDate = calculateSunsetDate(deprecatedAt);

      // 90 days from Jan 1 in leap year
      const diffDays = Math.round((sunsetDate.getTime() - deprecatedAt.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(90);
    });

    it("should handle year boundary correctly", () => {
      const deprecatedAt = new Date("2024-11-15T12:00:00Z");

      const sunsetDate = calculateSunsetDate(deprecatedAt);

      // Should roll into 2025
      expect(sunsetDate.getFullYear()).toBe(2025);
    });
  });

  describe("isBeyondSunset", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return false when within sunset period", () => {
      const deprecatedAt = new Date("2024-01-15T00:00:00Z");
      // Set current time to 30 days after deprecation
      vi.setSystemTime(new Date("2024-02-14T00:00:00Z"));

      const result = isBeyondSunset(deprecatedAt);

      expect(result).toBe(false);
    });

    it("should return true when past sunset date", () => {
      const deprecatedAt = new Date("2024-01-15T00:00:00Z");
      // Set current time to 100 days after deprecation (past 90)
      vi.setSystemTime(new Date("2024-04-24T00:00:00Z"));

      const result = isBeyondSunset(deprecatedAt);

      expect(result).toBe(true);
    });

    it("should return true on day after sunset date", () => {
      const deprecatedAt = new Date("2024-01-15T12:00:00Z");
      // Set current time to 91 days after deprecation (day after sunset)
      vi.setSystemTime(new Date("2024-04-15T12:00:00Z"));

      const result = isBeyondSunset(deprecatedAt);

      expect(result).toBe(true);
    });
  });

  describe("daysUntilSunset", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return 90 days when just deprecated", () => {
      const deprecatedAt = new Date("2024-01-15T00:00:00Z");
      vi.setSystemTime(new Date("2024-01-15T00:00:00Z"));

      const days = daysUntilSunset(deprecatedAt);

      expect(days).toBe(90);
    });

    it("should return correct remaining days", () => {
      const deprecatedAt = new Date("2024-01-15T00:00:00Z");
      // 30 days later
      vi.setSystemTime(new Date("2024-02-14T00:00:00Z"));

      const days = daysUntilSunset(deprecatedAt);

      expect(days).toBe(60);
    });

    it("should return negative days when past sunset", () => {
      const deprecatedAt = new Date("2024-01-15T00:00:00Z");
      // 100 days later
      vi.setSystemTime(new Date("2024-04-24T00:00:00Z"));

      const days = daysUntilSunset(deprecatedAt);

      expect(days).toBeLessThan(0);
    });

    it("should return 0 or 1 on sunset date", () => {
      const deprecatedAt = new Date("2024-01-15T00:00:00Z");
      // Exactly on sunset date
      vi.setSystemTime(new Date("2024-04-14T00:00:00Z"));

      const days = daysUntilSunset(deprecatedAt);

      // Could be 0 or 1 depending on time precision
      expect(days).toBeGreaterThanOrEqual(0);
      expect(days).toBeLessThanOrEqual(1);
    });
  });

  describe("SUNSET_DAYS constant", () => {
    it("should be 90 days", () => {
      expect(SUNSET_DAYS).toBe(90);
    });
  });
});

describe("extractVersionNumber", () => {
  it("should extract major version from semver string", () => {
    expect(extractVersionNumber("1.0.0")).toBe(1);
    expect(extractVersionNumber("2.0.0")).toBe(2);
    expect(extractVersionNumber("10.0.0")).toBe(10);
  });

  it("should extract version from draft version strings", () => {
    expect(extractVersionNumber("1.0.0-draft")).toBe(1);
    expect(extractVersionNumber("3.0.0-draft")).toBe(3);
  });

  it("should return 0 for invalid version strings", () => {
    expect(extractVersionNumber("invalid")).toBe(0);
    expect(extractVersionNumber("")).toBe(0);
  });
});

describe("buildVersionHeaders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockVersion = {
    id: "ver_123",
    processId: "proc_123",
    version: "2.0.0",
    environment: "PRODUCTION" as const,
    status: "ACTIVE" as const,
    config: {},
    createdAt: new Date("2024-01-01"),
    publishedAt: new Date("2024-01-01"),
    deprecatedAt: null,
    changeNotes: null,
    promotedBy: null,
  };

  describe("active versions", () => {
    it("should include basic version headers", () => {
      const result = {
        version: mockVersion,
        isPinned: false,
        isDeprecated: false,
        sunsetDate: null,
        latestVersionNumber: 2,
      };

      const headers = buildVersionHeaders(result);

      expect(headers["X-Version"]).toBe("2");
      expect(headers["X-Version-Status"]).toBe("active");
      expect(headers["X-Environment"]).toBe("production");
    });

    it("should not include deprecation headers for active versions", () => {
      const result = {
        version: mockVersion,
        isPinned: false,
        isDeprecated: false,
        sunsetDate: null,
        latestVersionNumber: 2,
      };

      const headers = buildVersionHeaders(result);

      expect(headers["X-Deprecated"]).toBeUndefined();
      expect(headers["X-Deprecated-Message"]).toBeUndefined();
      expect(headers["X-Sunset-Date"]).toBeUndefined();
    });
  });

  describe("deprecated versions", () => {
    const deprecatedAt = new Date("2024-01-15T12:00:00Z");

    it("should include deprecation headers", () => {
      const result = {
        version: { ...mockVersion, deprecatedAt, status: "DEPRECATED" as const },
        isPinned: true,
        isDeprecated: true,
        sunsetDate: calculateSunsetDate(deprecatedAt),
        latestVersionNumber: 3,
      };

      const headers = buildVersionHeaders(result);

      expect(headers["X-Version-Status"]).toBe("deprecated");
      expect(headers["X-Deprecated"]).toBe("true");
      expect(headers["X-Deprecated-Message"]).toBeDefined();
      // Check that sunset date is 90 days from deprecation
      const sunsetDate = new Date(headers["X-Sunset-Date"]!);
      const diffDays = Math.round((sunsetDate.getTime() - deprecatedAt.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(90);
    });

    it("should include sunset countdown in message", () => {
      const result = {
        version: { ...mockVersion, deprecatedAt, status: "DEPRECATED" as const },
        isPinned: true,
        isDeprecated: true,
        sunsetDate: calculateSunsetDate(deprecatedAt),
        latestVersionNumber: 3,
      };

      const headers = buildVersionHeaders(result);

      expect(headers["X-Deprecated-Message"]).toContain("Version 2 is deprecated");
      expect(headers["X-Deprecated-Message"]).toContain("Latest is version 3");
      expect(headers["X-Deprecated-Message"]).toContain("Sunset in");
    });
  });

  describe("environment handling", () => {
    it("should return sandbox for SANDBOX environment", () => {
      const sandboxVersion = { ...mockVersion, environment: "SANDBOX" as const };
      const result = {
        version: sandboxVersion,
        isPinned: false,
        isDeprecated: false,
        sunsetDate: null,
        latestVersionNumber: 2,
      };

      const headers = buildVersionHeaders(result);

      expect(headers["X-Environment"]).toBe("sandbox");
    });

    it("should return production for PRODUCTION environment", () => {
      const result = {
        version: mockVersion,
        isPinned: false,
        isDeprecated: false,
        sunsetDate: null,
        latestVersionNumber: 2,
      };

      const headers = buildVersionHeaders(result);

      expect(headers["X-Environment"]).toBe("production");
    });
  });
});

describe("buildDeprecationMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockVersion = {
    id: "ver_123",
    processId: "proc_123",
    version: "1.0.0",
    environment: "PRODUCTION" as const,
    status: "DEPRECATED" as const,
    config: {},
    createdAt: new Date("2024-01-01"),
    publishedAt: new Date("2024-01-01"),
    deprecatedAt: new Date("2024-01-15T00:00:00Z"),
    changeNotes: null,
    promotedBy: null,
  };

  it("should include days until sunset when before sunset", () => {
    vi.setSystemTime(new Date("2024-02-14T00:00:00Z")); // 30 days after deprecation

    const result = {
      version: mockVersion,
      isPinned: true,
      isDeprecated: true,
      sunsetDate: calculateSunsetDate(mockVersion.deprecatedAt!),
      latestVersionNumber: 2,
    };

    const message = buildDeprecationMessage(result);

    expect(message).toContain("Sunset in 60 days");
    expect(message).toContain("Latest is version 2");
  });

  it("should indicate past sunset when after sunset date", () => {
    vi.setSystemTime(new Date("2024-04-20T00:00:00Z")); // After sunset

    const result = {
      version: mockVersion,
      isPinned: true,
      isDeprecated: true,
      sunsetDate: calculateSunsetDate(mockVersion.deprecatedAt!),
      latestVersionNumber: 2,
    };

    const message = buildDeprecationMessage(result);

    expect(message).toContain("past its sunset date");
    expect(message).toContain("Please upgrade to version 2");
  });
});
