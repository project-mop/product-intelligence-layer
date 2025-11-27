/**
 * cURL Command Generator
 *
 * Generates cURL commands for testing intelligence API endpoints.
 * Used by the test console to help users integrate with their external systems.
 *
 * AC: 8 - Button to copy full cURL command with headers to clipboard
 *
 * @see docs/stories/3-3-in-browser-endpoint-testing.md
 */

/**
 * Options for cURL command generation.
 */
export interface CurlGeneratorOptions {
  /** Whether to include line breaks for readability (default: true) */
  multiline?: boolean;
  /** API key to include (default: placeholder) */
  apiKey?: string;
}

/**
 * Generate a cURL command for calling the intelligence API.
 *
 * @param processId - The process ID (proc_*)
 * @param input - The input payload object
 * @param baseUrl - The base URL of the API
 * @param options - Additional generation options
 * @returns Formatted cURL command string
 */
export function generateCurlCommand(
  processId: string,
  input: Record<string, unknown>,
  baseUrl: string,
  options: CurlGeneratorOptions = {}
): string {
  const { multiline = true, apiKey = "YOUR_API_KEY" } = options;

  const endpointUrl = `${baseUrl}/api/v1/intelligence/${processId}/generate`;
  // Use pretty JSON for multiline, compact for single line
  const jsonBody = multiline
    ? JSON.stringify(input, null, 2)
    : JSON.stringify(input);

  // Build parts of the command
  const parts: string[] = [
    "curl",
    "-X POST",
    `"${endpointUrl}"`,
    '-H "Content-Type: application/json"',
    `-H "Authorization: Bearer ${apiKey}"`,
    `-d '${jsonBody}'`,
  ];

  if (multiline) {
    // Join with backslash-newline for readability
    return parts.join(" \\\n  ");
  }

  // Single line format
  return parts.join(" ");
}

/**
 * Generate a cURL command for use in scripts.
 * Uses single quotes around JSON body and proper escaping.
 *
 * @param processId - The process ID (proc_*)
 * @param input - The input payload object
 * @param baseUrl - The base URL of the API
 * @param apiKey - API key to include
 * @returns cURL command suitable for shell scripts
 */
export function generateScriptCurlCommand(
  processId: string,
  input: Record<string, unknown>,
  baseUrl: string,
  apiKey = "YOUR_API_KEY"
): string {
  const endpointUrl = `${baseUrl}/api/v1/intelligence/${processId}/generate`;

  // Escape single quotes in JSON by ending the string, adding escaped quote, and continuing
  const jsonBody = JSON.stringify(input);
  const escapedBody = jsonBody.replace(/'/g, "'\\''");

  return `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '${escapedBody}'`;
}

/**
 * Generate a minimal cURL command without formatting.
 *
 * @param processId - The process ID
 * @param input - The input payload object
 * @param baseUrl - The base URL of the API
 * @returns Minimal cURL command string
 */
export function generateMinimalCurlCommand(
  processId: string,
  input: Record<string, unknown>,
  baseUrl: string
): string {
  const endpointUrl = `${baseUrl}/api/v1/intelligence/${processId}/generate`;
  const jsonBody = JSON.stringify(input);

  return `curl -X POST "${endpointUrl}" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_API_KEY" -d '${jsonBody}'`;
}
