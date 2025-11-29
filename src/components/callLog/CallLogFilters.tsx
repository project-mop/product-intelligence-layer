/**
 * Call Log Filters Component
 *
 * Filter controls for call history including:
 * - Date range picker
 * - Status filter dropdown
 * - Latency threshold input
 *
 * Syncs with URL query params for shareable links.
 *
 * @see docs/stories/6-2-call-history-ui.md - AC: 3, Task 4
 */

"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Filter, X, Calendar } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export interface CallLogFiltersState {
  startDate?: Date;
  endDate?: Date;
  statusCode?: number;
  minLatencyMs?: number;
}

interface CallLogFiltersProps {
  onFiltersChange: (filters: CallLogFiltersState) => void;
}

type StatusFilterValue = "all" | "2xx" | "4xx" | "5xx";

export function CallLogFilters({ onFiltersChange }: CallLogFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse current filters from URL
  const currentStatus = (searchParams.get("status") as StatusFilterValue) ?? "all";
  const currentLatency = searchParams.get("latency") ?? "";
  const currentStartDate = searchParams.get("startDate") ?? "";
  const currentEndDate = searchParams.get("endDate") ?? "";

  // Count active filters
  const activeFilterCount = [
    currentStatus !== "all",
    currentLatency !== "",
    currentStartDate !== "",
    currentEndDate !== "",
  ].filter(Boolean).length;

  // Update URL and notify parent
  const updateFilters = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });

      // Build filters object for parent
      const filters: CallLogFiltersState = {};

      const status = params.get("status");
      if (status === "2xx") filters.statusCode = 200;
      else if (status === "4xx") filters.statusCode = 400;
      else if (status === "5xx") filters.statusCode = 500;

      const latency = params.get("latency");
      if (latency) filters.minLatencyMs = parseInt(latency, 10);

      const startDate = params.get("startDate");
      if (startDate) filters.startDate = new Date(startDate);

      const endDate = params.get("endDate");
      if (endDate) filters.endDate = new Date(endDate);

      onFiltersChange(filters);
    },
    [searchParams, pathname, router, onFiltersChange]
  );

  const handleStatusChange = (value: StatusFilterValue) => {
    updateFilters({ status: value });
  };

  const handleLatencyChange = (value: string) => {
    // Only allow numbers
    const numValue = value.replace(/\D/g, "");
    updateFilters({ latency: numValue });
  };

  const handleStartDateChange = (value: string) => {
    updateFilters({ startDate: value });
  };

  const handleEndDateChange = (value: string) => {
    updateFilters({ endDate: value });
  };

  const handleClearFilters = () => {
    router.replace(pathname, { scroll: false });
    onFiltersChange({});
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {activeFilterCount}
          </Badge>
        )}
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={currentStartDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="h-9 w-36 pl-8 text-sm"
            placeholder="Start date"
          />
        </div>
        <span className="text-muted-foreground">to</span>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={currentEndDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            className="h-9 w-36 pl-8 text-sm"
            placeholder="End date"
          />
        </div>
      </div>

      {/* Status Filter */}
      <Select value={currentStatus} onValueChange={handleStatusChange}>
        <SelectTrigger className="h-9 w-32">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="2xx">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Success (2xx)
            </span>
          </SelectItem>
          <SelectItem value="4xx">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              Client Error (4xx)
            </span>
          </SelectItem>
          <SelectItem value="5xx">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Server Error (5xx)
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Latency Threshold */}
      <div className="relative">
        <Input
          type="text"
          value={currentLatency}
          onChange={(e) => handleLatencyChange(e.target.value)}
          placeholder="Min latency (ms)"
          className="h-9 w-36 text-sm"
        />
      </div>

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="h-9 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
