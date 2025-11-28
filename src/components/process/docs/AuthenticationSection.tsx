"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Copy, Check, Key, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface AuthenticationSectionProps {
  /** Optional class name for styling */
  className?: string;
}

const AUTH_HEADER_EXAMPLE = "Authorization: Bearer your_api_key_here";

/**
 * AuthenticationSection Component
 *
 * Displays authentication requirements for the API including
 * Bearer token format and link to API keys page.
 *
 * AC: 3 - Authentication Section: Shows Bearer token auth method with example header
 * AC: 9 - Copy Functionality: Copy button for authentication header
 *
 * @see docs/stories/3-6-auto-generated-api-documentation.md
 */
export function AuthenticationSection({ className }: AuthenticationSectionProps) {
  const [copied, setCopied] = useState(false);

  /**
   * Copy the auth header format to clipboard with toast confirmation.
   */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(AUTH_HEADER_EXAMPLE);
      setCopied(true);
      toast.success("Header format copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy header");
    }
  }, []);

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Key className="h-4 w-4" />
          Authentication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          All API requests must include a valid API key in the Authorization header using the Bearer token scheme.
        </p>

        {/* Example header */}
        <div className="flex items-stretch gap-2">
          <div className="flex-1 flex items-center px-3 py-2 rounded-md border font-mono text-sm bg-muted/50 dark:bg-muted/30 overflow-hidden">
            <code className="truncate">{AUTH_HEADER_EXAMPLE}</code>
          </div>

          {/* Copy button (AC: 9) */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="shrink-0"
            aria-label="Copy authentication header to clipboard"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Link to API keys page */}
        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Need an API key? Manage your keys in the dashboard.
          </p>
          <Link href="/dashboard/api-keys">
            <Button variant="ghost" size="sm" className="gap-2">
              Manage API Keys
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {/* Note about environments */}
        <div className="rounded-md bg-blue-500/10 border border-blue-200 dark:border-blue-800 p-3">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Note:</strong> Use sandbox API keys for testing and production keys for live applications.
            Each environment has separate rate limits and quotas.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
