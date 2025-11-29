/**
 * Testing utilities for the sandbox generate route.
 *
 * Provides dependency injection for LLM gateway in tests.
 * This file is not part of the route exports.
 *
 * @internal
 */

import type { LLMGateway } from "~/server/services/llm/types";

let gatewayOverride: LLMGateway | null = null;

/**
 * Set a gateway override for testing.
 * Call with null to clear the override.
 *
 * @internal Only for use in tests
 */
export function setGatewayOverride(gateway: LLMGateway | null): void {
  gatewayOverride = gateway;
}

/**
 * Get the current gateway override (if any).
 *
 * @internal Only for use by the route handler
 */
export function getGatewayOverride(): LLMGateway | null {
  return gatewayOverride;
}
