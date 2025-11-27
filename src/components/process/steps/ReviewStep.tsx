"use client";

import { useState } from "react";
import { Check, AlertCircle, Loader2, Layers } from "lucide-react";
import type { JSONSchema7 } from "json-schema";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { api } from "~/trpc/react";
import type { StepProps } from "../types";
import { componentsToServerFormat } from "../ComponentEditor";
import { getComponentCount } from "../ComponentTree";

/**
 * Get field count from JSON Schema.
 */
function getFieldCount(schema: JSONSchema7): number {
  if (schema.type !== "object" || !schema.properties) {
    return 0;
  }
  return Object.keys(schema.properties).length;
}

/**
 * Get field names from JSON Schema.
 */
function getFieldNames(schema: JSONSchema7): string[] {
  if (schema.type !== "object" || !schema.properties) {
    return [];
  }
  return Object.keys(schema.properties);
}

/**
 * Success dialog component.
 */
function SuccessDialog({
  isOpen,
  processName,
  onClose,
}: {
  isOpen: boolean;
  processName: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <DialogTitle className="text-xl">Intelligence Created!</DialogTitle>
          <DialogDescription className="pt-2">
            <span className="font-medium text-foreground">{processName}</span>{" "}
            has been created successfully and is ready to use in sandbox mode.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Next steps:</strong>
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc list-inside">
            <li>Test your intelligence with sample data</li>
            <li>Refine your input/output schema as needed</li>
            <li>Promote to production when ready</li>
          </ul>
        </div>
        <div className="mt-4 flex justify-center">
          <Button onClick={onClose} className="w-full sm:w-auto">
            View Intelligences
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Step 5: Review & Save
 *
 * Shows a summary of all entered data and handles the save action.
 */
export function ReviewStep({ data, onNext, onBack }: StepProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  const createProcess = api.process.create.useMutation({
    onSuccess: () => {
      setShowSuccess(true);
    },
  });

  const handleSave = () => {
    // Convert components to server format (strip client-only fields)
    const serverComponents = data.components?.length
      ? componentsToServerFormat(data.components)
      : undefined;

    createProcess.mutate({
      name: data.name,
      description: data.description,
      inputSchema: data.inputSchema as Record<string, unknown>,
      outputSchema: data.outputSchema as Record<string, unknown>,
      config: {
        goal: data.goal,
        inputSchemaDescription: `Input schema with ${getFieldCount(data.inputSchema)} fields`,
        outputSchemaDescription:
          data.outputType === "text"
            ? "Simple text output"
            : `Structured JSON with ${getFieldCount(data.outputSchema)} fields`,
        components: serverComponents,
      },
    });
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    onNext(); // This will navigate back to the processes list
  };

  const inputFields = getFieldNames(data.inputSchema);
  const outputFields = getFieldNames(data.outputSchema);
  const hasComponents = (data.components?.length ?? 0) > 0;
  const componentCount = hasComponents ? getComponentCount(data.components ?? []) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Review Your Intelligence</h2>
        <p className="text-sm text-muted-foreground">
          Review your configuration before saving
        </p>
      </div>

      {/* Summary sections */}
      <div className="space-y-4">
        {/* Name & Description */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Name & Description</h3>
            <Badge variant="secondary">Step 1</Badge>
          </div>
          <Separator className="my-3" />
          <div className="space-y-2">
            <div>
              <span className="text-sm text-muted-foreground">Name:</span>
              <p className="font-medium">{data.name}</p>
            </div>
            {data.description && (
              <div>
                <span className="text-sm text-muted-foreground">
                  Description:
                </span>
                <p className="text-sm">{data.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Input Schema */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Input Schema</h3>
            <Badge variant="secondary">Step 2</Badge>
          </div>
          <Separator className="my-3" />
          <div>
            <span className="text-sm text-muted-foreground">Fields:</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {inputFields.length > 0 ? (
                inputFields.map((field) => (
                  <Badge key={field} variant="outline">
                    {field}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  No fields defined
                </span>
              )}
            </div>
          </div>

          {/* Components (Advanced Mode) */}
          {hasComponents && (
            <>
              <Separator className="my-3" />
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Components:</span>
                </div>
                <div className="mt-2">
                  <Badge variant="outline">
                    {componentCount} component{componentCount !== 1 ? "s" : ""} defined
                  </Badge>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Advanced mode enabled with hierarchical components
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Goal */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Goal Statement</h3>
            <Badge variant="secondary">Step 3</Badge>
          </div>
          <Separator className="my-3" />
          <p className="text-sm whitespace-pre-wrap">{data.goal}</p>
        </div>

        {/* Output Schema */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Output Format</h3>
            <Badge variant="secondary">Step 4</Badge>
          </div>
          <Separator className="my-3" />
          <div>
            <span className="text-sm text-muted-foreground">Type:</span>
            <Badge variant="outline" className="ml-2">
              {data.outputType === "structured" ? "Structured JSON" : "Text"}
            </Badge>
          </div>
          {data.outputType === "structured" && (
            <div className="mt-2">
              <span className="text-sm text-muted-foreground">Fields:</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {outputFields.length > 0 ? (
                  outputFields.map((field) => (
                    <Badge key={field} variant="outline">
                      {field}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No fields defined
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {createProcess.error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{createProcess.error.message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={createProcess.isPending}
        >
          Back
        </Button>
        <Button
          onClick={handleSave}
          disabled={createProcess.isPending}
          className="gap-2"
        >
          {createProcess.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save as Draft"
          )}
        </Button>
      </div>

      <SuccessDialog
        isOpen={showSuccess}
        processName={data.name}
        onClose={handleSuccessClose}
      />
    </div>
  );
}
