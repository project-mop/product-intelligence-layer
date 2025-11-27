/**
 * Intelligence List Page
 *
 * Dashboard gallery view of all intelligences with search, filter, and sort.
 *
 * @see docs/stories/3-4-intelligence-list-dashboard.md - AC: 1-8
 */

"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { Plus, RefreshCw } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  IntelligenceCard,
  ProcessFilters,
  ProcessEmptyState,
  type StatusFilter,
  type SortField,
  type SortOrder,
} from "~/components/dashboard";

/**
 * Skeleton card for loading state.
 */
function ProcessCardSkeleton() {
  return (
    <Card className="h-[160px]">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-3/4" />
        <div className="h-10 mt-4" />
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for the entire page.
 */
function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header skeleton */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-1 h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>

        {/* Filters skeleton */}
        <div className="mb-6 flex gap-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-44" />
        </div>

        {/* Grid skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ProcessCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Main page content component that uses useSearchParams.
 * Must be wrapped in Suspense for Next.js 15 static generation.
 */
function ProcessesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read filter state from URL params
  const search = searchParams.get("search") ?? "";
  const status = (searchParams.get("status") as StatusFilter) ?? "ALL";
  const sortBy = (searchParams.get("sortBy") as SortField) ?? "updatedAt";
  const sortOrder = (searchParams.get("sortOrder") as SortOrder) ?? "desc";

  // Update URL params helper
  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === "" || value === "ALL") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      // Remove default values to keep URL clean
      if (params.get("sortBy") === "updatedAt") params.delete("sortBy");
      if (params.get("sortOrder") === "desc") params.delete("sortOrder");

      const newUrl = params.toString() ? `?${params.toString()}` : "/dashboard/processes";
      router.push(newUrl, { scroll: false });
    },
    [router, searchParams]
  );

  // Filter handlers
  const handleSearchChange = useCallback(
    (value: string) => updateParams({ search: value || undefined }),
    [updateParams]
  );

  const handleStatusChange = useCallback(
    (value: StatusFilter) => updateParams({ status: value === "ALL" ? undefined : value }),
    [updateParams]
  );

  const handleSortChange = useCallback(
    (field: SortField, order: SortOrder) => updateParams({ sortBy: field, sortOrder: order }),
    [updateParams]
  );

  // Fetch processes with the new listWithStats procedure
  const {
    data: processes,
    isLoading,
    error,
    refetch,
  } = api.process.listWithStats.useQuery({
    search: search || undefined,
    status: status === "ALL" ? undefined : status,
    sortBy,
    sortOrder,
  });

  // Action handlers for cards
  const handleTest = useCallback(
    (processId: string) => {
      router.push(`/dashboard/processes/${processId}?tab=test`);
    },
    [router]
  );

  const handleEdit = useCallback(
    (processId: string) => {
      router.push(`/dashboard/processes/${processId}/edit`);
    },
    [router]
  );

  const handleDocs = useCallback(
    (processId: string) => {
      router.push(`/dashboard/processes/${processId}?tab=docs`);
    },
    [router]
  );

  // Memoize process list to prevent unnecessary re-renders
  const processList = useMemo(() => processes ?? [], [processes]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-md bg-destructive/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-destructive">
                Failed to load intelligences: {error.message}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Intelligences</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create and manage your product intelligence definitions
            </p>
          </div>
          <Link href="/dashboard/processes/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Intelligence
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <ProcessFilters
            search={search}
            onSearchChange={handleSearchChange}
            status={status}
            onStatusChange={handleStatusChange}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
          />
        </div>

        {/* Process Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ProcessCardSkeleton key={i} />
            ))}
          </div>
        ) : processList.length === 0 ? (
          <ProcessEmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {processList.map((process) => (
              <IntelligenceCard
                key={process.id}
                process={process}
                onTest={() => handleTest(process.id)}
                onEdit={() => handleEdit(process.id)}
                onDocs={() => handleDocs(process.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Page export wrapped in Suspense for Next.js 15 static generation.
 */
export default function ProcessesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProcessesPageContent />
    </Suspense>
  );
}
