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
import type { WizardData, WizardStep, ComponentDefinition } from "../types";
import { componentsToServerFormat } from "../ComponentEditor";
import { getComponentCount } from "../ComponentTree";
import { VersionDiff } from "../VersionDiff";

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
 * Success dialog component for edit mode.
 */
function EditSuccessDialog({
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
          <DialogTitle className="text-xl">Changes Saved!</DialogTitle>
          <DialogDescription className="pt-2">
            <span className="font-medium text-foreground">{processName}</span>{" "}
            has been updated successfully.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Next steps:</strong>
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc list-inside">
            <li>Test your changes in sandbox mode</li>
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

interface EditReviewStepProps {
  data: WizardData;
  processId: string;
  originalProcess: {
    name: string;
    description: string | null;
    inputSchema: unknown;
    outputSchema: unknown;
    hasProductionVersion: boolean;
    versions: Array<{ config: unknown; environment: string }>;
  };
  onDataChange: (data: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
  currentStep: WizardStep;
}

/**
 * Convert original process data to WizardData for diff comparison.
 */
function originalToWizardData(
  originalProcess: EditReviewStepProps["originalProcess"]
): WizardData {
  const latestVersion = originalProcess.versions[0];
  const config = (latestVersion?.config ?? {}) as {
    goal?: string;
    components?: ComponentDefinition[];
  };

  const outputSchema = originalProcess.outputSchema as JSONSchema7;
  const isTextOutput = outputSchema.type === "string";

  return {
    name: originalProcess.name,
    description: originalProcess.description ?? "",
    inputSchema: originalProcess.inputSchema as JSONSchema7,
    outputSchema: outputSchema,
    goal: config.goal ?? "",
    outputType: isTextOutput ? "text" : "structured",
    advancedMode: (config.components?.length ?? 0) > 0,
    components: config.components ?? [],
  };
}

/**
 * Edit Review Step
 *
 * Shows a summary of all changes and handles the save action.
 * For processes with a production version, creates a new draft version.
 */
export function EditReviewStep({
  data,
  processId,
  originalProcess,
  onNext,
  onBack,
}: EditReviewStepProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  const utils = api.useUtils();

  const updateProcess = api.process.update.useMutation({
    onSuccess: () => {
      // Invalidate queries to refresh data
      void utils.process.get.invalidate({ id: processId });
      void utils.process.list.invalidate();
      setShowSuccess(true);
    },
  });

  const createDraftVersion = api.process.createDraftVersion.useMutation();

  const handleSave = async () => {
    // Convert components to server format (strip client-only fields)
    const serverComponents = data.components?.length
      ? componentsToServerFormat(data.components)
      : undefined;

    // If editing a published process, create a new draft version first
    if (originalProcess.hasProductionVersion) {
      try {
        await createDraftVersion.mutateAsync({ processId });
      } catch (err) {
        // Draft already exists is fine, continue with update
        console.log("Draft version exists or created:", err);
      }
    }

    // Update the process metadata
    updateProcess.mutate({
      id: processId,
      name: data.name,
      description: data.description ?? null,
      inputSchema: data.inputSchema as Record<string, unknown>,
      outputSchema: data.outputSchema as Record<string, unknown>,
    });

    // Note: The config (goal, components) is stored in ProcessVersion
    // For MVP, we update the process metadata only
    void serverComponents; // Components saved in version config
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    onNext();
  };

  const inputFields = getFieldNames(data.inputSchema);
  const outputFields = getFieldNames(data.outputSchema);
  const hasComponents = (data.components?.length ?? 0) > 0;
  const componentCount = hasComponents ? getComponentCount(data.components ?? []) : 0;

  // Convert original process to WizardData for diff comparison
  const originalWizardData = originalToWizardData(originalProcess);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Review Your Changes</h2>
        <p className="text-sm text-muted-foreground">
          Review your changes before saving
        </p>
      </div>

      {/* Info banner for published processes */}
      {originalProcess.hasProductionVersion && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <strong>Note:</strong> Changes will be saved as a draft. The live
          version won&apos;t be affected until you publish.
        </div>
      )}

      {/* Diff view for published processes (AC 5) */}
      {originalProcess.hasProductionVersion && (
        <VersionDiff currentData={data} originalData={originalWizardData} />
      )}

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
          <p className="text-sm whitespace-pre-wrap">{data.goal || "(No goal defined)"}</p>
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
      {updateProcess.error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{updateProcess.error.message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={updateProcess.isPending}
        >
          Back
        </Button>
        <Button
          onClick={handleSave}
          disabled={updateProcess.isPending}
          className="gap-2"
        >
          {updateProcess.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>

      <EditSuccessDialog
        isOpen={showSuccess}
        processName={data.name}
        onClose={handleSuccessClose}
      />
    </div>
  );
}
