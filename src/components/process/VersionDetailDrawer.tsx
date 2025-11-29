"use client";

import { GitCompare, Loader2, RotateCcw, X } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Separator } from "~/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { EnvironmentBadge } from "./EnvironmentBadge";
import { useState } from "react";

export interface VersionDetailDrawerProps {
  /** The process ID */
  processId: string;
  /** The version ID to display */
  versionId: string;
  /** Whether the drawer is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when compare is clicked */
  onCompare?: (versionId: string) => void;
  /** Callback when rollback is clicked */
  onRollback?: (versionId: string, version: string) => void;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusVariant(
  status: string
): "default" | "secondary" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "DRAFT":
      return "secondary";
    case "DEPRECATED":
      return "outline";
    default:
      return "outline";
  }
}

/**
 * VersionDetailDrawer Component
 *
 * Slide-out drawer showing full version details:
 * - Version number, environment, status
 * - System prompt (collapsible)
 * - Input/output schemas (JSON viewer)
 * - Change notes
 * - Actions: Compare, Restore
 *
 * Story 5.4 AC: 4 - Clicking a version shows full configuration details
 */
export function VersionDetailDrawer({
  processId,
  versionId,
  open,
  onOpenChange,
  onCompare,
  onRollback,
}: VersionDetailDrawerProps) {
  const [promptExpanded, setPromptExpanded] = useState(false);

  // Fetch version details
  const {
    data: version,
    isLoading,
    error,
  } = api.process.getVersionDetails.useQuery(
    { processId, versionId },
    { enabled: open }
  );

  // Get config from version
  const config = version?.config as {
    systemPrompt?: string;
    additionalInstructions?: string;
    maxTokens?: number;
    temperature?: number;
    goal?: string;
    cacheTtlSeconds?: number;
    cacheEnabled?: boolean;
  } | null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Version Details
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 ml-auto"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetTitle>
          <SheetDescription>
            Full configuration for this version
          </SheetDescription>
        </SheetHeader>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-4 mt-4">
            <p className="text-sm text-destructive">
              Failed to load version details: {error.message}
            </p>
          </div>
        )}

        {/* Version details */}
        {version && !isLoading && (
          <div className="mt-6 space-y-6">
            {/* Version info header */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">v{version.version}</span>
                <EnvironmentBadge
                  environment={version.environment as "SANDBOX" | "PRODUCTION"}
                  size="md"
                />
                <Badge
                  variant={getStatusVariant(version.status)}
                  className="text-xs capitalize"
                >
                  {version.status.toLowerCase()}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Created</span>
                <span>{formatDate(version.createdAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Published</span>
                <span>{formatDate(version.publishedAt)}</span>
              </div>
              {version.deprecatedAt && (
                <div>
                  <span className="text-muted-foreground block">Deprecated</span>
                  <span>{formatDate(version.deprecatedAt)}</span>
                </div>
              )}
              {version.promotedBy && (
                <div>
                  <span className="text-muted-foreground block">Promoted By</span>
                  <span className="font-mono text-xs">{version.promotedBy}</span>
                </div>
              )}
            </div>

            {/* Change Notes */}
            {version.changeNotes && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2">Change Notes</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {version.changeNotes}
                  </p>
                </div>
              </>
            )}

            <Separator />

            {/* Configuration */}
            {config && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Configuration</h4>

                {/* Goal */}
                {config.goal && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Goal</span>
                    <p className="text-sm">{config.goal}</p>
                  </div>
                )}

                {/* System Prompt */}
                {config.systemPrompt && (
                  <Collapsible open={promptExpanded} onOpenChange={setPromptExpanded}>
                    <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${promptExpanded ? "rotate-180" : ""}`}
                      />
                      System Prompt ({config.systemPrompt.length} chars)
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="mt-2 p-3 rounded-md bg-muted text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                        {config.systemPrompt}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Model settings */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {config.maxTokens && (
                    <div>
                      <span className="text-xs text-muted-foreground block">Max Tokens</span>
                      <span>{config.maxTokens}</span>
                    </div>
                  )}
                  {config.temperature !== undefined && (
                    <div>
                      <span className="text-xs text-muted-foreground block">Temperature</span>
                      <span>{config.temperature}</span>
                    </div>
                  )}
                  {config.cacheTtlSeconds !== undefined && (
                    <div>
                      <span className="text-xs text-muted-foreground block">Cache TTL</span>
                      <span>{config.cacheTtlSeconds}s</span>
                    </div>
                  )}
                  {config.cacheEnabled !== undefined && (
                    <div>
                      <span className="text-xs text-muted-foreground block">Cache Enabled</span>
                      <span>{config.cacheEnabled ? "Yes" : "No"}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Schemas */}
            {version.process && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Schemas</h4>

                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                      <ChevronDown className="h-4 w-4" />
                      Input Schema
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="mt-2 p-3 rounded-md bg-muted text-xs overflow-x-auto font-mono">
                        {JSON.stringify(version.process.inputSchema, null, 2)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                      <ChevronDown className="h-4 w-4" />
                      Output Schema
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="mt-2 p-3 rounded-md bg-muted text-xs overflow-x-auto font-mono">
                        {JSON.stringify(version.process.outputSchema, null, 2)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </>
            )}

            <Separator />

            {/* Actions */}
            <div className="flex items-center gap-2">
              {onCompare && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCompare(versionId)}
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare with...
                </Button>
              )}
              {onRollback && version.status !== "ACTIVE" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRollback(versionId, version.version)}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore this version
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
