/**
 * LLM Gateway Module
 *
 * Provider-agnostic LLM interface with Anthropic adapter.
 * Includes circuit breaker protection for fail-fast behavior during outages.
 *
 * @module server/services/llm
 * @see docs/stories/4-4-llm-unavailability-handling.md
 */

export * from "./types";
export { AnthropicGateway, type AnthropicGatewayConfig } from "./anthropic";
export {
  CircuitBreaker,
  createCircuitBreakerLogger,
  type CircuitBreakerConfig,
  type CircuitState,
  type CircuitStateChangeEvent,
  type CircuitBreakerLogEntry,
} from "./circuit-breaker";

import { CircuitBreaker, createCircuitBreakerLogger } from "./circuit-breaker";
import { AnthropicGateway, type AnthropicGatewayConfig } from "./anthropic";
import type { LLMGateway } from "./types";

/**
 * Singleton circuit breaker instance for Anthropic provider.
 * Shared across all gateway instances to track failures consistently.
 */
const anthropicCircuitBreaker = new CircuitBreaker({
  provider: "anthropic",
  onStateChange: createCircuitBreakerLogger,
});

/**
 * Get the singleton circuit breaker for Anthropic.
 * Use this for testing or monitoring circuit breaker state.
 */
export function getAnthropicCircuitBreaker(): CircuitBreaker {
  return anthropicCircuitBreaker;
}

/**
 * Factory function to create an LLM gateway with circuit breaker integration.
 *
 * @param provider - The LLM provider to use (currently only "anthropic")
 * @param config - Optional configuration overrides
 * @returns Configured LLM gateway with circuit breaker protection
 *
 * @example
 * ```typescript
 * const gateway = createLLMGateway("anthropic");
 * const result = await gateway.generate({ prompt: "Hello", maxTokens: 100, temperature: 0.7 });
 * ```
 */
export function createLLMGateway(
  provider: "anthropic" = "anthropic",
  config?: Omit<AnthropicGatewayConfig, "circuitBreaker">
): LLMGateway {
  if (provider === "anthropic") {
    return new AnthropicGateway({
      ...config,
      circuitBreaker: anthropicCircuitBreaker,
    });
  }

  // Future: Add other providers here
  throw new Error(`Unsupported LLM provider: ${provider}`);
}
