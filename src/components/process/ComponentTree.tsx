"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Layers, Hash, ToggleLeft, List, Box } from "lucide-react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { ComponentDefinition, AttributeType } from "./types";

/**
 * Get icon for attribute type.
 */
function getAttributeTypeIcon(type: AttributeType) {
  switch (type) {
    case "string":
      return <Hash className="h-3 w-3" />;
    case "number":
      return <Hash className="h-3 w-3" />;
    case "boolean":
      return <ToggleLeft className="h-3 w-3" />;
    case "array":
      return <List className="h-3 w-3" />;
    case "object":
      return <Box className="h-3 w-3" />;
    default:
      return <Hash className="h-3 w-3" />;
  }
}

interface TreeNodeProps {
  component: ComponentDefinition;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}

function TreeNode({
  component,
  depth,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
}: TreeNodeProps) {
  const isExpanded = expandedIds.has(component.id);
  const isSelected = selectedId === component.id;
  const hasChildren = (component.subcomponents?.length ?? 0) > 0;
  const attrCount = component.attributes?.length ?? 0;

  const indent = depth * 16;

  return (
    <div className="select-none">
      {/* Component Node */}
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
          isSelected && "bg-primary/10 ring-1 ring-primary"
        )}
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={() => onSelect(component.id)}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(component.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        ) : (
          <span className="w-5" />
        )}

        {/* Component Icon */}
        <Layers className="h-4 w-4 text-primary" />

        {/* Component Info */}
        <span className="font-medium text-sm">
          {component.name || "(unnamed)"}
        </span>
        <span className="text-xs text-muted-foreground">
          ({component.type || "no type"})
        </span>
        {attrCount > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {attrCount} attr{attrCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Attributes (when expanded) */}
      {isExpanded && attrCount > 0 && (
        <div
          className="border-l-2 border-muted ml-4"
          style={{ marginLeft: `${indent + 20}px` }}
        >
          {component.attributes?.map((attr) => (
            <div
              key={attr.id}
              className="flex items-center gap-1 py-0.5 px-2 text-xs text-muted-foreground"
            >
              {getAttributeTypeIcon(attr.type)}
              <span className={attr.required ? "font-medium" : ""}>
                {attr.name || "(unnamed)"}
              </span>
              <span className="opacity-60">: {attr.type}</span>
              {attr.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Subcomponents (when expanded) */}
      {isExpanded && hasChildren && (
        <div
          className="border-l-2 border-muted"
          style={{ marginLeft: `${indent + 12}px` }}
        >
          {component.subcomponents?.map((subcomp) => (
            <TreeNode
              key={subcomp.id}
              component={subcomp}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ComponentTreeProps {
  /** Components to display in the tree */
  components: ComponentDefinition[];
  /** Currently selected component ID */
  selectedId?: string | null;
  /** Callback when a component is selected */
  onSelect?: (id: string) => void;
  /** Custom class name for the container */
  className?: string;
}

/**
 * Visual tree representation of component hierarchy.
 * Shows components with expand/collapse controls, attributes, and nesting.
 *
 * AC-5: Component hierarchy is visually represented as an indented tree structure.
 */
export function ComponentTree({
  components,
  selectedId: controlledSelectedId,
  onSelect,
  className,
}: ComponentTreeProps) {
  // Internal state for uncontrolled mode
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Initially expand all components
    const ids = new Set<string>();
    const collectIds = (comps: ComponentDefinition[]) => {
      for (const comp of comps) {
        ids.add(comp.id);
        if (comp.subcomponents) collectIds(comp.subcomponents);
      }
    };
    collectIds(components);
    return ids;
  });

  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;

  const handleSelect = useCallback((id: string) => {
    if (onSelect) {
      onSelect(id);
    } else {
      setInternalSelectedId(id);
    }
  }, [onSelect]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const ids = new Set<string>();
    const collectIds = (comps: ComponentDefinition[]) => {
      for (const comp of comps) {
        ids.add(comp.id);
        if (comp.subcomponents) collectIds(comp.subcomponents);
      }
    };
    collectIds(components);
    setExpandedIds(ids);
  }, [components]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  if (components.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed p-6 text-center", className)}>
        <Layers className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          No components defined
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Component Hierarchy</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={handleExpandAll}>
            Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCollapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {/* Tree */}
      <div className="rounded-lg border bg-card p-2">
        {components.map((comp) => (
          <TreeNode
            key={comp.id}
            component={comp}
            depth={0}
            selectedId={selectedId}
            onSelect={handleSelect}
            expandedIds={expandedIds}
            onToggleExpand={handleToggleExpand}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Get the total count of components including all nested subcomponents.
 */
export function getComponentCount(components: ComponentDefinition[]): number {
  let count = components.length;
  for (const comp of components) {
    if (comp.subcomponents?.length) {
      count += getComponentCount(comp.subcomponents);
    }
  }
  return count;
}

/**
 * Get the maximum nesting depth of components.
 */
export function getMaxDepth(components: ComponentDefinition[], currentDepth = 1): number {
  let maxDepth = currentDepth;
  for (const comp of components) {
    if (comp.subcomponents?.length) {
      const childDepth = getMaxDepth(comp.subcomponents, currentDepth + 1);
      if (childDepth > maxDepth) maxDepth = childDepth;
    }
  }
  return maxDepth;
}

/**
 * Find a component by ID in the hierarchy.
 */
export function findComponentById(
  components: ComponentDefinition[],
  id: string
): ComponentDefinition | null {
  for (const comp of components) {
    if (comp.id === id) return comp;
    if (comp.subcomponents?.length) {
      const found = findComponentById(comp.subcomponents, id);
      if (found) return found;
    }
  }
  return null;
}
