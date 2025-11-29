"use client";

import { AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "~/lib/utils";

export interface EnvironmentBannerProps {
  environment: "SANDBOX" | "PRODUCTION";
  message?: string;
}

const bannerStyles = {
  SANDBOX: {
    container: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
    text: "text-yellow-800 dark:text-yellow-300",
    icon: "text-yellow-600 dark:text-yellow-400",
  },
  PRODUCTION: {
    container: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
    text: "text-green-800 dark:text-green-300",
    icon: "text-green-600 dark:text-green-400",
  },
};

const defaultMessages = {
  SANDBOX: "Sandbox Mode - Changes here won't affect production",
  PRODUCTION: "Production - Live API traffic",
};

/**
 * EnvironmentBanner Component
 *
 * Full-width banner at top of process detail page indicating current environment.
 * - Sandbox: Yellow with warning icon
 * - Production: Green with check icon
 *
 * @see Story 5.1 AC: 4
 */
export function EnvironmentBanner({
  environment,
  message,
}: EnvironmentBannerProps) {
  const styles = bannerStyles[environment];
  const displayMessage = message ?? defaultMessages[environment];
  const Icon = environment === "SANDBOX" ? AlertTriangle : CheckCircle;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 border-b",
        styles.container
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", styles.icon)} />
      <span className={cn("text-sm font-medium", styles.text)}>
        {displayMessage}
      </span>
    </div>
  );
}
