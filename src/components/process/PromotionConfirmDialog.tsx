"use client";

import { useState } from "react";
import { AlertTriangle, ArrowUpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Skeleton } from "~/components/ui/skeleton";
import { EnvironmentBadge } from "./EnvironmentBadge";
import { VersionDiffView } from "./VersionDiffView";

export interface PromotionConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The process ID */
  processId: string;
  /** The version ID to promote */
  versionId: string;
  /** Callback when promotion is successful */
  onPromoted?: () => void;
}

/**
 * PromotionConfirmDialog Component
 *
 * Confirmation dialog for promoting a sandbox version to production.
 * Shows:
 * - Source version info
 * - Current production version info (if exists) with diff
 * - Warning about cache invalidation
 * - Optional change notes textarea
 *
 * Story 5.3 AC: 2, 3, 4 - Confirmation dialog with change summary, diff, cache warning
 */
export function PromotionConfirmDialog({
  open,
  onOpenChange,
  processId,
  versionId,
  onPromoted,
}: PromotionConfirmDialogProps) {
  const [changeNotes, setChangeNotes] = useState("");
  const utils = api.useUtils();

  // Fetch promotion preview when dialog opens
  const {
    data: preview,
    isLoading: isLoadingPreview,
    error: previewError,
  } = api.process.getPromotionPreview.useQuery(
    { processId, versionId },
    { enabled: open }
  );

  // Promotion mutation
  const promoteMutation = api.process.promoteToProduction.useMutation({
    onSuccess: async (result) => {
      // Invalidate queries
      await Promise.all([
        utils.process.get.invalidate({ id: processId }),
        utils.process.listVersions.invalidate({ id: processId }),
        utils.process.list.invalidate(),
        utils.process.listWithStats.invalidate(),
      ]);

      toast.success(
        `Successfully promoted to production (v${result.promotedVersion.version})`,
        {
          description: result.cacheInvalidated > 0
            ? `${result.cacheInvalidated} cache entries cleared`
            : undefined,
        }
      );

      setChangeNotes("");
      onOpenChange(false);
      onPromoted?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to promote to production");
    },
  });

  const handlePromote = () => {
    promoteMutation.mutate({
      processId,
      versionId,
      changeNotes: changeNotes.trim() || undefined,
    });
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5" />
            Promote to Production
          </DialogTitle>
          <DialogDescription>
            This will deploy the sandbox version to your production API endpoint.
          </DialogDescription>
        </DialogHeader>

        {/* Loading State */}
        {isLoadingPreview && (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {/* Error State */}
        {previewError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {previewError.message || "Failed to load promotion preview"}
            </AlertDescription>
          </Alert>
        )}

        {/* Preview Content */}
        {preview && !isLoadingPreview && (
          <div className="space-y-4">
            {/* Source Version Info */}
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Source Version</span>
                <EnvironmentBadge environment="SANDBOX" size="sm" />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Version: v{preview.sourceVersion.version}</p>
                <p>Created: {formatDate(preview.sourceVersion.createdAt)}</p>
              </div>
            </div>

            {/* Current Production Version (if exists) */}
            {preview.currentProductionVersion && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Current Production</span>
                  <EnvironmentBadge environment="PRODUCTION" size="sm" />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Version: v{preview.currentProductionVersion.version}</p>
                  <p>Published: {formatDate(preview.currentProductionVersion.publishedAt)}</p>
                </div>
              </div>
            )}

            {/* Version Diff */}
            {preview.currentProductionVersion && preview.diff && (
              <VersionDiffView diff={preview.diff} />
            )}

            {/* First Production Notice */}
            {!preview.currentProductionVersion && (
              <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                This will be your first production deployment for this intelligence.
              </div>
            )}

            {/* Cache Warning */}
            {preview.cacheEntryCount > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {preview.cacheEntryCount} cached response{preview.cacheEntryCount !== 1 ? "s" : ""} will be cleared.
                </AlertDescription>
              </Alert>
            )}

            {/* Change Notes */}
            <div className="space-y-2">
              <Label htmlFor="changeNotes">Change Notes (optional)</Label>
              <Textarea
                id="changeNotes"
                placeholder="Describe what changed in this version..."
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                rows={3}
                disabled={promoteMutation.isPending}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={promoteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePromote}
            disabled={isLoadingPreview || !!previewError || promoteMutation.isPending}
          >
            {promoteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Promoting...
              </>
            ) : (
              "Promote to Production"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
