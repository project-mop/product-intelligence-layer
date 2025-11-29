/**
 * Process Service Types
 *
 * TypeScript interfaces for Process configuration and component definitions.
 *
 * @see docs/tech-spec-epic-2.md#Data-Models-and-Contracts
 */

/**
 * Configuration for a process version.
 * Stored in ProcessVersion.config JSON column.
 */
export interface ProcessConfig {
  /** System prompt for LLM instructions */
  systemPrompt: string;

  /** Additional instructions appended to system prompt */
  additionalInstructions?: string;

  /** Maximum tokens for LLM response (default: 1024) */
  maxTokens: number;

  /** Temperature for LLM creativity (default: 0.3) */
  temperature: number;

  /** Human-readable description of input schema purpose */
  inputSchemaDescription: string;

  /** Human-readable description of output schema purpose */
  outputSchemaDescription: string;

  /** Goal/purpose of this intelligence process (FR-105) */
  goal: string;

  /** Optional component hierarchy for structured intelligence (FR-104) */
  components?: ComponentDefinition[];

  /** Cache TTL in seconds (default: 900 = 15 min) */
  cacheTtlSeconds: number;

  /** Whether caching is enabled (default: true) */
  cacheEnabled: boolean;

  /** Rate limit requests per minute (default: 60) */
  requestsPerMinute: number;
}

/**
 * Component definition for structured intelligence output.
 */
export interface ComponentDefinition {
  /** Component name/identifier */
  name: string;

  /** Component type classification */
  type: string;

  /** Attributes within this component */
  attributes?: AttributeDefinition[];

  /** Nested subcomponents */
  subcomponents?: ComponentDefinition[];
}

/**
 * Attribute definition within a component.
 */
export interface AttributeDefinition {
  /** Attribute name */
  name: string;

  /** Data type of the attribute */
  type: "string" | "number" | "boolean" | "array" | "object";

  /** Human-readable description */
  description?: string;

  /** Whether this attribute is required */
  required: boolean;
}

/**
 * Get default cache TTL from environment or use 900 (15 min) as fallback.
 *
 * Note: This is evaluated at import time. For dynamic values, read env.CACHE_DEFAULT_TTL_SECONDS directly.
 */
function getDefaultCacheTtl(): number {
  // In client context or build time, use the default
  if (typeof process === "undefined" || !process.env) {
    return 900;
  }
  const envValue = process.env.CACHE_DEFAULT_TTL_SECONDS;
  if (!envValue) {
    return 900;
  }
  const parsed = parseInt(envValue, 10);
  if (isNaN(parsed) || parsed < 0 || parsed > 86400) {
    return 900;
  }
  return parsed;
}

/**
 * Default values for ProcessConfig when creating a new version.
 */
export const DEFAULT_PROCESS_CONFIG: Omit<
  ProcessConfig,
  "systemPrompt" | "inputSchemaDescription" | "outputSchemaDescription" | "goal"
> = {
  maxTokens: 1024,
  temperature: 0.3,
  cacheTtlSeconds: getDefaultCacheTtl(),
  cacheEnabled: true,
  requestsPerMinute: 60,
};
