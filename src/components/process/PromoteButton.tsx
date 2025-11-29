"use client";

import { ArrowUpCircle } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export interface PromoteButtonProps {
  /** The version to potentially promote */
  version: {
    id: string;
    environment: "SANDBOX" | "PRODUCTION";
    status: "DRAFT" | "ACTIVE" | "DEPRECATED";
  };
  /** Callback when promote is clicked */
  onPromote: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether a promotion is in progress */
  loading?: boolean;
}

/**
 * PromoteButton Component
 *
 * Displays a "Promote to Production" button for sandbox versions.
 * Only renders when version is SANDBOX environment with ACTIVE status.
 *
 * Story 5.3 AC: 1 - "Promote to Production" button visible on sandbox versions with ACTIVE status
 */
export function PromoteButton({
  version,
  onPromote,
  disabled = false,
  loading = false,
}: PromoteButtonProps) {
  // Only show button for SANDBOX + ACTIVE versions
  if (version.environment !== "SANDBOX" || version.status !== "ACTIVE") {
    return null;
  }

  const button = (
    <Button
      onClick={onPromote}
      disabled={disabled || loading}
      variant="default"
      size="sm"
      className="gap-2"
    >
      <ArrowUpCircle className="h-4 w-4" />
      {loading ? "Promoting..." : "Promote to Production"}
    </Button>
  );

  if (disabled && !loading) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>{button}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Cannot promote at this time</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
