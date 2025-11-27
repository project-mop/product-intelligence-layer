"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Diff } from "lucide-react";
import type { JSONSchema7 } from "json-schema";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { WizardData } from "./types";

/**
 * Diff status for a field.
 */
type DiffStatus = "unchanged" | "added" | "removed" | "modified";

/**
 * Get style classes for diff status.
 */
function getDiffClasses(status: DiffStatus): string {
  switch (status) {
    case "added":
      return "bg-green-50 border-green-200 text-green-800";
    case "removed":
      return "bg-red-50 border-red-200 text-red-800";
    case "modified":
      return "bg-yellow-50 border-yellow-200 text-yellow-800";
    default:
      return "";
  }
}

/**
 * Get badge variant for diff status.
 */
function getDiffBadgeVariant(status: DiffStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "added":
      return "default";
    case "removed":
      return "destructive";
    case "modified":
      return "secondary";
    default:
      return "outline";
  }
}

/**
 * Compare two JSON schemas and return diff status.
 */
function compareSchemas(current: JSONSchema7, original: JSONSchema7): DiffStatus {
  const currentStr = JSON.stringify(current);
  const originalStr = JSON.stringify(original);
  return currentStr === originalStr ? "unchanged" : "modified";
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
 * Compare two values and return diff status.
 */
function compareValues(current: unknown, original: unknown): DiffStatus {
  if (current === original) return "unchanged";
  if (original === undefined || original === null || original === "") return "added";
  if (current === undefined || current === null || current === "") return "removed";
  return "modified";
}

interface DiffRowProps {
  label: string;
  currentValue: string;
  originalValue: string;
  status: DiffStatus;
}

/**
 * Single row showing a diff comparison.
 */
function DiffRow({ label, currentValue, originalValue, status }: DiffRowProps) {
  if (status === "unchanged") return null;

  return (
    <div className={cn("rounded-md border p-3 text-sm", getDiffClasses(status))}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">{label}</span>
        <Badge variant={getDiffBadgeVariant(status)} className="text-xs">
          {status}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-muted-foreground block mb-1">Current:</span>
          <span className="font-mono break-all">
            {currentValue || "(empty)"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block mb-1">Published:</span>
          <span className="font-mono break-all">
            {originalValue || "(empty)"}
          </span>
        </div>
      </div>
    </div>
  );
}

interface VersionDiffProps {
  currentData: WizardData;
  originalData: WizardData;
}

/**
 * VersionDiff Component
 *
 * Shows side-by-side comparison of draft vs published version.
 * Highlights changed fields with color coding:
 * - Green (added): Field exists in draft but not in published
 * - Red (removed): Field exists in published but not in draft
 * - Yellow (modified): Field exists in both but values differ
 *
 * AC 5: Diff view available when editing a published intelligence.
 */
export function VersionDiff({ currentData, originalData }: VersionDiffProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Compare each field
  const nameDiff = compareValues(currentData.name, originalData.name);
  const descDiff = compareValues(currentData.description, originalData.description);
  const goalDiff = compareValues(currentData.goal, originalData.goal);
  const inputSchemaDiff = compareSchemas(currentData.inputSchema, originalData.inputSchema);
  const outputSchemaDiff = compareSchemas(currentData.outputSchema, originalData.outputSchema);
  const outputTypeDiff = compareValues(currentData.outputType, originalData.outputType);

  // Calculate total changes
  const changes = [
    nameDiff,
    descDiff,
    goalDiff,
    inputSchemaDiff,
    outputSchemaDiff,
    outputTypeDiff,
  ].filter((d) => d !== "unchanged");

  const hasChanges = changes.length > 0;

  if (!hasChanges) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        <Diff className="h-5 w-5 mx-auto mb-2 opacity-50" />
        No changes detected compared to the published version.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Diff className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Compare Changes</p>
            <p className="text-xs text-muted-foreground">
              {changes.length} field{changes.length !== 1 ? "s" : ""} modified from
              published version
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{changes.length} changes</Badge>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t p-4 space-y-3">
          <DiffRow
            label="Name"
            currentValue={currentData.name}
            originalValue={originalData.name}
            status={nameDiff}
          />
          <DiffRow
            label="Description"
            currentValue={currentData.description ?? ""}
            originalValue={originalData.description ?? ""}
            status={descDiff}
          />
          <DiffRow
            label="Goal"
            currentValue={currentData.goal}
            originalValue={originalData.goal}
            status={goalDiff}
          />
          <DiffRow
            label="Output Type"
            currentValue={currentData.outputType}
            originalValue={originalData.outputType}
            status={outputTypeDiff}
          />

          {/* Input Schema diff */}
          {inputSchemaDiff !== "unchanged" && (
            <div className={cn("rounded-md border p-3 text-sm", getDiffClasses(inputSchemaDiff))}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Input Schema</span>
                <Badge variant={getDiffBadgeVariant(inputSchemaDiff)} className="text-xs">
                  {inputSchemaDiff}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-1">
                    Current Fields:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {getFieldNames(currentData.inputSchema).map((f) => (
                      <Badge key={f} variant="outline" className="font-mono text-xs">
                        {f}
                      </Badge>
                    )) || <span className="text-muted-foreground">(none)</span>}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">
                    Published Fields:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {getFieldNames(originalData.inputSchema).map((f) => (
                      <Badge key={f} variant="outline" className="font-mono text-xs">
                        {f}
                      </Badge>
                    )) || <span className="text-muted-foreground">(none)</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Output Schema diff */}
          {outputSchemaDiff !== "unchanged" && (
            <div className={cn("rounded-md border p-3 text-sm", getDiffClasses(outputSchemaDiff))}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Output Schema</span>
                <Badge variant={getDiffBadgeVariant(outputSchemaDiff)} className="text-xs">
                  {outputSchemaDiff}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-1">
                    Current Fields:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {getFieldNames(currentData.outputSchema).map((f) => (
                      <Badge key={f} variant="outline" className="font-mono text-xs">
                        {f}
                      </Badge>
                    )) || <span className="text-muted-foreground">(none)</span>}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">
                    Published Fields:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {getFieldNames(originalData.outputSchema).map((f) => (
                      <Badge key={f} variant="outline" className="font-mono text-xs">
                        {f}
                      </Badge>
                    )) || <span className="text-muted-foreground">(none)</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(false)}
            >
              Collapse
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
