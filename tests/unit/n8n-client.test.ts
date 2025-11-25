/**
 * N8N Client Unit Tests
 *
 * Tests for the N8N webhook client functions
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import {
  triggerWelcomeEmail,
  triggerPasswordResetEmail,
} from "~/server/services/n8n/client";

describe("N8N Webhook Client", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Set test environment variables
    process.env.N8N_WEBHOOK_BASE_URL = "https://n8n.example.com/webhook";
    process.env.N8N_WEBHOOK_SECRET = "test-secret";
  });

  afterEach(() => {
    delete process.env.N8N_WEBHOOK_BASE_URL;
    delete process.env.N8N_WEBHOOK_SECRET;
  });

  describe("triggerWelcomeEmail", () => {
    it("should send welcome email webhook request", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await triggerWelcomeEmail({
        email: "test@example.com",
        name: "Test User",
        tenantId: "ten_abc123",
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0]!;

      expect(url).toBe("https://n8n.example.com/webhook/welcome-email");
      expect(options.method).toBe("POST");
      expect(options.headers).toEqual({
        "Content-Type": "application/json",
        "X-Webhook-Secret": "test-secret",
      });

      const body = JSON.parse(options.body);
      expect(body.type).toBe("welcome");
      expect(body.email).toBe("test@example.com");
      expect(body.name).toBe("Test User");
      expect(body.tenantId).toBe("ten_abc123");
      expect(body.timestamp).toBeDefined();
    });

    it("should handle webhook failure gracefully (fire-and-forget)", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      // Should not throw
      await expect(
        triggerWelcomeEmail({
          email: "test@example.com",
          tenantId: "ten_abc123",
        })
      ).resolves.toBeUndefined();
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // Should not throw
      await expect(
        triggerWelcomeEmail({
          email: "test@example.com",
          tenantId: "ten_abc123",
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("triggerPasswordResetEmail", () => {
    it("should send password reset webhook request", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await triggerPasswordResetEmail({
        email: "test@example.com",
        name: "Test User",
        resetToken: "abc123",
        resetUrl: "https://app.example.com/reset-password?token=abc123",
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0]!;

      expect(url).toBe("https://n8n.example.com/webhook/password-reset");
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body);
      expect(body.type).toBe("password-reset");
      expect(body.email).toBe("test@example.com");
      expect(body.name).toBe("Test User");
      expect(body.resetUrl).toBe(
        "https://app.example.com/reset-password?token=abc123"
      );
      // Should NOT include raw token in payload (security)
      expect(body.resetToken).toBeUndefined();
    });

    it("should include X-Webhook-Secret header when configured", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await triggerPasswordResetEmail({
        email: "test@example.com",
        resetToken: "abc123",
        resetUrl: "https://app.example.com/reset-password?token=abc123",
      });

      const [, options] = mockFetch.mock.calls[0]!;
      expect(options.headers["X-Webhook-Secret"]).toBe("test-secret");
    });

    it("should not include secret header when not configured", async () => {
      delete process.env.N8N_WEBHOOK_SECRET;
      mockFetch.mockResolvedValueOnce({ ok: true });

      await triggerPasswordResetEmail({
        email: "test@example.com",
        resetToken: "abc123",
        resetUrl: "https://app.example.com/reset-password?token=abc123",
      });

      const [, options] = mockFetch.mock.calls[0]!;
      expect(options.headers["X-Webhook-Secret"]).toBeUndefined();
    });
  });

  describe("Timeout handling", () => {
    it("should handle abort errors gracefully", async () => {
      // Create an abort error
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";

      mockFetch.mockRejectedValueOnce(abortError);

      // Should not throw due to fire-and-forget pattern
      await expect(
        triggerWelcomeEmail({
          email: "test@example.com",
          tenantId: "ten_abc123",
        })
      ).resolves.toBeUndefined();
    });
  });
});
