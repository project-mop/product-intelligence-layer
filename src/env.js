import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    // Database
    DATABASE_URL: z.string().url(),

    // NextAuth
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    NEXTAUTH_URL: z.string().url().optional(),
    NEXTAUTH_SESSION_MAX_AGE: z.coerce.number().optional(), // Session max age in seconds (default 30 days)

    // Node environment
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // N8N Webhooks (email workflows)
    N8N_WEBHOOK_BASE_URL: z.string().url().optional(),
    N8N_WEBHOOK_SECRET: z.string().optional(),

    // LLM Gateway (Epic 3)
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().optional(),
    LLM_TIMEOUT_MS: z.coerce.number().optional(),

    // Cache Configuration (Epic 4)
    CACHE_DEFAULT_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(0)
      .max(86400)
      .optional()
      .default(900), // Default 15 minutes per FR-513

    // Future: External Services (uncomment when needed)
    // STRIPE_SECRET_KEY: z.string().optional(),
    // STRIPE_WEBHOOK_SECRET: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // Future: Client-side env vars
    // NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SESSION_MAX_AGE: process.env.NEXTAUTH_SESSION_MAX_AGE,
    NODE_ENV: process.env.NODE_ENV,
    N8N_WEBHOOK_BASE_URL: process.env.N8N_WEBHOOK_BASE_URL,
    N8N_WEBHOOK_SECRET: process.env.N8N_WEBHOOK_SECRET,
    // LLM Gateway
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    LLM_TIMEOUT_MS: process.env.LLM_TIMEOUT_MS,
    // Cache Configuration
    CACHE_DEFAULT_TTL_SECONDS: process.env.CACHE_DEFAULT_TTL_SECONDS,
  },

  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds and CI.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
