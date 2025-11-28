"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface EndpointSectionProps {
  /** The process ID (proc_*) */
  processId: string;
  /** Optional class name for styling */
  className?: string;
}

/**
 * EndpointSection Component
 *
 * Displays the API endpoint URL with HTTP method badge and copy functionality.
 *
 * AC: 2 - Endpoint URL Display: Shows complete endpoint URL with base domain
 * AC: 9 - Copy Functionality: Copy button for endpoint URL
 *
 * @see docs/stories/3-6-auto-generated-api-documentation.md
 */
export function EndpointSection({ processId, className }: EndpointSectionProps) {
  const [copied, setCopied] = useState(false);

  // Build the full endpoint URL using the base URL
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const endpointUrl = `${baseUrl}/api/v1/intelligence/${processId}/generate`;

  /**
   * Copy the endpoint URL to clipboard with toast confirmation.
   */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(endpointUrl);
      setCopied(true);
      toast.success("Endpoint URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy URL");
    }
  }, [endpointUrl]);

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Endpoint</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          {/* HTTP Method Badge */}
          <Badge className="bg-green-500/10 text-green-600 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-800">
            POST
          </Badge>

          {/* URL Display */}
          <div className="flex-1 flex items-stretch gap-2">
            <div className="flex-1 flex items-center px-3 py-2 rounded-md border font-mono text-sm bg-muted/50 dark:bg-muted/30 overflow-hidden">
              <code className="truncate">{endpointUrl}</code>
            </div>

            {/* Copy button (AC: 9) */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="shrink-0"
              aria-label="Copy endpoint URL to clipboard"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Send a POST request with your input data to generate intelligence output.
        </p>
      </CardContent>
    </Card>
  );
}
