"use client";

import { ChevronDown, ChevronUp, Diff } from "lucide-react";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";
import type { VersionDiff, VersionChange } from "~/server/services/process/version-diff";

/**
 * Get style classes for diff change type.
 */
function getChangeClasses(type: "added" | "removed" | "modified"): string {
  switch (type) {
    case "added":
      return "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300";
    case "removed":
      return "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300";
    case "modified":
      return "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300";
  }
}

/**
 * Get badge variant for change type.
 */
function getBadgeVariant(type: "added" | "removed" | "modified"): "default" | "secondary" | "destructive" {
  switch (type) {
    case "added":
      return "default";
    case "removed":
      return "destructive";
    case "modified":
      return "secondary";
  }
}

/**
 * Format a field path for display.
 */
function formatPath(path: string): string {
  // Remove "config." prefix and format camelCase
  return path
    .replace(/^config\./, "")
    .split(".")
    .map((part) =>
      part
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .trim()
    )
    .join(" → ");
}

/**
 * Format a value for display.
 */
function formatValue(value: unknown, maxLength = 100): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    if (value.length > maxLength) {
      return `"${value.substring(0, maxLength)}..."`;
    }
    return `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    return `{${keys.length} fields}`;
  }
  return String(value);
}

interface ChangeRowProps {
  change: VersionChange;
}

/**
 * Single row showing a change.
 */
function ChangeRow({ change }: ChangeRowProps) {
  return (
    <div className={cn("rounded-md border p-3 text-sm", getChangeClasses(change.type))}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{formatPath(change.path)}</span>
        <Badge variant={getBadgeVariant(change.type)} className="text-xs capitalize">
          {change.type}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs">
        {change.type === "removed" ? (
          <div className="col-span-2">
            <span className="text-muted-foreground block mb-1">Removed value:</span>
            <span className="font-mono break-all">
              {formatValue(change.oldValue)}
            </span>
          </div>
        ) : change.type === "added" ? (
          <div className="col-span-2">
            <span className="text-muted-foreground block mb-1">New value:</span>
            <span className="font-mono break-all">
              {formatValue(change.newValue)}
            </span>
          </div>
        ) : (
          <>
            <div>
              <span className="text-muted-foreground block mb-1">Current (Production):</span>
              <span className="font-mono break-all">
                {formatValue(change.oldValue)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">New (Sandbox):</span>
              <span className="font-mono break-all">
                {formatValue(change.newValue)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export interface VersionDiffViewProps {
  /** The diff to display */
  diff: VersionDiff;
  /** Whether to start expanded */
  defaultExpanded?: boolean;
}

/**
 * VersionDiffView Component
 *
 * Displays changes between sandbox and production versions.
 * Shows a summary with expandable details for each change.
 *
 * Story 5.3 AC: 3 - Confirmation dialog shows diff from current production version
 */
export function VersionDiffView({ diff, defaultExpanded = false }: VersionDiffViewProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!diff.hasChanges) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        <Diff className="h-5 w-5 mx-auto mb-2 opacity-50" />
        {diff.summary}
      </div>
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between p-3 rounded-lg border text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Diff className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Changes from Production</p>
              <p className="text-xs text-muted-foreground">{diff.summary}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {diff.changeCount.added > 0 && (
              <Badge variant="default" className="text-xs">
                +{diff.changeCount.added}
              </Badge>
            )}
            {diff.changeCount.modified > 0 && (
              <Badge variant="secondary" className="text-xs">
                ~{diff.changeCount.modified}
              </Badge>
            )}
            {diff.changeCount.removed > 0 && (
              <Badge variant="destructive" className="text-xs">
                -{diff.changeCount.removed}
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2 pl-2">
          {diff.changes.map((change, index) => (
            <ChangeRow key={`${change.path}-${index}`} change={change} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
