"use client";

import { useState, useEffect } from "react";
import { Clock, Info } from "lucide-react";

import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

/**
 * TTL preset values in seconds with human-readable labels.
 */
const TTL_PRESETS = [
  { label: "5 min", value: 300 },
  { label: "15 min", value: 900 },
  { label: "1 hour", value: 3600 },
  { label: "6 hours", value: 21600 },
  { label: "24 hours", value: 86400 },
] as const;

/**
 * Format TTL seconds to human-readable string.
 */
function formatTtl(seconds: number): string {
  if (seconds === 0) return "Disabled";
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? "s" : ""}`;
    }
    return `${hours}h ${remainingMinutes}m`;
  }
  const days = Math.floor(seconds / 86400);
  return `${days} day${days !== 1 ? "s" : ""}`;
}

interface CacheTtlSettingsProps {
  /** Current TTL in seconds (0-86400) */
  cacheTtlSeconds: number;
  /** Whether caching is enabled */
  cacheEnabled: boolean;
  /** Callback when settings change */
  onChange: (config: { cacheTtlSeconds: number; cacheEnabled: boolean }) => void;
  /** Disable all inputs */
  disabled?: boolean;
}

/**
 * Cache TTL Settings Component
 *
 * Allows users to configure cache TTL for a process.
 * Includes toggle switch, preset buttons, and custom input.
 *
 * Story 4.6 AC: 6 - Cache TTL is displayed in process settings UI
 *
 * @see docs/stories/4-6-configurable-cache-ttl.md
 */
export function CacheTtlSettings({
  cacheTtlSeconds,
  cacheEnabled,
  onChange,
  disabled = false,
}: CacheTtlSettingsProps) {
  // Local state for the input value (allows typing before blur)
  const [inputValue, setInputValue] = useState(String(cacheTtlSeconds));

  // Sync input value when prop changes externally
  useEffect(() => {
    setInputValue(String(cacheTtlSeconds));
  }, [cacheTtlSeconds]);

  const handleToggle = (enabled: boolean) => {
    onChange({ cacheTtlSeconds, cacheEnabled: enabled });
  };

  const handlePresetClick = (value: number) => {
    setInputValue(String(value));
    onChange({ cacheTtlSeconds: value, cacheEnabled });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed)) {
      // Reset to current value if invalid
      setInputValue(String(cacheTtlSeconds));
      return;
    }
    // Clamp to valid range
    const clamped = Math.max(0, Math.min(86400, parsed));
    setInputValue(String(clamped));
    onChange({ cacheTtlSeconds: clamped, cacheEnabled });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  const isDisabledByTtl = cacheTtlSeconds === 0;
  const effectivelyDisabled = !cacheEnabled || isDisabledByTtl;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="cache-toggle" className="text-base font-medium">
            Response Caching
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Cache responses to reduce API costs and latency. Identical
                  inputs will return cached results until TTL expires.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch
          id="cache-toggle"
          checked={cacheEnabled}
          onCheckedChange={handleToggle}
          disabled={disabled}
        />
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <Badge
          variant={effectivelyDisabled ? "secondary" : "default"}
          className={effectivelyDisabled ? "bg-muted" : "bg-green-100 text-green-800 hover:bg-green-100"}
        >
          {effectivelyDisabled ? "Caching Disabled" : `TTL: ${formatTtl(cacheTtlSeconds)}`}
        </Badge>
        {!cacheEnabled && (
          <span className="text-xs text-muted-foreground">
            Toggle on to enable caching
          </span>
        )}
        {cacheEnabled && isDisabledByTtl && (
          <span className="text-xs text-muted-foreground">
            Set TTL {">"} 0 to enable caching
          </span>
        )}
      </div>

      {/* TTL Configuration (only shown when enabled) */}
      {cacheEnabled && (
        <div className="space-y-3 pt-2">
          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2">
            {TTL_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant={cacheTtlSeconds === preset.value ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetClick(preset.value)}
                disabled={disabled}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              type="button"
              variant={cacheTtlSeconds === 0 ? "destructive" : "outline"}
              size="sm"
              onClick={() => handlePresetClick(0)}
              disabled={disabled}
            >
              Disable
            </Button>
          </div>

          {/* Custom input */}
          <div className="flex items-center gap-2">
            <Label htmlFor="cache-ttl" className="text-sm text-muted-foreground whitespace-nowrap">
              Custom TTL:
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="cache-ttl"
                type="number"
                min={0}
                max={86400}
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">seconds</span>
            </div>
          </div>

          {/* Help text */}
          <p className="text-xs text-muted-foreground">
            Valid range: 0 (disabled) to 86,400 (24 hours). Default is 900 (15 minutes).
          </p>
        </div>
      )}
    </div>
  );
}
