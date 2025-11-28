"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";

/**
 * JSON Schema property type
 */
interface JsonSchemaProperty {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchemaProperty>;
  items?: JsonSchemaProperty;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
  format?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  [key: string]: unknown;
}

/**
 * JSON Schema type
 */
interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  description?: string;
  [key: string]: unknown;
}

interface SchemaSectionProps {
  /** JSON Schema object to display */
  schema: JsonSchema | Record<string, unknown>;
  /** Title for the section */
  title: string;
  /** Schema type indicator */
  type: "input" | "output";
  /** Optional class name */
  className?: string;
}

/**
 * Renders a collapsible property node with description tooltip.
 * Reuses the PropertyNode pattern from SchemaViewer (Story 3.5).
 */
function PropertyNode({
  name,
  property,
  isRequired,
  depth = 0,
}: {
  name: string;
  property: JsonSchemaProperty;
  isRequired: boolean;
  depth?: number;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const hasChildren =
    property.properties !== undefined || property.items !== undefined;
  const typeDisplay = Array.isArray(property.type)
    ? property.type.join(" | ")
    : property.type ?? "unknown";

  // Get nested properties
  const nestedProperties = property.properties ?? property.items?.properties;
  const nestedRequired = property.required ?? property.items?.required ?? [];

  return (
    <div className={cn("border-l border-muted pl-4", depth > 0 && "ml-2")}>
      {hasChildren ? (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-center gap-2 py-1">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <span className="font-mono text-sm text-foreground">{name}</span>
            <span className="text-xs text-muted-foreground">
              {typeDisplay}
              {property.items && `[]`}
            </span>
            {isRequired && (
              <Badge variant="outline" className="text-xs text-red-500 border-red-200 dark:border-red-800">
                required
              </Badge>
            )}
            {property.description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-sm">{property.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <CollapsibleContent>
            {nestedProperties &&
              Object.entries(nestedProperties).map(([key, value]) => (
                <PropertyNode
                  key={key}
                  name={key}
                  property={value}
                  isRequired={nestedRequired.includes(key)}
                  depth={depth + 1}
                />
              ))}
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="flex items-center gap-2 py-1">
          <span className="font-mono text-sm text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground">{typeDisplay}</span>
          {isRequired && (
            <Badge variant="outline" className="text-xs text-red-500 border-red-200 dark:border-red-800">
              required
            </Badge>
          )}
          {property.description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-sm">{property.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * SchemaSection Component
 *
 * Displays a JSON Schema with collapsible sections and field descriptions.
 * Reuses the PropertyNode pattern from SchemaViewer (Story 3.5).
 *
 * AC: 4 - Input Schema Display: Shows input schema with field names, types, required/optional, descriptions
 * AC: 5 - Output Schema Display: Shows output schema with field names, types, descriptions
 *
 * @see docs/stories/3-6-auto-generated-api-documentation.md
 */
export function SchemaSection({ schema, title, type, className }: SchemaSectionProps) {
  const typedSchema = schema as JsonSchema;
  const properties = typedSchema.properties ?? {};
  const required = typedSchema.required ?? [];

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline" className="text-xs">
            {type === "input" ? "Request Body" : "Response Data"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="rounded-md border bg-muted/30 p-4 max-h-[350px] overflow-auto">
          {typedSchema.description && (
            <p className="mb-4 text-sm text-muted-foreground">
              {typedSchema.description}
            </p>
          )}
          {Object.keys(properties).length > 0 ? (
            <div className="space-y-1">
              {Object.entries(properties).map(([name, property]) => (
                <PropertyNode
                  key={name}
                  name={name}
                  property={property}
                  isRequired={required.includes(name)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No properties defined
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
