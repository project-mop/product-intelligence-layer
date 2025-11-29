"use client";

import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export interface EnvironmentBadgeProps {
  environment: "SANDBOX" | "PRODUCTION";
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "text-[10px] px-1.5 py-0",
  md: "text-xs px-2 py-0.5",
  lg: "text-sm px-2.5 py-1",
};

const environmentStyles = {
  SANDBOX: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  PRODUCTION: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
};

/**
 * EnvironmentBadge Component
 *
 * Displays environment status (Sandbox or Production) with visual distinction.
 * - Sandbox: Yellow background
 * - Production: Green background
 *
 * @see Story 5.1 AC: 4, 8
 */
export function EnvironmentBadge({
  environment,
  size = "sm",
}: EnvironmentBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        sizeClasses[size],
        environmentStyles[environment],
        "font-medium"
      )}
    >
      {environment === "SANDBOX" ? "Sandbox" : "Production"}
    </Badge>
  );
}
