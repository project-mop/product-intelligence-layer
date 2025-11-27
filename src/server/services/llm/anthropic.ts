/**
 * Anthropic LLM Gateway Adapter
 *
 * Implements the LLMGateway interface using Anthropic's Claude API.
 *
 * @see docs/tech-spec-epic-3.md#Story-3.2-LLM-Gateway-Integration
 * @see ADR-002: Provider-agnostic LLM Gateway
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GenerateParams, GenerateResult, LLMGateway } from "./types";
import { LLMError } from "./types";

/** Default model for Anthropic (cost-effective for most use cases) */
const DEFAULT_MODEL = "claude-3-haiku-20240307";

/** Default timeout in milliseconds (30 seconds per spec) */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Configuration for AnthropicGateway.
 */
export interface AnthropicGatewayConfig {
  /** Anthropic API key (defaults to ANTHROPIC_API_KEY env var) */
  apiKey?: string;

  /** Default model to use (defaults to claude-3-haiku) */
  defaultModel?: string;

  /** Request timeout in milliseconds (defaults to 30000) */
  timeoutMs?: number;
}

/**
 * Anthropic Claude adapter implementing the LLMGateway interface.
 *
 * Handles:
 * - API authentication via API key
 * - Request timeout handling
 * - Error mapping to standard LLMError codes
 * - Duration tracking for metrics
 */
export class AnthropicGateway implements LLMGateway {
  private readonly client: Anthropic;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(config: AnthropicGatewayConfig = {}) {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is required. Set it via environment variable or pass apiKey in config."
      );
    }

    this.client = new Anthropic({
      apiKey,
      timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

    this.defaultModel =
      config.defaultModel ??
      process.env.ANTHROPIC_MODEL ??
      DEFAULT_MODEL;

    this.timeoutMs =
      config.timeoutMs ??
      (process.env.LLM_TIMEOUT_MS
        ? parseInt(process.env.LLM_TIMEOUT_MS, 10)
        : DEFAULT_TIMEOUT_MS);
  }

  /**
   * Generate text completion using Anthropic Claude.
   *
   * @param params - Generation parameters
   * @returns Generated result with text and metadata
   * @throws LLMError with code LLM_TIMEOUT on timeout
   * @throws LLMError with code LLM_RATE_LIMITED on 429
   * @throws LLMError with code LLM_ERROR on other API errors
   */
  async generate(params: GenerateParams): Promise<GenerateResult> {
    const startTime = Date.now();
    const model = params.model ?? this.defaultModel;

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        system: params.systemPrompt,
        messages: [{ role: "user", content: params.prompt }],
      });

      const durationMs = Date.now() - startTime;

      // Extract text from content blocks
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      return {
        text,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        model: response.model,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      throw this.mapError(error, durationMs);
    }
  }

  /**
   * Map Anthropic SDK errors to standard LLMError codes.
   */
  private mapError(error: unknown, durationMs: number): LLMError {
    if (error instanceof Anthropic.APIError) {
      // Timeout errors
      if (
        error instanceof Anthropic.APIConnectionTimeoutError ||
        (error.message && error.message.toLowerCase().includes("timeout"))
      ) {
        return new LLMError(
          "LLM_TIMEOUT",
          `LLM request timed out after ${durationMs}ms`,
          error
        );
      }

      // Rate limit errors (429)
      if (error.status === 429) {
        return new LLMError(
          "LLM_RATE_LIMITED",
          "LLM rate limit exceeded. Please try again later.",
          error
        );
      }

      // Authentication errors (401)
      if (error.status === 401) {
        return new LLMError(
          "LLM_ERROR",
          "Invalid Anthropic API key",
          error
        );
      }

      // Server errors (5xx)
      if (error.status && error.status >= 500) {
        return new LLMError(
          "LLM_ERROR",
          `Anthropic API server error: ${error.message}`,
          error
        );
      }

      // Other API errors
      return new LLMError(
        "LLM_ERROR",
        `Anthropic API error: ${error.message}`,
        error
      );
    }

    // Connection/timeout errors from abort signal
    if (error instanceof Error) {
      if (
        error.name === "AbortError" ||
        error.message.includes("timeout") ||
        error.message.includes("ETIMEDOUT")
      ) {
        return new LLMError(
          "LLM_TIMEOUT",
          `LLM request timed out after ${durationMs}ms`,
          error
        );
      }
    }

    // Unknown errors
    const message =
      error instanceof Error ? error.message : "Unknown LLM error";
    return new LLMError(
      "LLM_ERROR",
      message,
      error instanceof Error ? error : undefined
    );
  }
}
