"use client";

import { Check, Eye, GitCompare, RotateCcw } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { EnvironmentBadge } from "./EnvironmentBadge";
import { cn } from "~/lib/utils";

/**
 * Version history entry from the API
 */
interface VersionHistoryEntry {
  id: string;
  version: string;
  environment: "SANDBOX" | "PRODUCTION";
  status: "DRAFT" | "ACTIVE" | "DEPRECATED";
  createdAt: Date;
  publishedAt: Date | null;
  deprecatedAt: Date | null;
  changeNotes: string | null;
  promotedBy: string | null;
  isCurrent: boolean;
  canPromote: boolean;
  canRollback: boolean;
}

export interface VersionHistoryTableProps {
  /** List of versions to display */
  versions: VersionHistoryEntry[];
  /** Currently selected version IDs for compare */
  selectedForCompare: string[];
  /** Callback when view details is clicked */
  onViewDetails: (versionId: string) => void;
  /** Callback when version is selected/deselected for compare */
  onSelectForCompare: (versionId: string) => void;
  /** Callback when rollback is clicked */
  onRollback: (versionId: string, version: string) => void;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusVariant(
  status: "DRAFT" | "ACTIVE" | "DEPRECATED"
): "default" | "secondary" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "DRAFT":
      return "secondary";
    case "DEPRECATED":
      return "outline";
  }
}

/**
 * VersionHistoryTable Component
 *
 * Displays version history in a table format with:
 * - Version number, environment, status, created date
 * - "Current" badge for active versions
 * - Action buttons: View Details, Compare, Restore
 *
 * Story 5.4 AC: 2, 3 - Version list with environment/status badges and "Current" indicator
 */
export function VersionHistoryTable({
  versions,
  selectedForCompare,
  onViewDetails,
  onSelectForCompare,
  onRollback,
}: VersionHistoryTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]">
            <GitCompare className="h-4 w-4 text-muted-foreground" />
          </TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Environment</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Change Notes</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {versions.map((version) => (
          <TableRow
            key={version.id}
            className={cn(
              selectedForCompare.includes(version.id) && "bg-muted/50"
            )}
          >
            <TableCell>
              <Checkbox
                checked={selectedForCompare.includes(version.id)}
                onCheckedChange={() => onSelectForCompare(version.id)}
                aria-label={`Select version ${version.version} for compare`}
              />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="font-medium">v{version.version}</span>
                {version.isCurrent && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400"
                  >
                    <Check className="h-3 w-3 mr-0.5" />
                    Current
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <EnvironmentBadge
                environment={version.environment}
                size="sm"
              />
            </TableCell>
            <TableCell>
              <Badge variant={getStatusVariant(version.status)} className="text-xs capitalize">
                {version.status.toLowerCase()}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDate(version.createdAt)}
            </TableCell>
            <TableCell className="max-w-[200px]">
              {version.changeNotes ? (
                <span className="text-sm text-muted-foreground truncate block">
                  {version.changeNotes}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground/50">—</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewDetails(version.id)}
                  title="View Details"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {version.canRollback && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRollback(version.id, version.version)}
                    title="Restore this version"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
