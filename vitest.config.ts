import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/integration/**/*.test.{ts,tsx}", "tests/e2e/**/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/index.ts",
        "src/app/**/*",
        "src/env.js",
        "src/trpc/**/*", // tRPC client setup
        "src/server/api/routers/**/*", // Covered by integration tests
        "src/server/api/root.ts", // Router aggregation
        "src/server/api/trpc.ts", // tRPC context/middleware setup
        "src/server/auth/**/*", // NextAuth config (requires runtime)
        "src/server/db.ts", // Database client setup
      ],
      thresholds: {
        // Coverage thresholds (updated after integration test backfill)
        // Server routers excluded from unit coverage (tested via integration tests)
        lines: 90,
        functions: 70,
        branches: 90,
        statements: 90,
      },
    },
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
