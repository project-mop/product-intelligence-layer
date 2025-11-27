"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Layers } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import type { ComponentDefinition, AttributeDefinition, AttributeType } from "./types";

/**
 * Maximum nesting depth for subcomponents.
 */
const MAX_NESTING_DEPTH = 3;

/**
 * Generate a unique ID for components/attributes.
 */
function generateId(): string {
  return `comp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a new empty component.
 */
export function createEmptyComponent(): ComponentDefinition {
  return {
    id: generateId(),
    name: "",
    type: "",
    attributes: [],
    subcomponents: [],
    expanded: true,
  };
}

/**
 * Create a new empty attribute.
 */
export function createEmptyAttribute(): AttributeDefinition {
  return {
    id: generateId(),
    name: "",
    type: "string",
    description: "",
    required: false,
  };
}

/**
 * Validate component names are unique within their parent level.
 */
export function validateComponentNames(components: ComponentDefinition[]): boolean {
  const names = new Set<string>();
  for (const comp of components) {
    const name = comp.name.trim().toLowerCase();
    if (name && names.has(name)) return false;
    names.add(name);
    // Recursively validate subcomponents
    if (comp.subcomponents?.length && !validateComponentNames(comp.subcomponents)) {
      return false;
    }
  }
  return true;
}

/**
 * Validate attribute names are unique within a component.
 */
export function validateAttributeNames(attributes: AttributeDefinition[]): boolean {
  const names = new Set<string>();
  for (const attr of attributes) {
    const name = attr.name.trim().toLowerCase();
    if (name && names.has(name)) return false;
    names.add(name);
  }
  return true;
}

interface AttributeRowProps {
  attribute: AttributeDefinition;
  onChange: (attr: AttributeDefinition) => void;
  onRemove: () => void;
  hasError?: boolean;
}

function AttributeRow({ attribute, onChange, onRemove, hasError }: AttributeRowProps) {
  return (
    <div className={cn(
      "flex items-start gap-2 rounded-md border p-2",
      hasError && "border-destructive"
    )}>
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Attribute name"
            value={attribute.name}
            onChange={(e) => onChange({ ...attribute, name: e.target.value })}
            className="flex-1"
          />
          <Select
            value={attribute.type}
            onValueChange={(value: AttributeType) => onChange({ ...attribute, type: value })}
          >
            <SelectTrigger className="w-28">
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
        <Textarea
          placeholder="Description (optional)"
          value={attribute.description ?? ""}
          onChange={(e) => onChange({ ...attribute, description: e.target.value })}
          className="min-h-[40px] resize-none text-sm"
        />
        <div className="flex items-center gap-2">
          <Switch
            id={`${attribute.id}-required`}
            checked={attribute.required}
            onCheckedChange={(checked) => onChange({ ...attribute, required: checked })}
          />
          <Label htmlFor={`${attribute.id}-required`} className="text-xs text-muted-foreground">
            Required
          </Label>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface ComponentNodeProps {
  component: ComponentDefinition;
  depth: number;
  onChange: (comp: ComponentDefinition) => void;
  onRemove: () => void;
  onSelect: () => void;
  isSelected: boolean;
  showErrors?: boolean;
}

function ComponentNode({
  component,
  depth,
  onChange,
  onRemove,
  onSelect,
  isSelected,
  showErrors,
}: ComponentNodeProps) {
  const canAddSubcomponent = depth < MAX_NESTING_DEPTH;
  const isMaxDepth = depth === MAX_NESTING_DEPTH;

  const handleToggleExpand = () => {
    onChange({ ...component, expanded: !component.expanded });
  };

  const handleAddAttribute = () => {
    onChange({
      ...component,
      attributes: [...(component.attributes ?? []), createEmptyAttribute()],
    });
  };

  const handleAttributeChange = (index: number, attr: AttributeDefinition) => {
    const newAttrs = [...(component.attributes ?? [])];
    newAttrs[index] = attr;
    onChange({ ...component, attributes: newAttrs });
  };

  const handleAttributeRemove = (index: number) => {
    onChange({
      ...component,
      attributes: (component.attributes ?? []).filter((_, i) => i !== index),
    });
  };

  const handleAddSubcomponent = () => {
    if (!canAddSubcomponent) return;
    onChange({
      ...component,
      subcomponents: [...(component.subcomponents ?? []), createEmptyComponent()],
      expanded: true,
    });
  };

  const handleSubcomponentChange = (index: number, subcomp: ComponentDefinition) => {
    const newSubs = [...(component.subcomponents ?? [])];
    newSubs[index] = subcomp;
    onChange({ ...component, subcomponents: newSubs });
  };

  const handleSubcomponentRemove = (index: number) => {
    onChange({
      ...component,
      subcomponents: (component.subcomponents ?? []).filter((_, i) => i !== index),
    });
  };

  const hasNameError = showErrors && !component.name.trim();
  const hasTypeError = showErrors && !component.type.trim();
  const hasAttrErrors = showErrors && !validateAttributeNames(component.attributes ?? []);

  return (
    <Card className={cn(
      "transition-all",
      isSelected && "ring-2 ring-primary",
      (hasNameError || hasTypeError) && "border-destructive"
    )}>
      <CardHeader className="p-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleToggleExpand}
          >
            {component.expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <Layers className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Component name"
              value={component.name}
              onChange={(e) => onChange({ ...component, name: e.target.value })}
              onClick={onSelect}
              className={cn("flex-1", hasNameError && "border-destructive")}
            />
            <Input
              placeholder="Type (e.g., ProductVariant)"
              value={component.type}
              onChange={(e) => onChange({ ...component, type: e.target.value })}
              onClick={onSelect}
              className={cn("w-40", hasTypeError && "border-destructive")}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        {isMaxDepth && (
          <p className="text-xs text-muted-foreground ml-8">
            Maximum nesting depth reached
          </p>
        )}
      </CardHeader>

      {component.expanded && (
        <CardContent className="p-3 pt-0 space-y-4">
          {/* Attributes Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Attributes ({component.attributes?.length ?? 0})
              </Label>
              <Button variant="outline" size="sm" onClick={handleAddAttribute}>
                <Plus className="mr-1 h-3 w-3" />
                Add Attribute
              </Button>
            </div>
            {(component.attributes?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">No attributes defined</p>
            ) : (
              <div className="space-y-2">
                {component.attributes?.map((attr, index) => {
                  const isDuplicate = (component.attributes ?? []).some(
                    (a, i) => i !== index && a.name.trim().toLowerCase() === attr.name.trim().toLowerCase() && attr.name.trim()
                  );
                  return (
                    <AttributeRow
                      key={attr.id}
                      attribute={attr}
                      onChange={(a) => handleAttributeChange(index, a)}
                      onRemove={() => handleAttributeRemove(index)}
                      hasError={showErrors && (!attr.name.trim() || isDuplicate)}
                    />
                  );
                })}
              </div>
            )}
            {hasAttrErrors && (
              <p className="text-xs text-destructive">Attribute names must be unique</p>
            )}
          </div>

          {/* Subcomponents Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Subcomponents ({component.subcomponents?.length ?? 0})
              </Label>
              {canAddSubcomponent && (
                <Button variant="outline" size="sm" onClick={handleAddSubcomponent}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Subcomponent
                </Button>
              )}
            </div>
            {(component.subcomponents?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">No subcomponents defined</p>
            ) : (
              <div className="ml-4 border-l-2 border-muted pl-4 space-y-2">
                {component.subcomponents?.map((subcomp, index) => (
                  <ComponentNode
                    key={subcomp.id}
                    component={subcomp}
                    depth={depth + 1}
                    onChange={(sc) => handleSubcomponentChange(index, sc)}
                    onRemove={() => handleSubcomponentRemove(index)}
                    onSelect={onSelect}
                    isSelected={false}
                    showErrors={showErrors}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface ComponentEditorProps {
  components: ComponentDefinition[];
  onChange: (components: ComponentDefinition[]) => void;
  showErrors?: boolean;
}

/**
 * Component editor for defining hierarchical component structures.
 * Supports nested components up to 3 levels deep with attributes.
 */
export function ComponentEditor({ components, onChange, showErrors = false }: ComponentEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleAddComponent = useCallback(() => {
    onChange([...components, createEmptyComponent()]);
  }, [components, onChange]);

  const handleComponentChange = useCallback((index: number, comp: ComponentDefinition) => {
    const newComps = [...components];
    newComps[index] = comp;
    onChange(newComps);
  }, [components, onChange]);

  const handleComponentRemove = useCallback((index: number) => {
    onChange(components.filter((_, i) => i !== index));
  }, [components, onChange]);

  const hasDuplicateNames = showErrors && !validateComponentNames(components);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">Components</h4>
          <p className="text-xs text-muted-foreground">
            Define hierarchical product components (max {MAX_NESTING_DEPTH} levels deep)
          </p>
        </div>
        <Button variant="outline" onClick={handleAddComponent}>
          <Plus className="mr-2 h-4 w-4" />
          Add Component
        </Button>
      </div>

      {components.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Layers className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No components defined. Add a component to define structured product data.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {components.map((comp, index) => (
            <ComponentNode
              key={comp.id}
              component={comp}
              depth={1}
              onChange={(c) => handleComponentChange(index, c)}
              onRemove={() => handleComponentRemove(index)}
              onSelect={() => setSelectedId(comp.id)}
              isSelected={selectedId === comp.id}
              showErrors={showErrors}
            />
          ))}
        </div>
      )}

      {hasDuplicateNames && (
        <p className="text-sm text-destructive">
          Component names must be unique within each level.
        </p>
      )}
    </div>
  );
}

/**
 * Validate that all components have required fields.
 */
export function validateComponents(components: ComponentDefinition[]): boolean {
  for (const comp of components) {
    if (!comp.name.trim() || !comp.type.trim()) return false;
    if (!validateAttributeNames(comp.attributes ?? [])) return false;
    for (const attr of comp.attributes ?? []) {
      if (!attr.name.trim()) return false;
    }
    if (comp.subcomponents?.length && !validateComponents(comp.subcomponents)) {
      return false;
    }
  }
  return validateComponentNames(components);
}

/**
 * Convert client-side ComponentDefinition to server-side format.
 * Strips client-only fields (id, expanded) for API submission.
 */
export function componentsToServerFormat(components: ComponentDefinition[]): Array<{
  name: string;
  type: string;
  attributes?: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "array" | "object";
    description?: string;
    required: boolean;
  }>;
  subcomponents?: ReturnType<typeof componentsToServerFormat>;
}> {
  return components.map((comp) => ({
    name: comp.name,
    type: comp.type,
    attributes: comp.attributes?.map((attr) => ({
      name: attr.name,
      type: attr.type,
      description: attr.description || undefined,
      required: attr.required,
    })),
    subcomponents: comp.subcomponents?.length
      ? componentsToServerFormat(comp.subcomponents)
      : undefined,
  }));
}
