/**
 * Environment Guard Middleware
 *
 * Enforces that API keys can only access endpoints matching their environment.
 * - SANDBOX keys can only access /api/v1/sandbox/... endpoints
 * - PRODUCTION keys can only access /api/v1/intelligence/... endpoints
 *
 * @see docs/stories/5-2-separate-api-keys-per-environment.md
 * @see docs/tech-spec-epic-5.md#Story-5.2-Separate-API-Keys-per-Environment
 */

import type { Environment } from "../../../generated/prisma";

/**
 * Error thrown when API key environment doesn't match endpoint environment.
 */
export class EnvironmentMismatchError extends Error {
  public readonly code = "ENVIRONMENT_MISMATCH";
  public readonly keyEnvironment: Environment;
  public readonly endpointEnvironment: Environment;

  constructor(keyEnvironment: Environment, endpointEnvironment: Environment) {
    super(
      `${keyEnvironment.toLowerCase()} API key cannot access ${endpointEnvironment.toLowerCase()} endpoints`
    );
    this.name = "EnvironmentMismatchError";
    this.keyEnvironment = keyEnvironment;
    this.endpointEnvironment = endpointEnvironment;
  }
}

/**
 * Determines the expected environment from a URL pathname.
 *
 * Path routing rules:
 * - /api/v1/sandbox/... -> SANDBOX
 * - /api/v1/intelligence/... -> PRODUCTION
 * - Any other path -> PRODUCTION (default)
 *
 * @param pathname - The URL pathname (e.g., "/api/v1/sandbox/intelligence/proc_123/generate")
 * @returns The expected environment for the endpoint
 */
export function getEndpointEnvironment(pathname: string): Environment {
  // Check for sandbox path segment
  if (pathname.includes("/sandbox/")) {
    return "SANDBOX";
  }
  // Default to production for all other paths
  return "PRODUCTION";
}

/**
 * Validates that an API key's environment matches the endpoint's expected environment.
 *
 * This function enforces the security rule that API keys are scoped to a specific
 * environment and cannot cross boundaries. This prevents accidental production
 * access with test credentials.
 *
 * @param keyEnvironment - The environment of the API key (from ApiKeyContext)
 * @param endpointEnvironment - The expected environment for the endpoint
 * @throws {EnvironmentMismatchError} If environments don't match
 */
export function assertEnvironmentMatch(
  keyEnvironment: Environment,
  endpointEnvironment: Environment
): void {
  if (keyEnvironment !== endpointEnvironment) {
    throw new EnvironmentMismatchError(keyEnvironment, endpointEnvironment);
  }
}

/**
 * Convenience function to validate environment access for a request.
 *
 * Combines getEndpointEnvironment and assertEnvironmentMatch for common use case.
 *
 * @param pathname - The request URL pathname
 * @param keyEnvironment - The environment of the API key
 * @throws {EnvironmentMismatchError} If key environment doesn't match endpoint
 */
export function validateEnvironmentAccess(
  pathname: string,
  keyEnvironment: Environment
): void {
  const endpointEnvironment = getEndpointEnvironment(pathname);
  assertEnvironmentMatch(keyEnvironment, endpointEnvironment);
}
