"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
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

export interface RollbackConfirmDialogProps {
  /** The process ID */
  processId: string;
  /** The version ID to rollback to */
  versionId: string;
  /** The version string (e.g., "2.0.0") for display */
  version: string;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when rollback is successful */
  onRollbackSuccess?: () => void;
}

/**
 * RollbackConfirmDialog Component
 *
 * Confirmation dialog for rolling back to a previous version.
 * Shows:
 * - Warning about creating a new sandbox version
 * - Explanation of the rollback behavior
 * - Optional change notes textarea
 *
 * Story 5.4 AC: 7, 8, 9 - Restore button creates new sandbox version with copied config
 */
export function RollbackConfirmDialog({
  processId,
  versionId,
  version,
  open,
  onOpenChange,
  onRollbackSuccess,
}: RollbackConfirmDialogProps) {
  const [changeNotes, setChangeNotes] = useState(`Restored from version ${version}`);
  const utils = api.useUtils();

  // Rollback mutation
  const rollbackMutation = api.process.rollback.useMutation({
    onSuccess: async (result) => {
      // Invalidate queries
      await Promise.all([
        utils.process.get.invalidate({ id: processId }),
        utils.process.getHistory.invalidate({ processId }),
        utils.process.listVersions.invalidate({ id: processId }),
        utils.process.list.invalidate(),
        utils.process.listWithStats.invalidate(),
      ]);

      toast.success(
        `Successfully restored to v${result.newVersion.version}`,
        {
          description: `New sandbox version created from v${result.sourceVersion.version}`,
        }
      );

      setChangeNotes(`Restored from version ${version}`);
      onOpenChange(false);
      onRollbackSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to rollback version");
    },
  });

  const handleRollback = () => {
    rollbackMutation.mutate({
      processId,
      targetVersionId: versionId,
      changeNotes: changeNotes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Restore Version
          </DialogTitle>
          <DialogDescription>
            Restore configuration from version {version}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This will create a <strong>new sandbox version</strong> based on v{version}.
              The original version will remain unchanged in your history.
            </AlertDescription>
          </Alert>

          {/* Explanation */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground space-y-2">
            <p>
              <strong>What happens next:</strong>
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>A new sandbox version will be created with the configuration from v{version}</li>
              <li>Your current sandbox version (if any) will be deprecated</li>
              <li>You can test the restored version in sandbox before promoting to production</li>
            </ul>
          </div>

          {/* Change Notes */}
          <div className="space-y-2">
            <Label htmlFor="changeNotes">Change Notes</Label>
            <Textarea
              id="changeNotes"
              placeholder="Describe why you're restoring this version..."
              value={changeNotes}
              onChange={(e) => setChangeNotes(e.target.value)}
              rows={2}
              disabled={rollbackMutation.isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={rollbackMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRollback}
            disabled={rollbackMutation.isPending}
          >
            {rollbackMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore Version
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
