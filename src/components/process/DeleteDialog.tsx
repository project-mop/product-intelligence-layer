"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";

const deleteFormSchema = z.object({
  confirmName: z.string().min(1, "Please type the intelligence name to confirm"),
});

type DeleteFormData = z.infer<typeof deleteFormSchema>;

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  process: {
    id: string;
    name: string;
  };
  onDeleted?: () => void;
}

export function DeleteDialog({
  open,
  onOpenChange,
  process,
  onDeleted,
}: DeleteDialogProps) {
  const utils = api.useUtils();
  const [hasPublishedVersions, setHasPublishedVersions] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<DeleteFormData>({
    resolver: zodResolver(deleteFormSchema),
    defaultValues: {
      confirmName: "",
    },
  });

  const confirmName = watch("confirmName");
  const isNameMatch = confirmName === process.name;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset({ confirmName: "" });
    }
  }, [open, reset]);

  // Check for published versions when dialog opens
  const { data: processData } = api.process.get.useQuery(
    { id: process.id },
    { enabled: open }
  );

  useEffect(() => {
    if (processData) {
      const published = processData.versions?.some(
        (v) => v.environment === "SANDBOX" || v.environment === "PRODUCTION"
      );
      setHasPublishedVersions(published ?? false);
    }
  }, [processData]);

  const deleteMutation = api.process.delete.useMutation({
    onSuccess: async () => {
      await utils.process.list.invalidate();
      onOpenChange(false);

      // Show toast with undo action (10 seconds)
      toast.success(`"${process.name}" has been deleted`, {
        duration: 10000,
        action: {
          label: "Undo",
          onClick: () => {
            restoreMutation.mutate({ id: process.id });
          },
        },
      });

      onDeleted?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete intelligence");
    },
  });

  const restoreMutation = api.process.restore.useMutation({
    onSuccess: async () => {
      await utils.process.list.invalidate();
      toast.success(`"${process.name}" has been restored`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to restore intelligence");
    },
  });

  const onSubmit = () => {
    if (!isNameMatch) return;
    deleteMutation.mutate({ id: process.id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Intelligence</DialogTitle>
          <DialogDescription>
            This action cannot be easily undone. The intelligence will be hidden
            from your workspace.
          </DialogDescription>
        </DialogHeader>

        {/* API Warning for published versions (AC: 7) */}
        {hasPublishedVersions && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This intelligence has published API endpoints that will be disabled.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirmName">
              Type <span className="font-semibold">{process.name}</span> to confirm
            </Label>
            <Input
              id="confirmName"
              placeholder="Enter intelligence name"
              {...register("confirmName")}
              disabled={deleteMutation.isPending}
              autoComplete="off"
            />
            {errors.confirmName && (
              <p className="text-sm text-destructive">{errors.confirmName.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!isNameMatch || deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
