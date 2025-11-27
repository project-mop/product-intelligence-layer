"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

const duplicateFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or less"),
});

type DuplicateFormData = z.infer<typeof duplicateFormSchema>;

interface DuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  process: {
    id: string;
    name: string;
  };
  onSuccess?: (newProcessId: string) => void;
}

export function DuplicateDialog({
  open,
  onOpenChange,
  process,
  onSuccess,
}: DuplicateDialogProps) {
  const router = useRouter();
  const utils = api.useUtils();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DuplicateFormData>({
    resolver: zodResolver(duplicateFormSchema),
    defaultValues: {
      name: `${process.name} (Copy)`,
    },
  });

  // Reset form when dialog opens with new process
  useEffect(() => {
    if (open) {
      reset({ name: `${process.name} (Copy)` });
    }
  }, [open, process.name, reset]);

  const duplicateMutation = api.process.duplicate.useMutation({
    onSuccess: async (data) => {
      await utils.process.list.invalidate();
      toast.success("Intelligence duplicated successfully");
      onOpenChange(false);

      if (onSuccess) {
        onSuccess(data.process.id);
      } else {
        router.push(`/dashboard/processes/${data.process.id}/edit`);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to duplicate intelligence");
    },
  });

  const onSubmit = (data: DuplicateFormData) => {
    duplicateMutation.mutate({
      id: process.id,
      newName: data.name,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate Intelligence</DialogTitle>
          <DialogDescription>
            Create a copy of &quot;{process.name}&quot; with a new name. The
            duplicate will be created in sandbox mode.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Enter name for the duplicate"
              {...register("name")}
              disabled={duplicateMutation.isPending}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={duplicateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={duplicateMutation.isPending}>
              {duplicateMutation.isPending ? "Duplicating..." : "Duplicate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
