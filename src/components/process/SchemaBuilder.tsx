"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, Trash2, GripVertical, Settings2 } from "lucide-react";
import type { JSONSchema7 } from "json-schema";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card, CardContent } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { ComponentEditor } from "./ComponentEditor";
import type { ComponentDefinition } from "./types";

/**
 * Supported field types for the schema builder.
 */
export type FieldType = "string" | "number" | "boolean" | "array" | "object";

/**
 * Individual field definition in the schema builder.
 */
export interface SchemaField {
  id: string;
  name: string;
  type: FieldType;
  description: string;
  required: boolean;
}

/**
 * Generate a unique ID for a field.
 */
function generateFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Convert SchemaField array to JSON Schema Draft 7 format.
 */
export function fieldsToJsonSchema(fields: SchemaField[]): JSONSchema7 {
  const properties: Record<string, JSONSchema7> = {};
  const required: string[] = [];

  for (const field of fields) {
    if (!field.name.trim()) continue;

    const fieldSchema: JSONSchema7 = {
      type: field.type,
    };

    if (field.description.trim()) {
      fieldSchema.description = field.description;
    }

    // Add array items type
    if (field.type === "array") {
      fieldSchema.items = { type: "string" };
    }

    properties[field.name] = fieldSchema;

    if (field.required) {
      required.push(field.name);
    }
  }

  return {
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Convert JSON Schema Draft 7 to SchemaField array.
 */
export function jsonSchemaToFields(schema: JSONSchema7): SchemaField[] {
  if (schema.type !== "object" || !schema.properties) {
    return [];
  }

  const requiredFields = new Set(schema.required ?? []);
  const fields: SchemaField[] = [];

  for (const [name, propSchema] of Object.entries(schema.properties)) {
    if (typeof propSchema === "boolean") continue;

    fields.push({
      id: generateFieldId(),
      name,
      type: (propSchema.type as FieldType) ?? "string",
      description: propSchema.description ?? "",
      required: requiredFields.has(name),
    });
  }

  return fields;
}

interface SchemaFieldRowProps {
  field: SchemaField;
  onChange: (field: SchemaField) => void;
  onRemove: () => void;
  hasError?: boolean;
}

function SchemaFieldRow({
  field,
  onChange,
  onRemove,
  hasError,
}: SchemaFieldRowProps) {
  return (
    <Card className={cn("transition-colors", hasError && "border-destructive")}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Drag handle (visual only for now) */}
          <div className="mt-2 text-muted-foreground cursor-grab opacity-50">
            <GripVertical className="h-5 w-5" />
          </div>

          <div className="flex-1 space-y-3">
            {/* Row 1: Name and Type */}
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor={`${field.id}-name`} className="sr-only">
                  Field name
                </Label>
                <Input
                  id={`${field.id}-name`}
                  placeholder="Field name"
                  value={field.name}
                  onChange={(e) => onChange({ ...field, name: e.target.value })}
                  className={cn(
                    hasError && !field.name.trim() && "border-destructive"
                  )}
                />
              </div>
              <div className="w-32">
                <Label htmlFor={`${field.id}-type`} className="sr-only">
                  Field type
                </Label>
                <Select
                  value={field.type}
                  onValueChange={(value: FieldType) =>
                    onChange({ ...field, type: value })
                  }
                >
                  <SelectTrigger id={`${field.id}-type`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="array">Array</SelectItem>
                    <SelectItem value="object">Object</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Description */}
            <div>
              <Label htmlFor={`${field.id}-desc`} className="sr-only">
                Description
              </Label>
              <Textarea
                id={`${field.id}-desc`}
                placeholder="Description (optional)"
                value={field.description}
                onChange={(e) =>
                  onChange({ ...field, description: e.target.value })
                }
                className="min-h-[60px] resize-none"
              />
            </div>

            {/* Row 3: Required toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id={`${field.id}-required`}
                  checked={field.required}
                  onCheckedChange={(checked) =>
                    onChange({ ...field, required: checked })
                  }
                />
                <Label
                  htmlFor={`${field.id}-required`}
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Required field
                </Label>
              </div>
            </div>
          </div>

          {/* Remove button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface SchemaBuilderProps {
  /** Initial schema to populate from (for templates or editing) */
  initialSchema?: JSONSchema7;
  /** Callback when schema changes */
  onChange: (schema: JSONSchema7) => void;
  /** Show validation errors */
  showErrors?: boolean;
  /** Whether advanced mode is enabled */
  advancedMode?: boolean;
  /** Callback when advanced mode toggle changes */
  onAdvancedModeChange?: (enabled: boolean) => void;
  /** Initial components for advanced mode */
  initialComponents?: ComponentDefinition[];
  /** Callback when components change */
  onComponentsChange?: (components: ComponentDefinition[]) => void;
}

/**
 * Visual schema builder for creating JSON Schema Draft 7.
 * Allows users to add/remove fields with type selection and required toggle.
 * In advanced mode, also supports hierarchical component definitions.
 */
export function SchemaBuilder({
  initialSchema,
  onChange,
  showErrors = false,
  advancedMode = false,
  onAdvancedModeChange,
  initialComponents,
  onComponentsChange,
}: SchemaBuilderProps) {
  const [fields, setFields] = useState<SchemaField[]>(() => {
    if (initialSchema) {
      return jsonSchemaToFields(initialSchema);
    }
    return [];
  });

  const [components, setComponents] = useState<ComponentDefinition[]>(() => {
    return initialComponents ?? [];
  });

  // Track which field names are duplicates
  const duplicateNames = new Set<string>();
  const nameCounts = new Map<string, number>();
  for (const field of fields) {
    const name = field.name.trim().toLowerCase();
    if (name) {
      nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    }
  }
  for (const [name, count] of nameCounts) {
    if (count > 1) duplicateNames.add(name);
  }

  // Notify parent of changes
  useEffect(() => {
    onChange(fieldsToJsonSchema(fields));
  }, [fields, onChange]);

  // Notify parent when components change
  useEffect(() => {
    onComponentsChange?.(components);
  }, [components, onComponentsChange]);

  const handleComponentsChange = useCallback((newComponents: ComponentDefinition[]) => {
    setComponents(newComponents);
  }, []);

  const handleAdvancedModeToggle = useCallback((enabled: boolean) => {
    onAdvancedModeChange?.(enabled);
  }, [onAdvancedModeChange]);

  const handleAddField = useCallback(() => {
    setFields((prev) => [
      ...prev,
      {
        id: generateFieldId(),
        name: "",
        type: "string",
        description: "",
        required: false,
      },
    ]);
  }, []);

  const handleFieldChange = useCallback((index: number, field: SchemaField) => {
    setFields((prev) => {
      const next = [...prev];
      next[index] = field;
      return next;
    });
  }, []);

  const handleFieldRemove = useCallback((index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="space-y-4">
      {/* Advanced Mode Toggle */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <Label htmlFor="advanced-mode" className="text-sm font-medium cursor-pointer">
              Advanced Mode
            </Label>
            <p className="text-xs text-muted-foreground">
              Enable to define hierarchical components
            </p>
          </div>
        </div>
        <Switch
          id="advanced-mode"
          checked={advancedMode}
          onCheckedChange={handleAdvancedModeToggle}
        />
      </div>

      {/* Fields Section */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">Fields</Label>
        {fields.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No fields defined yet. Add your first field to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => {
              const isEmpty = !field.name.trim();
              const isDuplicate = duplicateNames.has(
                field.name.trim().toLowerCase()
              );
              const hasError = showErrors && (isEmpty || isDuplicate);

              return (
                <SchemaFieldRow
                  key={field.id}
                  field={field}
                  onChange={(f) => handleFieldChange(index, f)}
                  onRemove={() => handleFieldRemove(index)}
                  hasError={hasError}
                />
              );
            })}
          </div>
        )}

        <Button variant="outline" onClick={handleAddField} className="w-full mt-3">
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>

        {showErrors && fields.length > 0 && (
          <div className="space-y-1 mt-2">
            {fields.some((f) => !f.name.trim()) && (
              <p className="text-sm text-destructive">
                All fields must have a name.
              </p>
            )}
            {duplicateNames.size > 0 && (
              <p className="text-sm text-destructive">
                Field names must be unique.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Components Section (Advanced Mode Only) */}
      {advancedMode && (
        <>
          <Separator />
          <ComponentEditor
            components={components}
            onChange={handleComponentsChange}
            showErrors={showErrors}
          />
        </>
      )}
    </div>
  );
}

/**
 * Validate that the schema has at least one field with a non-empty name.
 */
export function validateSchema(fields: SchemaField[]): boolean {
  if (fields.length === 0) return false;

  const names = new Set<string>();
  for (const field of fields) {
    const name = field.name.trim();
    if (!name) return false;
    if (names.has(name.toLowerCase())) return false;
    names.add(name.toLowerCase());
  }

  return true;
}
