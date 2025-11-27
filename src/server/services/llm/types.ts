/**
 * LLM Gateway Types
 *
 * Provider-agnostic interface for LLM operations.
 * Enables swapping LLM providers without changing business logic.
 *
 * @see docs/architecture.md#LLM-Gateway
 * @see ADR-002: Provider-agnostic LLM Gateway
 */

/**
 * Parameters for LLM generation request.
 */
export interface GenerateParams {
  /** User prompt content */
  prompt: string;

  /** System prompt for LLM instructions */
  systemPrompt?: string;

  /** Maximum tokens for response (default varies by provider) */
  maxTokens: number;

  /** Temperature for response creativity (0-1) */
  temperature: number;

  /** Model identifier (provider-specific, optional) */
  model?: string;
}

/**
 * Result from LLM generation.
 */
export interface GenerateResult {
  /** Generated text content */
  text: string;

  /** Token usage statistics */
  usage: {
    /** Number of tokens in the input */
    inputTokens: number;
    /** Number of tokens in the output */
    outputTokens: number;
  };

  /** Model that was used for generation */
  model: string;

  /** Duration of the LLM call in milliseconds */
  durationMs: number;
}

/**
 * LLM Gateway interface.
 *
 * Provider-agnostic contract for LLM operations.
 * Implementations handle provider-specific details.
 */
export interface LLMGateway {
  /**
   * Generate text completion from the LLM.
   *
   * @param params - Generation parameters
   * @returns Generated result with text and metadata
   * @throws LLMError on provider errors
   */
  generate(params: GenerateParams): Promise<GenerateResult>;
}

/**
 * LLM error codes for standardized error handling.
 */
export type LLMErrorCode = "LLM_TIMEOUT" | "LLM_ERROR" | "LLM_RATE_LIMITED";

/**
 * Custom error class for LLM-related errors.
 */
export class LLMError extends Error {
  constructor(
    public readonly code: LLMErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "LLMError";
  }
}
