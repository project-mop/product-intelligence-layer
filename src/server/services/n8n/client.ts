/**
 * N8N Webhook Client
 *
 * Handles all email notifications via N8N webhooks.
 * Per ADR-005: All emails are sent through N8N workflows, not in-app.
 *
 * @see docs/architecture.md#ADR-005:-N8N-for-Email-Workflows
 */

/**
 * Webhook timeout in milliseconds (5 seconds)
 */
const WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Get N8N webhook configuration from environment
 */
function getWebhookConfig() {
  return {
    baseUrl: process.env.N8N_WEBHOOK_BASE_URL ?? "https://n8n.example.com/webhook",
    secret: process.env.N8N_WEBHOOK_SECRET,
  };
}

/**
 * Send a webhook request to N8N (fire-and-forget)
 *
 * @param endpoint - The webhook endpoint path
 * @param payload - The JSON payload to send
 */
async function sendWebhook(endpoint: string, payload: Record<string, unknown>): Promise<void> {
  const config = getWebhookConfig();
  const url = `${config.baseUrl}/${endpoint}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add secret header if configured
    if (config.secret) {
      headers["X-Webhook-Secret"] = config.secret;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Log result without PII
    if (response.ok) {
      console.log(`[N8N] Webhook ${endpoint} triggered successfully`);
    } else {
      console.error(`[N8N] Webhook ${endpoint} failed with status ${response.status}`);
    }
  } catch (error) {
    // Fire-and-forget: log error but don't throw
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[N8N] Webhook ${endpoint} timed out after ${WEBHOOK_TIMEOUT_MS}ms`);
    } else {
      console.error(`[N8N] Webhook ${endpoint} error:`, error instanceof Error ? error.message : "Unknown error");
    }
  }
}

/**
 * Trigger welcome email for new user signup
 *
 * @param params - User details for the welcome email
 */
export async function triggerWelcomeEmail(params: {
  email: string;
  name?: string;
  tenantId: string;
}): Promise<void> {
  await sendWebhook("welcome-email", {
    type: "welcome",
    email: params.email,
    name: params.name,
    tenantId: params.tenantId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Trigger password reset email
 *
 * @param params - Password reset details
 */
export async function triggerPasswordResetEmail(params: {
  email: string;
  name?: string;
  resetToken: string;
  resetUrl: string;
}): Promise<void> {
  await sendWebhook("password-reset", {
    type: "password-reset",
    email: params.email,
    name: params.name,
    resetUrl: params.resetUrl,
    // Note: We send the URL, not the raw token, for security
    timestamp: new Date().toISOString(),
  });
}
