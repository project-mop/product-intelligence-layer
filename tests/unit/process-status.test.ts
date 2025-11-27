/**
 * Process Status Computation Unit Tests
 *
 * Tests for the computeProcessStatus utility function.
 *
 * @see docs/stories/3-4-intelligence-list-dashboard.md - AC: 2
 */

import { describe, expect, it } from "vitest";

import {
  computeProcessStatus,
  type ProcessStatus,
  type VersionForStatus,
} from "~/lib/process/status";

describe("computeProcessStatus", () => {
  describe("basic status computation", () => {
    it("should return DRAFT when there are no versions", () => {
      const versions: VersionForStatus[] = [];

      const status = computeProcessStatus(versions);

      expect(status).toBe("DRAFT");
    });

    it("should return DRAFT when all versions are SANDBOX but deprecated", () => {
      const versions: VersionForStatus[] = [
        { environment: "SANDBOX", deprecatedAt: new Date() },
        { environment: "SANDBOX", deprecatedAt: new Date() },
      ];

      const status = computeProcessStatus(versions);

      expect(status).toBe("DRAFT");
    });

    it("should return SANDBOX when only SANDBOX versions exist", () => {
      const versions: VersionForStatus[] = [
        { environment: "SANDBOX", deprecatedAt: null },
      ];

      const status = computeProcessStatus(versions);

      expect(status).toBe("SANDBOX");
    });

    it("should return PRODUCTION when any PRODUCTION version exists", () => {
      const versions: VersionForStatus[] = [
        { environment: "PRODUCTION", deprecatedAt: null },
      ];

      const status = computeProcessStatus(versions);

      expect(status).toBe("PRODUCTION");
    });
  });

  describe("status priority", () => {
    it("should return PRODUCTION over SANDBOX when both exist", () => {
      const versions: VersionForStatus[] = [
        { environment: "SANDBOX", deprecatedAt: null },
        { environment: "PRODUCTION", deprecatedAt: null },
      ];

      const status = computeProcessStatus(versions);

      expect(status).toBe("PRODUCTION");
    });

    it("should return SANDBOX when PRODUCTION is deprecated but SANDBOX is active", () => {
      const versions: VersionForStatus[] = [
        { environment: "SANDBOX", deprecatedAt: null },
        { environment: "PRODUCTION", deprecatedAt: new Date() },
      ];

      const status = computeProcessStatus(versions);

      expect(status).toBe("SANDBOX");
    });

    it("should return PRODUCTION when only one non-deprecated PRODUCTION exists among many", () => {
      const versions: VersionForStatus[] = [
        { environment: "SANDBOX", deprecatedAt: null },
        { environment: "SANDBOX", deprecatedAt: new Date() },
        { environment: "PRODUCTION", deprecatedAt: null },
        { environment: "PRODUCTION", deprecatedAt: new Date() },
      ];

      const status = computeProcessStatus(versions);

      expect(status).toBe("PRODUCTION");
    });
  });

  describe("deprecated version handling", () => {
    it("should exclude deprecated PRODUCTION versions from status calculation", () => {
      const versions: VersionForStatus[] = [
        { environment: "PRODUCTION", deprecatedAt: new Date() },
      ];

      const status = computeProcessStatus(versions);

      expect(status).toBe("DRAFT");
    });

    it("should exclude deprecated SANDBOX versions from status calculation", () => {
      const versions: VersionForStatus[] = [
        { environment: "SANDBOX", deprecatedAt: new Date() },
      ];

      const status = computeProcessStatus(versions);

      expect(status).toBe("DRAFT");
    });

    it("should return SANDBOX when PRODUCTION is deprecated", () => {
      const versions: VersionForStatus[] = [
        { environment: "SANDBOX", deprecatedAt: null },
        { environment: "PRODUCTION", deprecatedAt: new Date() },
      ];

      const status = computeProcessStatus(versions);

      expect(status).toBe("SANDBOX");
    });

    it("should handle mix of deprecated and non-deprecated versions", () => {
      const versions: VersionForStatus[] = [
        { environment: "SANDBOX", deprecatedAt: new Date() },
        { environment: "SANDBOX", deprecatedAt: null },
        { environment: "PRODUCTION", deprecatedAt: new Date() },
      ];

      const status = computeProcessStatus(versions);

      expect(status).toBe("SANDBOX");
    });
  });

  describe("edge cases", () => {
    it("should handle undefined deprecatedAt as not deprecated", () => {
      const versions: VersionForStatus[] = [
        { environment: "SANDBOX", deprecatedAt: undefined },
      ];

      const status = computeProcessStatus(versions);

      expect(status).toBe("SANDBOX");
    });

    it("should handle multiple identical versions", () => {
      const versions: VersionForStatus[] = [
        { environment: "SANDBOX", deprecatedAt: null },
        { environment: "SANDBOX", deprecatedAt: null },
        { environment: "SANDBOX", deprecatedAt: null },
      ];

      const status = computeProcessStatus(versions);

      expect(status).toBe("SANDBOX");
    });

    it("should handle multiple PRODUCTION versions", () => {
      const versions: VersionForStatus[] = [
        { environment: "PRODUCTION", deprecatedAt: null },
        { environment: "PRODUCTION", deprecatedAt: null },
      ];

      const status = computeProcessStatus(versions);

      expect(status).toBe("PRODUCTION");
    });
  });

  describe("return type", () => {
    it("should return valid ProcessStatus type", () => {
      const validStatuses: ProcessStatus[] = ["DRAFT", "SANDBOX", "PRODUCTION"];

      // DRAFT case
      const draftStatus = computeProcessStatus([]);
      expect(validStatuses).toContain(draftStatus);

      // SANDBOX case
      const sandboxStatus = computeProcessStatus([
        { environment: "SANDBOX", deprecatedAt: null },
      ]);
      expect(validStatuses).toContain(sandboxStatus);

      // PRODUCTION case
      const productionStatus = computeProcessStatus([
        { environment: "PRODUCTION", deprecatedAt: null },
      ]);
      expect(validStatuses).toContain(productionStatus);
    });
  });
});
