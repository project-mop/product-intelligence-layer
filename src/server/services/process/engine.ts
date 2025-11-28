/**
 * Process Engine Service
 *
 * Orchestrates intelligence generation flow:
 * 1. Assemble prompt from ProcessConfig
 * 2. Call LLM gateway
 * 3. Parse response as JSON
 * 4. Validate output against schema (Story 4.2)
 * 5. Retry once on parse/validation failure
 * 6. Return structured result with metadata
 *
 * @see docs/tech-spec-epic-3.md#Story-3.2-LLM-Gateway-Integration
 * @see docs/architecture.md#Intelligence-Generation-Flow
 * @see docs/stories/4-2-output-schema-enforcement.md
 */

import type { JSONSchema7 } from "json-schema";
import type { LLMGateway } from "../llm/types";
import type { ProcessConfig } from "./types";
import { assemblePrompt, enhancePromptForRetry } from "./prompt";
import {
  validateOutputWithRetry,
  type AttemptLog,
} from "./retry-handler";

/**
 * Options for intelligence generation.
 */
export interface GenerateOptions {
  /** Output schema to validate against (Story 4.2) */
  outputSchema?: JSONSchema7 | Record<string, unknown>;
  /** Request context for logging */
  requestContext?: {
    requestId: string;
    processId: string;
    tenantId: string;
  };
}

/**
 * Result from intelligence generation.
 */
export interface IntelligenceResult {
  /** Generated data (parsed and validated JSON from LLM) */
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
    /** Validation attempt logs (Story 4.2) */
    validationAttempts?: AttemptLog[];
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
 * - Output schema validation with retry (Story 4.2)
 * - Error handling
 */
export class ProcessEngine {
  constructor(private readonly llmGateway: LLMGateway) {}

  /**
   * Generate intelligence from process configuration and input.
   *
   * @param config - Process configuration with prompts and settings
   * @param input - Input data to process
   * @param options - Optional generation options including outputSchema for validation
   * @returns Intelligence result with generated data and metadata
   * @throws LLMError on LLM failures
   * @throws ProcessEngineError on parse failures after retry (when no outputSchema)
   * @throws ApiError with OUTPUT_VALIDATION_FAILED on schema validation failures (Story 4.2)
   */
  async generateIntelligence(
    config: ProcessConfig,
    input: Record<string, unknown>,
    options?: GenerateOptions
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

    // Step 3: If outputSchema provided, use the new validation with retry logic (Story 4.2)
    if (options?.outputSchema) {
      const requestContext = options.requestContext ?? {
        requestId: "unknown",
        processId: "unknown",
        tenantId: "unknown",
      };

      // validateOutputWithRetry handles:
      // - JSON parsing
      // - Schema validation
      // - Automatic retry with stricter prompt on failure
      // - Throwing OUTPUT_VALIDATION_FAILED after second failure
      const validationResult = await validateOutputWithRetry(
        options.outputSchema,
        llmResult,
        this.llmGateway,
        prompt,
        config,
        requestContext
      );

      return {
        data: validationResult.data,
        meta: {
          latencyMs: Date.now() - startTime,
          retried: validationResult.retried,
          model: llmResult.model,
          usage: llmResult.usage,
          validationAttempts: validationResult.attemptResults,
        },
      };
    }

    // Step 4 (legacy): No outputSchema - use original JSON parse with retry
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

    // Step 5: Retry with stricter prompt (legacy path)
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

    // Step 6: Try to parse retry response
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

    // Step 7: Fail after second parse failure
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
