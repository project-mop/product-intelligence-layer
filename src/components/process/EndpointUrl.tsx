"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface EndpointUrlProps {
  /** The process ID (proc_*) */
  processId: string;
  /** Whether the process has a published version (SANDBOX or PRODUCTION) */
  isPublished: boolean;
  /** Optional class name for styling */
  className?: string;
  /** Current selected environment - Story 5.1 */
  environment?: "SANDBOX" | "PRODUCTION";
}

/**
 * EndpointUrl Component
 *
 * Displays the API endpoint URL for a process with copy-to-clipboard functionality.
 * Shows different states based on whether the process has a published version.
 *
 * AC: 3 - Prominent Display: Displays endpoint URL prominently on process detail page
 * AC: 4 - One-Click Copy: Copy button copies full URL with toast confirmation
 *
 * @see docs/stories/3-1-endpoint-url-generation.md
 */
export function EndpointUrl({
  processId,
  isPublished,
  className,
  environment = "SANDBOX",
}: EndpointUrlProps) {
  const [copied, setCopied] = useState(false);

  // Build the full endpoint URL using the base URL
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Story 5.1 AC: 7 - Environment-specific URLs
  // Sandbox: /api/v1/sandbox/intelligence/:processId/generate
  // Production: /api/v1/intelligence/:processId/generate
  const endpointUrl =
    environment === "SANDBOX"
      ? `${baseUrl}/api/v1/sandbox/intelligence/${processId}/generate`
      : `${baseUrl}/api/v1/intelligence/${processId}/generate`;

  /**
   * Copy the endpoint URL to clipboard with toast confirmation.
   */
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(endpointUrl);
      setCopied(true);
      toast.success("URL copied to clipboard");

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          API Endpoint
        </span>
        {/* Status indicator (AC: 3 - Show status indicator) */}
        <Badge
          variant={isPublished ? "default" : "secondary"}
          className={cn(
            "text-xs",
            isPublished
              ? "bg-green-500/10 text-green-600 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-800"
              : "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
          )}
        >
          {isPublished ? "Active" : "Draft"}
        </Badge>
      </div>

      {/* URL display with code-like appearance (AC: 3 - Monospace font, code-like appearance) */}
      <div className="flex items-stretch gap-2">
        <div
          className={cn(
            "flex-1 flex items-center px-3 py-2 rounded-md border font-mono text-sm",
            "bg-muted/50 dark:bg-muted/30",
            !isPublished && "opacity-60"
          )}
        >
          <code className="truncate">{endpointUrl}</code>
        </div>

        {/* Copy button (AC: 4 - One-click copy with toast confirmation) */}
        <Button
          variant="outline"
          size="icon"
          onClick={copyToClipboard}
          className="shrink-0"
          aria-label="Copy URL to clipboard"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Draft state message (AC: 6 - Show message for draft-only processes) */}
      {!isPublished && (
        <p className="text-xs text-muted-foreground">
          This endpoint is not yet callable. Publish a version to enable API access.
        </p>
      )}
    </div>
  );
}
