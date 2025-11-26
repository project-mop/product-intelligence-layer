/**
 * Vitest Configuration for Integration Tests
 *
 * Integration tests run against a real PostgreSQL database.
 * Uses separate setup file with database cleanup between tests.
 */

import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node environment for database access (no jsdom needed)
    environment: "node",
    globals: true,

    // Only run integration tests
    include: ["tests/integration/**/*.test.{ts,tsx}"],

    // Integration test setup with database cleanup
    setupFiles: ["./tests/setup.integration.ts"],

    // Longer timeout for database operations
    testTimeout: 30000,

    // Run tests sequentially to avoid database conflicts
    // fileParallelism: false ensures tests run one file at a time
    fileParallelism: false,

    // Sequence tests within files for predictable execution
    sequence: {
      shuffle: false,
    },
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
