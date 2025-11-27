/**
 * Process Status Badge Component
 *
 * Displays status badge with appropriate colors for DRAFT, SANDBOX, PRODUCTION states.
 *
 * @see docs/stories/3-4-intelligence-list-dashboard.md - AC: 2
 */

import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { ProcessStatus } from "~/lib/process/status";

export interface ProcessStatusBadgeProps {
  status: ProcessStatus;
  className?: string;
}

/**
 * Status badge styling based on environment status.
 * - DRAFT: gray/secondary
 * - SANDBOX: yellow/amber
 * - PRODUCTION: green
 */
const statusStyles: Record<ProcessStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  SANDBOX: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  PRODUCTION: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
};

/**
 * Display labels for each status.
 */
const statusLabels: Record<ProcessStatus, string> = {
  DRAFT: "Draft",
  SANDBOX: "Sandbox",
  PRODUCTION: "Production",
};

export function ProcessStatusBadge({ status, className }: ProcessStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(statusStyles[status], className)}
    >
      {statusLabels[status]}
    </Badge>
  );
}
