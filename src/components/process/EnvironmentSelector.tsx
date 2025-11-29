"use client";

import { cn } from "~/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export interface EnvironmentSelectorProps {
  currentEnvironment: "SANDBOX" | "PRODUCTION";
  onEnvironmentChange: (env: "SANDBOX" | "PRODUCTION") => void;
  productionAvailable: boolean;
}

/**
 * EnvironmentSelector Component
 *
 * Toggle/tabs UI for switching between sandbox and production environments.
 * Disables production option if no production version exists.
 *
 * @see Story 5.1 AC: 9, 10
 */
export function EnvironmentSelector({
  currentEnvironment,
  onEnvironmentChange,
  productionAvailable,
}: EnvironmentSelectorProps) {
  return (
    <div className="flex items-center rounded-lg border bg-muted p-1">
      <button
        type="button"
        onClick={() => onEnvironmentChange("SANDBOX")}
        className={cn(
          "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
          currentEnvironment === "SANDBOX"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Sandbox
      </button>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => productionAvailable && onEnvironmentChange("PRODUCTION")}
              disabled={!productionAvailable}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                currentEnvironment === "PRODUCTION"
                  ? "bg-background text-foreground shadow-sm"
                  : productionAvailable
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              Production
            </button>
          </TooltipTrigger>
          {!productionAvailable && (
            <TooltipContent>
              <p>Promote to production first</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
