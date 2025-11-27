"use client";

import { useState, useCallback } from "react";
import type { JSONSchema7 } from "json-schema";

import { Button } from "~/components/ui/button";
import { SchemaBuilder, jsonSchemaToFields, validateSchema } from "../SchemaBuilder";
import { validateComponents } from "../ComponentEditor";
import type { StepProps, ComponentDefinition } from "../types";

/**
 * Step 2: Input Schema
 *
 * Defines what data this intelligence will receive as input.
 * Uses the visual SchemaBuilder component.
 */
export function InputSchemaStep({
  data,
  onDataChange,
  onNext,
  onBack,
}: StepProps) {
  const [showErrors, setShowErrors] = useState(false);

  const handleSchemaChange = useCallback(
    (schema: JSONSchema7) => {
      onDataChange({ inputSchema: schema });
    },
    [onDataChange]
  );

  const handleAdvancedModeChange = useCallback(
    (enabled: boolean) => {
      onDataChange({ advancedMode: enabled });
    },
    [onDataChange]
  );

  const handleComponentsChange = useCallback(
    (components: ComponentDefinition[]) => {
      onDataChange({ components });
    },
    [onDataChange]
  );

  const handleNext = () => {
    const fields = jsonSchemaToFields(data.inputSchema);
    if (!validateSchema(fields)) {
      setShowErrors(true);
      return;
    }
    // If advanced mode is enabled, also validate components
    if (data.advancedMode && data.components && data.components.length > 0) {
      if (!validateComponents(data.components)) {
        setShowErrors(true);
        return;
      }
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Define Input Schema</h2>
        <p className="text-sm text-muted-foreground">
          What data will this intelligence receive? Define the fields your
          product data will contain.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Tip:</strong> Think about what product information you need to
          provide. For example, a product description generator might need:
          product name, category, and key attributes.
        </p>
      </div>

      <SchemaBuilder
        initialSchema={data.inputSchema}
        onChange={handleSchemaChange}
        showErrors={showErrors}
        advancedMode={data.advancedMode ?? false}
        onAdvancedModeChange={handleAdvancedModeChange}
        initialComponents={data.components}
        onComponentsChange={handleComponentsChange}
      />

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext}>Next</Button>
      </div>
    </div>
  );
}
