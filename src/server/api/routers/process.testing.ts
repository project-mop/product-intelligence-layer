/**
 * Process Router Testing Utilities
 *
 * Provides testing hooks for the process router.
 * Only used in test environment.
 *
 * @module server/api/routers/process.testing
 */

import type { LLMGateway } from "~/server/services/llm/types";

/**
 * Gateway override for testing. When set, testGenerate will use this
 * gateway instead of creating a new AnthropicGateway.
 */
let gatewayOverride: LLMGateway | null = null;

/**
 * Set the LLM gateway to use for test generation.
 * Set to null to restore default behavior.
 *
 * @param gateway - Gateway instance or null
 */
export function setTestGatewayOverride(gateway: LLMGateway | null): void {
  gatewayOverride = gateway;
}

/**
 * Get the current gateway override.
 * Returns null if no override is set.
 */
export function getTestGatewayOverride(): LLMGateway | null {
  return gatewayOverride;
}
