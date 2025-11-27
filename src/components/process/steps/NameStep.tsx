"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import type { StepProps } from "../types";

/**
 * Validation schema for Step 1 - Name & Description.
 */
const nameStepSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional(),
});

type NameStepData = z.infer<typeof nameStepSchema>;

/**
 * Step 1: Name and Description
 *
 * Collects the basic metadata for the intelligence definition.
 * Pre-fills from template if one was selected.
 */
export function NameStep({
  data,
  onDataChange,
  onNext,
  onBack,
}: StepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<NameStepData>({
    resolver: zodResolver(nameStepSchema),
    defaultValues: {
      name: data.name,
      description: data.description ?? "",
    },
    mode: "onChange",
  });

  const nameValue = watch("name");
  const descriptionValue = watch("description");

  const onSubmit = (formData: NameStepData) => {
    onDataChange({
      name: formData.name,
      description: formData.description,
    });
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Name Your Intelligence</h2>
        <p className="text-sm text-muted-foreground">
          Give your intelligence definition a clear, descriptive name
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="e.g., Product Description Generator"
            {...register("name")}
            className={errors.name ? "border-destructive" : undefined}
          />
          <div className="flex justify-between text-xs">
            {errors.name ? (
              <p className="text-destructive">{errors.name.message}</p>
            ) : (
              <p className="text-muted-foreground">
                A clear name helps you identify this intelligence later
              </p>
            )}
            <span className="text-muted-foreground">
              {nameValue?.length ?? 0}/100
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe what this intelligence does..."
            {...register("description")}
            className={`min-h-[100px] ${
              errors.description ? "border-destructive" : ""
            }`}
          />
          <div className="flex justify-between text-xs">
            {errors.description ? (
              <p className="text-destructive">{errors.description.message}</p>
            ) : (
              <p className="text-muted-foreground">Optional but recommended</p>
            )}
            <span className="text-muted-foreground">
              {descriptionValue?.length ?? 0}/500
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={!isValid}>
          Next
        </Button>
      </div>
    </form>
  );
}
