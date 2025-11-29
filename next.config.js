/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Instrumentation is enabled by default in Next.js 15+
  // The instrumentation.ts file in src/ will be automatically loaded
};

export default config;
