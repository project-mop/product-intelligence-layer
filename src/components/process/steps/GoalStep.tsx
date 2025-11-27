"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import type { StepProps } from "../types";

/**
 * Validation schema for Step 3 - Goal Statement.
 */
const goalStepSchema = z.object({
  goal: z
    .string()
    .min(1, "Goal statement is required")
    .max(1000, "Goal must be 1000 characters or less"),
});

type GoalStepData = z.infer<typeof goalStepSchema>;

/**
 * Step 3: Goal Statement
 *
 * Describes what the intelligence should accomplish.
 * This becomes part of the system prompt for the LLM.
 */
export function GoalStep({
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
  } = useForm<GoalStepData>({
    resolver: zodResolver(goalStepSchema),
    defaultValues: {
      goal: data.goal,
    },
    mode: "onChange",
  });

  const goalValue = watch("goal");

  const onSubmit = (formData: GoalStepData) => {
    onDataChange({ goal: formData.goal });
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Define Your Goal</h2>
        <p className="text-sm text-muted-foreground">
          Describe what this intelligence should accomplish with your product
          data
        </p>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <p className="text-sm font-medium">Tips for writing a good goal:</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Be specific about the desired output</li>
          <li>Include any formatting requirements</li>
          <li>Mention your target audience if relevant</li>
          <li>Describe the tone or style you want</li>
        </ul>
        <div className="pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            <strong>Example:</strong> &ldquo;Generate a compelling product
            description that highlights key features and benefits, optimized for
            ecommerce listings. The description should be professional yet
            engaging, suitable for a general consumer audience.&rdquo;
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal">
          Goal Statement <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="goal"
          placeholder="Describe what this intelligence should do with the input data..."
          {...register("goal")}
          className={`min-h-[150px] ${errors.goal ? "border-destructive" : ""}`}
        />
        <div className="flex justify-between text-xs">
          {errors.goal ? (
            <p className="text-destructive">{errors.goal.message}</p>
          ) : (
            <p className="text-muted-foreground">
              This guides the AI on how to process your data
            </p>
          )}
          <span className="text-muted-foreground">
            {goalValue?.length ?? 0}/1000
          </span>
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
