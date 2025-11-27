/**
 * Prompt Builder Service
 *
 * Assembles system and user prompts from ProcessConfig for LLM calls.
 *
 * @see docs/tech-spec-epic-3.md#Story-3.2-LLM-Gateway-Integration
 * @see docs/stories/3-2-llm-gateway-integration.md
 */

import type { ProcessConfig } from "./types";

/**
 * Assembled prompts ready for LLM call.
 */
export interface AssembledPrompt {
  /** System prompt with instructions and constraints */
  system: string;
  /** User message with input data */
  user: string;
}

/**
 * Assemble system and user prompts from ProcessConfig and input data.
 *
 * System prompt includes:
 * - Goal statement
 * - Output requirements and schema description
 * - JSON-only instruction
 * - Additional instructions (if provided)
 *
 * User message includes:
 * - JSON-stringified input data
 *
 * @param config - Process configuration with goal and schema descriptions
 * @param input - Input data to include in user message
 * @returns Assembled system and user prompts
 */
export function assemblePrompt(
  config: ProcessConfig,
  input: Record<string, unknown>
): AssembledPrompt {
  const systemParts: string[] = [
    "You are an AI assistant that generates structured product intelligence.",
    "",
    `GOAL: ${config.goal}`,
    "",
    "OUTPUT REQUIREMENTS:",
    "- Respond ONLY with valid JSON",
    `- Your response must match this structure: ${config.outputSchemaDescription}`,
    "- Do not include explanations, markdown, or anything outside the JSON",
    "- Be concise and professional",
  ];

  // Add additional instructions if provided
  if (config.additionalInstructions) {
    systemParts.push("");
    systemParts.push(config.additionalInstructions);
  }

  const system = systemParts.join("\n");
  const user = JSON.stringify(input);

  return { system, user };
}

/**
 * Enhance prompt for retry attempt after parse failure.
 *
 * Adds stricter JSON-only instructions to the system prompt.
 *
 * @param original - Original assembled prompt
 * @returns Enhanced prompt for retry
 */
export function enhancePromptForRetry(original: AssembledPrompt): AssembledPrompt {
  const retryInstructions = [
    "",
    "PREVIOUS ATTEMPT FAILED VALIDATION.",
    "The response must be valid JSON only, with no additional text.",
    "Do not include any explanation, markdown code blocks, or commentary.",
    "Start your response with { and end with }.",
  ].join("\n");

  return {
    system: original.system + retryInstructions,
    user: original.user,
  };
}
