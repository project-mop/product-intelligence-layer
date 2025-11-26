/**
 * Example E2E Test
 *
 * Smoke test to verify the application loads correctly.
 * This test serves as a template for writing E2E tests.
 *
 * @module tests/e2e/example.spec
 */

import { test, expect } from "@playwright/test";

test.describe("Application Smoke Tests", () => {
  test("homepage should load successfully", async ({ page }) => {
    // Navigate to the homepage
    await page.goto("/");

    // Verify the page loaded (check for common elements)
    // This will need to be updated once we have actual UI components
    await expect(page).toHaveTitle(/Product Intelligence/i);
  });

  test("page should not have console errors", async ({ page }) => {
    const consoleErrors: string[] = [];

    // Listen for console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");

    // Wait for any async operations to complete
    await page.waitForLoadState("networkidle");

    // Filter out expected errors (e.g., third-party scripts)
    const unexpectedErrors = consoleErrors.filter(
      (error) =>
        !error.includes("favicon") && // Ignore favicon errors
        !error.includes("404") // Ignore 404 for missing resources
    );

    expect(unexpectedErrors).toHaveLength(0);
  });

  test("should be responsive and render on mobile viewport", async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/");

    // Verify page is still visible on mobile
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test("should navigate without errors", async ({ page }) => {
    await page.goto("/");

    // Wait for the page to be fully loaded
    await page.waitForLoadState("domcontentloaded");

    // Check that we didn't get redirected to an error page
    const url = page.url();
    expect(url).not.toContain("error");
    expect(url).not.toContain("404");
  });
});

test.describe("Authentication Flow", () => {
  test.skip("should show login page for unauthenticated users", async ({
    page,
  }) => {
    // This test is skipped until we have authentication UI
    // Once auth UI is implemented, unskip and update selectors

    await page.goto("/dashboard");

    // Should redirect to login or show login form
    // await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });
});
