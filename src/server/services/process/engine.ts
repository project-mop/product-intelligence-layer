/**
 * Process Engine Service
 *
 * Orchestrates intelligence generation flow:
 * 1. Assemble prompt from ProcessConfig
 * 2. Call LLM gateway
 * 3. Parse response as JSON
 * 4. Retry once on parse failure
 * 5. Return structured result with metadata
 *
 * @see docs/tech-spec-epic-3.md#Story-3.2-LLM-Gateway-Integration
 * @see docs/architecture.md#Intelligence-Generation-Flow
 */

import type { LLMGateway } from "../llm/types";
import type { ProcessConfig } from "./types";
import { assemblePrompt, enhancePromptForRetry } from "./prompt";

/**
 * Result from intelligence generation.
 */
export interface IntelligenceResult {
  /** Generated data (parsed JSON from LLM) */
  data: Record<string, unknown>;

  /** Metadata about the generation */
  meta: {
    /** Total latency in milliseconds */
    latencyMs: number;
    /** Whether a retry was needed */
    retried: boolean;
    /** Model used for generation */
    model: string;
    /** Token usage */
    usage: {
      inputTokens: number;
      outputTokens: number;
    };
  };
}

/**
 * Error codes specific to process engine.
 */
export type ProcessEngineErrorCode = "OUTPUT_PARSE_FAILED" | "INVALID_INPUT";

/**
 * Custom error class for process engine errors.
 */
export class ProcessEngineError extends Error {
  constructor(
    public readonly code: ProcessEngineErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "ProcessEngineError";
  }
}

/**
 * Process Engine for orchestrating intelligence generation.
 *
 * Handles the complete generation flow including:
 * - Prompt assembly
 * - LLM invocation
 * - JSON parsing with retry
 * - Error handling
 */
export class ProcessEngine {
  constructor(private readonly llmGateway: LLMGateway) {}

  /**
   * Generate intelligence from process configuration and input.
   *
   * @param config - Process configuration with prompts and settings
   * @param input - Input data to process
   * @returns Intelligence result with generated data and metadata
   * @throws LLMError on LLM failures
   * @throws ProcessEngineError on parse failures after retry
   */
  async generateIntelligence(
    config: ProcessConfig,
    input: Record<string, unknown>
  ): Promise<IntelligenceResult> {
    const startTime = Date.now();

    // Step 1: Assemble prompt
    const prompt = assemblePrompt(config, input);

    // Step 2: Call LLM
    const llmResult = await this.llmGateway.generate({
      prompt: prompt.user,
      systemPrompt: prompt.system,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    });

    // Step 3: Try to parse response
    const parseResult = this.tryParseJson(llmResult.text);

    if (parseResult.success) {
      return {
        data: parseResult.data,
        meta: {
          latencyMs: Date.now() - startTime,
          retried: false,
          model: llmResult.model,
          usage: llmResult.usage,
        },
      };
    }

    // Step 4: Retry with stricter prompt
    console.warn(
      `[ProcessEngine] JSON parse failed, retrying with stricter prompt. Error: ${parseResult.error}`
    );

    const retryPrompt = enhancePromptForRetry(prompt);

    const retryResult = await this.llmGateway.generate({
      prompt: retryPrompt.user,
      systemPrompt: retryPrompt.system,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    });

    // Step 5: Try to parse retry response
    const retryParseResult = this.tryParseJson(retryResult.text);

    if (retryParseResult.success) {
      return {
        data: retryParseResult.data,
        meta: {
          latencyMs: Date.now() - startTime,
          retried: true,
          model: retryResult.model,
          usage: {
            inputTokens:
              llmResult.usage.inputTokens + retryResult.usage.inputTokens,
            outputTokens:
              llmResult.usage.outputTokens + retryResult.usage.outputTokens,
          },
        },
      };
    }

    // Step 6: Fail after second parse failure
    console.error(
      `[ProcessEngine] JSON parse failed after retry. Error: ${retryParseResult.error}`
    );

    throw new ProcessEngineError(
      "OUTPUT_PARSE_FAILED",
      "Failed to parse LLM response as JSON after retry. The model did not return valid JSON.",
      new Error(retryParseResult.error)
    );
  }

  /**
   * Try to parse text as JSON.
   *
   * Attempts to extract JSON from the response, handling cases where
   * the LLM may include extra text before/after the JSON.
   */
  private tryParseJson(text: string):
    | { success: true; data: Record<string, unknown> }
    | { success: false; error: string } {
    // First, try direct parse
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (typeof parsed === "object" && parsed !== null) {
        return { success: true, data: parsed };
      }
      return { success: false, error: "Parsed value is not an object" };
    } catch {
      // Continue to extraction attempts
    }

    // Try to extract JSON from text (handle markdown code blocks)
    const trimmed = text.trim();

    // Remove markdown code blocks if present
    let cleaned = trimmed;
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    // Try to find JSON object boundaries
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
        if (typeof parsed === "object" && parsed !== null) {
          return { success: true, data: parsed };
        }
      } catch {
        // Fall through to error
      }
    }

    return {
      success: false,
      error: `Could not parse response as JSON. Response starts with: ${text.slice(0, 100)}...`,
    };
  }
}
