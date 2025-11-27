/**
 * Process Filters Component
 *
 * Search, status filter, and sort controls for the intelligence list.
 * Uses URL search params for shareable/bookmarkable state.
 *
 * @see docs/stories/3-4-intelligence-list-dashboard.md - AC: 4, 5, 6
 */

"use client";

import { useCallback, useState, useEffect } from "react";
import { Search } from "lucide-react";

import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { ProcessStatus } from "~/lib/process/status";

export type StatusFilter = ProcessStatus | "ALL";
export type SortField = "name" | "createdAt" | "updatedAt";
export type SortOrder = "asc" | "desc";

/**
 * Combined sort option combining field and order.
 */
export type SortOption =
  | "name-asc"
  | "name-desc"
  | "createdAt-desc"
  | "createdAt-asc"
  | "updatedAt-desc"
  | "updatedAt-asc";

export interface ProcessFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
}

/**
 * Debounce hook for search input.
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Sort option labels for the dropdown.
 */
const sortOptions: { value: SortOption; label: string }[] = [
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "createdAt-desc", label: "Newest First" },
  { value: "createdAt-asc", label: "Oldest First" },
  { value: "updatedAt-desc", label: "Recently Updated" },
  { value: "updatedAt-asc", label: "Least Recently Updated" },
];

/**
 * Status filter labels for the dropdown.
 */
const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SANDBOX", label: "Sandbox" },
  { value: "PRODUCTION", label: "Production" },
];

export function ProcessFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  sortBy,
  sortOrder,
  onSortChange,
}: ProcessFiltersProps) {
  // Local state for immediate input feedback
  const [localSearch, setLocalSearch] = useState(search);

  // Debounced search value
  const debouncedSearch = useDebounce(localSearch, 300);

  // Update parent when debounced value changes
  useEffect(() => {
    if (debouncedSearch !== search) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, search, onSearchChange]);

  // Sync local state with prop changes (e.g., from URL params)
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Combine sortBy and sortOrder into a single value for the select
  const currentSortOption: SortOption = `${sortBy}-${sortOrder}` as SortOption;

  const handleSortChange = useCallback(
    (value: SortOption) => {
      const [field, order] = value.split("-") as [SortField, SortOrder];
      onSortChange(field, order);
    },
    [onSortChange]
  );

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* Search Input */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search intelligences..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-9"
          aria-label="Search intelligences"
        />
      </div>

      {/* Status Filter */}
      <Select
        value={status}
        onValueChange={(value) => onStatusChange(value as StatusFilter)}
      >
        <SelectTrigger className="w-[160px]" aria-label="Filter by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort Dropdown */}
      <Select
        value={currentSortOption}
        onValueChange={(value) => handleSortChange(value as SortOption)}
      >
        <SelectTrigger className="w-[180px]" aria-label="Sort by">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
