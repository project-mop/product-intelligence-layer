/**
 * Audit Request Context Helper
 *
 * Extracts IP address and user agent from request headers
 * for audit logging purposes.
 */

/**
 * Audit request context extracted from headers
 */
export interface AuditRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Extracts audit context from request headers.
 *
 * @param headers - Request headers (Web API Headers object)
 * @returns Audit request context with IP and user agent
 *
 * @example
 * const context = extractRequestContext(req.headers);
 * // { ipAddress: "192.168.1.1", userAgent: "Mozilla/5.0..." }
 */
export function extractRequestContext(headers: Headers): AuditRequestContext {
  // Extract IP address from proxy headers or fall back to direct connection
  // Order of precedence: x-forwarded-for, x-real-ip
  const forwardedFor = headers.get("x-forwarded-for");
  const realIp = headers.get("x-real-ip");

  // x-forwarded-for may contain multiple IPs; take the first (client IP)
  let ipAddress: string | undefined;
  if (forwardedFor) {
    ipAddress = forwardedFor.split(",")[0]?.trim();
  } else if (realIp) {
    ipAddress = realIp;
  }

  // Extract user agent
  const userAgent = headers.get("user-agent") ?? undefined;

  return {
    ipAddress,
    userAgent,
  };
}
