"use client";

import { useState, useCallback } from "react";
import type { JSONSchema7 } from "json-schema";

import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { SchemaBuilder, jsonSchemaToFields, validateSchema } from "../SchemaBuilder";
import type { StepProps, OutputType } from "../types";

/**
 * Step 4: Output Schema
 *
 * Defines what format the intelligence should return.
 * Can be simple text or structured JSON.
 */
export function OutputSchemaStep({
  data,
  onDataChange,
  onNext,
  onBack,
}: StepProps) {
  const [showErrors, setShowErrors] = useState(false);

  const handleOutputTypeChange = useCallback(
    (isStructured: boolean) => {
      const outputType: OutputType = isStructured ? "structured" : "text";
      onDataChange({
        outputType,
        // Reset schema when switching to text mode
        outputSchema: isStructured
          ? data.outputSchema
          : {
              type: "object",
              properties: {
                text: {
                  type: "string",
                  description: "The generated text output",
                },
              },
              required: ["text"],
            },
      });
    },
    [onDataChange, data.outputSchema]
  );

  const handleSchemaChange = useCallback(
    (schema: JSONSchema7) => {
      onDataChange({ outputSchema: schema });
    },
    [onDataChange]
  );

  const handleNext = () => {
    if (data.outputType === "structured") {
      const fields = jsonSchemaToFields(data.outputSchema);
      if (!validateSchema(fields)) {
        setShowErrors(true);
        return;
      }
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Define Output Format</h2>
        <p className="text-sm text-muted-foreground">
          Choose how this intelligence should return its results
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label
            htmlFor="output-type"
            className="text-base font-medium cursor-pointer"
          >
            Structured JSON Output
          </Label>
          <p className="text-sm text-muted-foreground">
            {data.outputType === "structured"
              ? "Return structured data with defined fields"
              : "Return simple text response"}
          </p>
        </div>
        <Switch
          id="output-type"
          checked={data.outputType === "structured"}
          onCheckedChange={handleOutputTypeChange}
        />
      </div>

      {data.outputType === "structured" ? (
        <>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Tip:</strong> Define the exact fields you want in the
              response. For example, a product description generator might
              return: short description, long description, and bullet points.
            </p>
          </div>

          <SchemaBuilder
            initialSchema={data.outputSchema}
            onChange={handleSchemaChange}
            showErrors={showErrors}
          />
        </>
      ) : (
        <div className="rounded-lg border bg-muted/30 p-6 text-center">
          <p className="text-muted-foreground">
            The intelligence will return a single text response based on your
            goal statement.
          </p>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext}>Next</Button>
      </div>
    </div>
  );
}
