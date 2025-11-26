/**
 * Database Seed Script
 *
 * Creates sample seed data for development and testing.
 * All seed data uses deterministic IDs with `_seed_` infix and `[Seed]` name prefix.
 *
 * Run with: pnpm db:seed
 * Idempotent: Running multiple times does not create duplicates (uses upsert)
 *
 * @module prisma/seed
 */

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Environment } from "../generated/prisma";
import { hash } from "bcryptjs";
import { createHash } from "crypto";
import "dotenv/config";

// ============================================================================
// Database Client Setup
// ============================================================================

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ============================================================================
// Constants
// ============================================================================

const SEED_PASSWORD = "SeedPassword123!";
const BCRYPT_ROUNDS = 12;

// Deterministic seed IDs
const SEED_IDS = {
  tenants: {
    acme: "ten_seed_acme",
    globex: "ten_seed_globex",
  },
  users: {
    acme: {
      admin: "usr_seed_acme_admin",
      dev: "usr_seed_acme_dev",
      viewer: "usr_seed_acme_viewer",
    },
    globex: {
      admin: "usr_seed_globex_admin",
      dev: "usr_seed_globex_dev",
      viewer: "usr_seed_globex_viewer",
    },
  },
  processes: {
    acme: {
      prodesc: "proc_seed_acme_prodesc",
      seo: "proc_seed_acme_seo",
      category: "proc_seed_acme_category",
      attribute: "proc_seed_acme_attribute",
      title: "proc_seed_acme_title",
    },
    globex: {
      prodesc: "proc_seed_globex_prodesc",
      seo: "proc_seed_globex_seo",
      category: "proc_seed_globex_category",
      attribute: "proc_seed_globex_attribute",
      title: "proc_seed_globex_title",
    },
  },
  processVersions: {
    acme: {
      prodesc: "procv_seed_acme_prodesc_v1",
      seo: "procv_seed_acme_seo_v1",
      category: "procv_seed_acme_category_v1",
      attribute: "procv_seed_acme_attribute_v1",
      title: "procv_seed_acme_title_v1",
    },
    globex: {
      prodesc: "procv_seed_globex_prodesc_v1",
      seo: "procv_seed_globex_seo_v1",
      category: "procv_seed_globex_category_v1",
      attribute: "procv_seed_globex_attribute_v1",
      title: "procv_seed_globex_title_v1",
    },
  },
  apiKeys: {
    acme: {
      sandbox: "key_seed_acme_sandbox",
      production: "key_seed_acme_prod",
    },
    globex: {
      sandbox: "key_seed_globex_sandbox",
      production: "key_seed_globex_prod",
    },
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates a deterministic API key based on seed identifier.
 * Uses SHA-256 hash of a known seed to ensure reproducibility.
 */
function generateSeedApiKey(seedId: string, environment: Environment): {
  plainTextKey: string;
  keyHash: string;
} {
  const envPrefix = environment === "PRODUCTION" ? "live" : "test";
  // Generate deterministic random part based on seedId
  const deterministicRandom = createHash("sha256")
    .update(`seed-key-${seedId}`)
    .digest("hex")
    .slice(0, 32);
  const plainTextKey = `pil_${envPrefix}_${deterministicRandom}`;
  const keyHash = createHash("sha256").update(plainTextKey).digest("hex");
  return { plainTextKey, keyHash };
}

// ============================================================================
// Seed Data Definitions
// ============================================================================

const seedTenants = [
  {
    id: SEED_IDS.tenants.acme,
    name: "[Seed] Acme Corp",
  },
  {
    id: SEED_IDS.tenants.globex,
    name: "[Seed] Globex Industries",
  },
];

const seedUsers = [
  // Acme users
  {
    id: SEED_IDS.users.acme.admin,
    tenantId: SEED_IDS.tenants.acme,
    email: "admin@seed-acme.test",
    name: "[Seed] Acme Admin",
  },
  {
    id: SEED_IDS.users.acme.dev,
    tenantId: SEED_IDS.tenants.acme,
    email: "dev@seed-acme.test",
    name: "[Seed] Acme Developer",
  },
  {
    id: SEED_IDS.users.acme.viewer,
    tenantId: SEED_IDS.tenants.acme,
    email: "viewer@seed-acme.test",
    name: "[Seed] Acme Viewer",
  },
  // Globex users
  {
    id: SEED_IDS.users.globex.admin,
    tenantId: SEED_IDS.tenants.globex,
    email: "admin@seed-globex.test",
    name: "[Seed] Globex Admin",
  },
  {
    id: SEED_IDS.users.globex.dev,
    tenantId: SEED_IDS.tenants.globex,
    email: "dev@seed-globex.test",
    name: "[Seed] Globex Developer",
  },
  {
    id: SEED_IDS.users.globex.viewer,
    tenantId: SEED_IDS.tenants.globex,
    email: "viewer@seed-globex.test",
    name: "[Seed] Globex Viewer",
  },
];

// Process definitions with realistic schemas
const processDefinitions = [
  {
    key: "prodesc" as const,
    name: "Product Description Generator",
    description: "Generates compelling product descriptions from attributes",
    inputSchema: {
      type: "object",
      required: ["productName", "category"],
      properties: {
        productName: { type: "string", description: "Product name" },
        category: { type: "string", description: "Product category" },
        attributes: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        targetAudience: { type: "string", description: "Target customer" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["shortDescription", "longDescription"],
      properties: {
        shortDescription: { type: "string", maxLength: 160 },
        longDescription: { type: "string" },
        seoTitle: { type: "string", maxLength: 60 },
        bulletPoints: {
          type: "array",
          items: { type: "string" },
          maxItems: 5,
        },
      },
    },
    config: {
      goal: "Generate compelling, SEO-friendly product descriptions that highlight key features and benefits",
      systemPrompt:
        "You are an expert ecommerce copywriter specializing in product descriptions.",
      maxTokens: 1024,
      temperature: 0.7,
      cacheTtlSeconds: 900,
      cacheEnabled: true,
      requestsPerMinute: 60,
    },
    environment: Environment.PRODUCTION,
  },
  {
    key: "seo" as const,
    name: "SEO Meta Generator",
    description: "Generates SEO meta tags and descriptions",
    inputSchema: {
      type: "object",
      required: ["title", "content"],
      properties: {
        title: { type: "string", description: "Page title" },
        content: { type: "string", description: "Page content summary" },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Target keywords",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["metaTitle", "metaDescription"],
      properties: {
        metaTitle: { type: "string", maxLength: 60 },
        metaDescription: { type: "string", maxLength: 160 },
        ogTitle: { type: "string" },
        ogDescription: { type: "string" },
      },
    },
    config: {
      goal: "Generate optimized SEO meta tags for improved search visibility",
      systemPrompt: "You are an SEO specialist focused on meta tag optimization.",
      maxTokens: 512,
      temperature: 0.5,
      cacheTtlSeconds: 1800,
      cacheEnabled: true,
      requestsPerMinute: 100,
    },
    environment: Environment.SANDBOX,
  },
  {
    key: "category" as const,
    name: "Category Classifier",
    description: "Classifies products into categories based on attributes",
    inputSchema: {
      type: "object",
      required: ["productName", "description"],
      properties: {
        productName: { type: "string" },
        description: { type: "string" },
        attributes: { type: "object" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["primaryCategory", "confidence"],
      properties: {
        primaryCategory: { type: "string" },
        secondaryCategories: {
          type: "array",
          items: { type: "string" },
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    config: {
      goal: "Accurately classify products into category taxonomy",
      systemPrompt:
        "You are a product categorization expert with knowledge of ecommerce taxonomies.",
      maxTokens: 256,
      temperature: 0.3,
      cacheTtlSeconds: 3600,
      cacheEnabled: true,
      requestsPerMinute: 200,
    },
    environment: Environment.SANDBOX,
  },
  {
    key: "attribute" as const,
    name: "Attribute Extractor",
    description: "Extracts structured attributes from product descriptions",
    inputSchema: {
      type: "object",
      required: ["description"],
      properties: {
        description: { type: "string" },
        category: { type: "string" },
        attributeSchema: {
          type: "object",
          description: "Expected attributes to extract",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["attributes"],
      properties: {
        attributes: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        extractionConfidence: { type: "number" },
      },
    },
    config: {
      goal: "Extract structured product attributes from unstructured text",
      systemPrompt:
        "You are a data extraction specialist focused on product attribute identification.",
      maxTokens: 512,
      temperature: 0.2,
      cacheTtlSeconds: 1800,
      cacheEnabled: true,
      requestsPerMinute: 150,
    },
    environment: Environment.SANDBOX,
  },
  {
    key: "title" as const,
    name: "Bulk Title Optimizer",
    description: "Optimizes product titles for search and conversion",
    inputSchema: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string" },
        brand: { type: "string" },
        category: { type: "string" },
        maxLength: { type: "number", default: 80 },
      },
    },
    outputSchema: {
      type: "object",
      required: ["optimizedTitle"],
      properties: {
        optimizedTitle: { type: "string" },
        suggestions: {
          type: "array",
          items: { type: "string" },
        },
        characterCount: { type: "number" },
      },
    },
    config: {
      goal: "Optimize product titles for better search visibility and click-through rates",
      systemPrompt:
        "You are a title optimization expert for ecommerce marketplaces.",
      maxTokens: 256,
      temperature: 0.6,
      cacheTtlSeconds: 900,
      cacheEnabled: true,
      requestsPerMinute: 200,
    },
    environment: Environment.SANDBOX,
  },
];

// ============================================================================
// Seed Functions
// ============================================================================

async function seedTenantData() {
  console.log("Seeding tenants...");

  for (const tenant of seedTenants) {
    await prisma.tenant.upsert({
      where: { id: tenant.id },
      update: { name: tenant.name },
      create: tenant,
    });
  }

  console.log(`  Created ${seedTenants.length} tenants`);
}

async function seedUserData() {
  console.log("Seeding users...");

  const passwordHash = await hash(SEED_PASSWORD, BCRYPT_ROUNDS);

  for (const user of seedUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        name: user.name,
        email: user.email,
        passwordHash,
      },
      create: {
        ...user,
        passwordHash,
      },
    });
  }

  console.log(`  Created ${seedUsers.length} users`);
}

async function seedProcessData() {
  console.log("Seeding processes and versions...");

  const tenantKeys = ["acme", "globex"] as const;

  for (const tenantKey of tenantKeys) {
    const tenantId = SEED_IDS.tenants[tenantKey];

    for (const procDef of processDefinitions) {
      const processId =
        SEED_IDS.processes[tenantKey][
          procDef.key as keyof (typeof SEED_IDS.processes)[typeof tenantKey]
        ];
      const versionId =
        SEED_IDS.processVersions[tenantKey][
          procDef.key as keyof (typeof SEED_IDS.processVersions)[typeof tenantKey]
        ];

      // Upsert process
      await prisma.process.upsert({
        where: { id: processId },
        update: {
          name: `[Seed] ${procDef.name}`,
          description: procDef.description,
          inputSchema: procDef.inputSchema,
          outputSchema: procDef.outputSchema,
        },
        create: {
          id: processId,
          tenantId,
          name: `[Seed] ${procDef.name}`,
          description: procDef.description,
          inputSchema: procDef.inputSchema,
          outputSchema: procDef.outputSchema,
        },
      });

      // Upsert process version
      await prisma.processVersion.upsert({
        where: { id: versionId },
        update: {
          config: procDef.config,
          environment: procDef.environment,
          publishedAt:
            procDef.environment === Environment.PRODUCTION ? new Date() : null,
        },
        create: {
          id: versionId,
          processId,
          version: "1.0.0",
          config: procDef.config,
          environment: procDef.environment,
          publishedAt:
            procDef.environment === Environment.PRODUCTION ? new Date() : null,
        },
      });
    }
  }

  console.log(`  Created ${processDefinitions.length * 2} processes`);
  console.log(`  Created ${processDefinitions.length * 2} process versions`);
}

async function seedApiKeyData(): Promise<Map<string, string>> {
  console.log("Seeding API keys...");

  const keys = new Map<string, string>();
  const tenantKeys = ["acme", "globex"] as const;
  const environments: Environment[] = [
    Environment.SANDBOX,
    Environment.PRODUCTION,
  ];

  for (const tenantKey of tenantKeys) {
    const tenantId = SEED_IDS.tenants[tenantKey];

    for (const environment of environments) {
      const envKey = environment === Environment.PRODUCTION ? "production" : "sandbox";
      const keyId =
        SEED_IDS.apiKeys[tenantKey][
          envKey as keyof (typeof SEED_IDS.apiKeys)[typeof tenantKey]
        ];
      const { plainTextKey, keyHash } = generateSeedApiKey(keyId, environment);

      await prisma.apiKey.upsert({
        where: { id: keyId },
        update: {
          name: `[Seed] ${tenantKey.charAt(0).toUpperCase() + tenantKey.slice(1)} ${environment} Key`,
          keyHash,
          scopes: ["process:*"],
          environment,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        },
        create: {
          id: keyId,
          tenantId,
          name: `[Seed] ${tenantKey.charAt(0).toUpperCase() + tenantKey.slice(1)} ${environment} Key`,
          keyHash,
          scopes: ["process:*"],
          environment,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        },
      });

      keys.set(`${tenantKey}-${envKey}`, plainTextKey);
    }
  }

  console.log(`  Created ${tenantKeys.length * environments.length} API keys`);
  return keys;
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log("\n=== SEED DATA CREATION ===\n");

  await seedTenantData();
  await seedUserData();
  await seedProcessData();
  const apiKeys = await seedApiKeyData();

  console.log("\n=== SEED DATA CREATED ===\n");
  console.log("Test API Keys (save these - shown only once):");
  console.log(`  - Acme Sandbox:     ${apiKeys.get("acme-sandbox")}`);
  console.log(`  - Acme Production:  ${apiKeys.get("acme-production")}`);
  console.log(`  - Globex Sandbox:   ${apiKeys.get("globex-sandbox")}`);
  console.log(`  - Globex Production: ${apiKeys.get("globex-production")}`);
  console.log("\nTest Users (password: SeedPassword123!):");
  console.log("  - admin@seed-acme.test");
  console.log("  - dev@seed-acme.test");
  console.log("  - viewer@seed-acme.test");
  console.log("  - admin@seed-globex.test");
  console.log("  - dev@seed-globex.test");
  console.log("  - viewer@seed-globex.test");
  console.log("\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error("Seed error:", e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
