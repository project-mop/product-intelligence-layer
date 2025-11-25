/**
 * Test Setup
 *
 * Global test configuration and setup
 */

import "@testing-library/dom";
import { afterEach, vi } from "vitest";

// Reset all mocks after each test
afterEach(() => {
  vi.resetAllMocks();
});

// Mock environment variables for tests
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.AUTH_SECRET = "test-secret-for-testing";
process.env.NEXTAUTH_URL = "http://localhost:3000";
