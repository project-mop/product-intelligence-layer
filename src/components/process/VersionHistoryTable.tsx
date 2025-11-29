"use client";

import { AlertTriangle, Check, Eye, GitCompare, RotateCcw } from "lucide-react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { EnvironmentBadge } from "./EnvironmentBadge";
import { cn } from "~/lib/utils";

/** Number of days after deprecation before sunset (MVP warning only) */
const SUNSET_DAYS = 90;

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
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "DRAFT":
      return "secondary";
    case "DEPRECATED":
      return "destructive";
  }
}

/**
 * Calculate sunset date from deprecation date
 */
function calculateSunsetDate(deprecatedAt: Date | string): Date {
  const date = new Date(deprecatedAt);
  date.setDate(date.getDate() + SUNSET_DAYS);
  return date;
}

/**
 * Calculate days until sunset
 */
function daysUntilSunset(deprecatedAt: Date | string): number {
  const sunsetDate = calculateSunsetDate(deprecatedAt);
  const now = new Date();
  const diffMs = sunsetDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Format sunset countdown message
 */
function formatSunsetCountdown(deprecatedAt: Date | string): string {
  const days = daysUntilSunset(deprecatedAt);
  const sunsetDate = calculateSunsetDate(deprecatedAt);
  const dateStr = sunsetDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (days <= 0) {
    return `Past sunset date (${dateStr})`;
  } else if (days === 1) {
    return `Sunset tomorrow (${dateStr})`;
  } else if (days <= 7) {
    return `Sunset in ${days} days (${dateStr})`;
  } else if (days <= 30) {
    return `Sunset in ${Math.ceil(days / 7)} weeks (${dateStr})`;
  } else {
    return `Sunset on ${dateStr}`;
  }
}

/**
 * VersionHistoryTable Component
 *
 * Displays version history in a table format with:
 * - Version number, environment, status, created date
 * - "Current" badge for active versions
 * - "Deprecated" badge with sunset date tooltip for deprecated versions (Story 5.5)
 * - Action buttons: View Details, Compare, Restore
 *
 * Story 5.4 AC: 2, 3 - Version list with environment/status badges and "Current" indicator
 * Story 5.5 AC: 4, 5, 6 - Deprecation badge with sunset date
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
              <div className="flex items-center gap-1">
                <Badge variant={getStatusVariant(version.status)} className="text-xs capitalize">
                  {version.status.toLowerCase()}
                </Badge>
                {/* Story 5.5: Deprecation badge with sunset tooltip */}
                {version.status === "DEPRECATED" && version.deprecatedAt && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 cursor-help",
                            daysUntilSunset(version.deprecatedAt) <= 7
                              ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400"
                              : daysUntilSunset(version.deprecatedAt) <= 30
                                ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400"
                                : "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400"
                          )}
                        >
                          <AlertTriangle className="h-3 w-3 mr-0.5" />
                          Sunset
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-sm font-medium">Version Deprecated</p>
                        <p className="text-xs text-muted-foreground">
                          {formatSunsetCountdown(version.deprecatedAt)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Deprecated on {formatDate(version.deprecatedAt)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
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
