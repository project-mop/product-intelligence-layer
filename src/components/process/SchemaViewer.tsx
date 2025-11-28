"use client";

import { useState, useCallback } from "react";
import { Copy, Download, Check, ChevronRight, ChevronDown, Info } from "lucide-react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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

// Register JSON language for syntax highlighting
SyntaxHighlighter.registerLanguage("json", json);

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

export interface SchemaViewerProps {
  /** JSON Schema object to display */
  schema: JsonSchema | Record<string, unknown>;
  /** Title for the schema viewer (e.g., "Input Schema", "Output Schema") */
  title: string;
  /** Process name for download filename */
  processName?: string;
  /** Schema type for download filename (e.g., "input", "output") */
  schemaType?: "input" | "output";
  /** Optional class name */
  className?: string;
}

/**
 * Renders a collapsible property node with description tooltip
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
              <span className="text-xs text-red-500">required</span>
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
          {isRequired && <span className="text-xs text-red-500">required</span>}
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
 * SchemaViewer Component
 *
 * Displays a JSON Schema with syntax highlighting, collapsible sections,
 * and field description tooltips. Includes copy and download functionality.
 *
 * AC: 2 - Input schema display with formatted JSON and syntax highlighting
 * AC: 3 - Output schema display with formatted JSON and syntax highlighting
 * AC: 4 - One-click copy button for each schema
 * AC: 5 - Download each schema as a .json file with descriptive filename
 * AC: 6 - Schema display includes field descriptions from the process definition
 *
 * @see docs/stories/3-5-view-json-schema.md
 */
export function SchemaViewer({
  schema,
  title,
  processName = "process",
  schemaType = "input",
  className,
}: SchemaViewerProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"structured" | "raw">("structured");

  // Format schema as JSON string with 2-space indentation
  const schemaJson = JSON.stringify(schema, null, 2);

  // Copy schema to clipboard (AC: 4)
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(schemaJson);
      setCopied(true);
      toast.success(`${title} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }, [schemaJson, title]);

  // Download schema as JSON file (AC: 5)
  const handleDownload = useCallback(() => {
    try {
      // Create filename: {process-name}-{input|output}-schema.json
      const sanitizedName = processName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const filename = `${sanitizedName}-${schemaType}-schema.json`;

      // Create blob and download
      const blob = new Blob([schemaJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded ${filename}`);
    } catch {
      toast.error("Failed to download schema");
    }
  }, [schemaJson, processName, schemaType]);

  // Extract schema properties for structured view
  const typedSchema = schema as JsonSchema;
  const properties = typedSchema.properties ?? {};
  const required = typedSchema.required ?? [];

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center rounded-md border">
              <Button
                variant={viewMode === "structured" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 rounded-r-none px-2 text-xs"
                onClick={() => setViewMode("structured")}
              >
                Structured
              </Button>
              <Button
                variant={viewMode === "raw" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 rounded-l-none px-2 text-xs"
                onClick={() => setViewMode("raw")}
              >
                Raw
              </Button>
            </div>
            {/* Copy button (AC: 4) */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-7 gap-1.5"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="sr-only sm:not-sr-only sm:inline">Copy</span>
            </Button>
            {/* Download button (AC: 5) */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-7 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:inline">Download</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {viewMode === "structured" ? (
          /* Structured view with collapsible sections (AC: 6) */
          <div className="max-h-[400px] overflow-auto rounded-md border bg-muted/30 p-4">
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
        ) : (
          /* Raw JSON view with syntax highlighting (AC: 2, 3) */
          <div className="max-h-[400px] overflow-auto rounded-md">
            <SyntaxHighlighter
              language="json"
              style={atomOneDark}
              customStyle={{
                margin: 0,
                padding: "1rem",
                borderRadius: "0.375rem",
                fontSize: "0.75rem",
              }}
            >
              {schemaJson}
            </SyntaxHighlighter>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
