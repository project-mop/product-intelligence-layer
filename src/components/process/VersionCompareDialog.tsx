"use client";

import { ArrowLeftRight } from "lucide-react";

import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Skeleton } from "~/components/ui/skeleton";
import { EnvironmentBadge } from "./EnvironmentBadge";
import { VersionDiffView } from "./VersionDiffView";

export interface VersionCompareDialogProps {
  /** The process ID */
  processId: string;
  /** First version ID (left side) */
  version1Id: string;
  /** Second version ID (right side) */
  version2Id: string;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback to swap version positions */
  onSwap?: () => void;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * VersionCompareDialog Component
 *
 * Side-by-side comparison of two versions showing:
 * - Version info for both sides
 * - Diff highlighting (added=green, removed=red, modified=yellow)
 * - Swap button to switch version positions
 *
 * Story 5.4 AC: 5, 6 - Compare button allows selecting two versions for side-by-side diff
 */
export function VersionCompareDialog({
  processId,
  version1Id,
  version2Id,
  open,
  onOpenChange,
  onSwap,
}: VersionCompareDialogProps) {
  // Fetch diff between versions
  const {
    data: diffData,
    isLoading,
    error,
  } = api.process.diff.useQuery(
    { processId, version1Id, version2Id },
    { enabled: open }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Versions</DialogTitle>
          <DialogDescription>
            Side-by-side comparison of version changes
          </DialogDescription>
        </DialogHeader>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error.message || "Failed to load version comparison"}
            </AlertDescription>
          </Alert>
        )}

        {/* Diff content */}
        {diffData && !isLoading && (
          <div className="space-y-4">
            {/* Version headers */}
            <div className="grid grid-cols-2 gap-4">
              {/* Version 1 (left) */}
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">v{diffData.version1.version}</span>
                  <EnvironmentBadge
                    environment={diffData.version1.environment as "SANDBOX" | "PRODUCTION"}
                    size="sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(diffData.version1.createdAt)}
                </p>
              </div>

              {/* Version 2 (right) */}
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">v{diffData.version2.version}</span>
                  <EnvironmentBadge
                    environment={diffData.version2.environment as "SANDBOX" | "PRODUCTION"}
                    size="sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(diffData.version2.createdAt)}
                </p>
              </div>
            </div>

            {/* Swap button */}
            {onSwap && (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSwap}
                  className="text-muted-foreground"
                >
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Swap versions
                </Button>
              </div>
            )}

            {/* Diff view */}
            <VersionDiffView
              diff={{
                changes: diffData.changes,
                summary: diffData.summary,
                hasChanges: diffData.hasChanges,
                changeCount: diffData.changeCount,
              }}
              defaultExpanded={true}
            />

            {/* No changes message */}
            {!diffData.hasChanges && (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-muted-foreground">
                  These versions have identical configurations.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Close button */}
        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
