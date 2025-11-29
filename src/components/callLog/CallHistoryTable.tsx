/**
 * Call History Table Component
 *
 * Main table component for displaying call logs with:
 * - Sortable columns: Timestamp, Status, Latency, Model, Cached, Actions
 * - Status color-coded badges (green=2xx, yellow=4xx, red=5xx)
 * - Latency color coding (green <500ms, yellow <2s, red >=2s)
 * - Cached indicator
 * - Truncated input/output preview on hover
 * - View Details action button
 *
 * @see docs/stories/6-2-call-history-ui.md - AC: 1, 4, 6
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Eye, Check, Loader2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { api } from "~/trpc/react";
import { CallLogFilters, type CallLogFiltersState } from "./CallLogFilters";
import { CallLogDetail } from "./CallLogDetail";
import { CallLogEmptyState } from "./CallLogEmptyState";
import { CallLogErrorState } from "./CallLogErrorState";

interface CallHistoryTableProps {
  processId: string;
}

export function CallHistoryTable({ processId }: CallHistoryTableProps) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<CallLogFiltersState>({});
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Initialize filters from URL on mount
  useEffect(() => {
    const initialFilters: CallLogFiltersState = {};

    const status = searchParams.get("status");
    if (status === "2xx") initialFilters.statusCode = 200;
    else if (status === "4xx") initialFilters.statusCode = 400;
    else if (status === "5xx") initialFilters.statusCode = 500;

    const latency = searchParams.get("latency");
    if (latency) initialFilters.minLatencyMs = parseInt(latency, 10);

    const startDate = searchParams.get("startDate");
    if (startDate) initialFilters.startDate = new Date(startDate);

    const endDate = searchParams.get("endDate");
    if (endDate) initialFilters.endDate = new Date(endDate);

    setFilters(initialFilters);
  }, [searchParams]);

  const utils = api.useUtils();

  // Fetch call logs with filters and pagination
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = api.callLog.list.useInfiniteQuery(
    {
      processId,
      limit: 20,
      startDate: filters.startDate,
      endDate: filters.endDate,
      statusCode: filters.statusCode,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Flatten all pages into single array
  const logs = data?.pages.flatMap((page) => page.logs) ?? [];

  // Filter by minimum latency client-side (not supported by API)
  const filteredLogs = filters.minLatencyMs
    ? logs.filter((log) => log.latencyMs >= (filters.minLatencyMs ?? 0))
    : logs;

  const handleRefresh = useCallback(async () => {
    await refetch();
    void utils.callLog.stats.invalidate({ processId });
    setLastRefreshed(new Date());
  }, [refetch, utils.callLog.stats, processId]);

  const handleFiltersChange = useCallback((newFilters: CallLogFiltersState) => {
    setFilters(newFilters);
  }, []);

  const handleViewDetails = useCallback((logId: string) => {
    setSelectedLogId(logId);
    setDetailOpen(true);
  }, []);

  const handleLoadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  if (error) {
    return (
      <CallLogErrorState
        message={error.message}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header with filters and refresh */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CallLogFilters onFiltersChange={handleFiltersChange} />

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Last updated: {formatRelativeTime(lastRefreshed)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefetching}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Call Logs
              {filteredLogs.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({filteredLogs.length} {filteredLogs.length === 1 ? "call" : "calls"})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <TableSkeleton />
            ) : filteredLogs.length === 0 ? (
              <div className="p-6">
                <CallLogEmptyState processId={processId} />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Timestamp</TableHead>
                      <TableHead className="w-[80px]">Status</TableHead>
                      <TableHead className="w-[100px]">Latency</TableHead>
                      <TableHead className="w-[150px]">Model</TableHead>
                      <TableHead className="w-[60px]">Cached</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">
                                {formatRelativeTime(new Date(log.createdAt))}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {formatFullTimestamp(new Date(log.createdAt))}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <StatusBadge statusCode={log.statusCode} />
                        </TableCell>
                        <TableCell>
                          <LatencyDisplay latencyMs={log.latencyMs} />
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground text-sm">
                            {log.modelUsed ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {log.cached && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Check className="h-4 w-4 text-green-600" />
                              </TooltipTrigger>
                              <TooltipContent>Cached response</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(log.id)}
                            className="h-8 gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Load More */}
                {hasNextPage && (
                  <div className="flex justify-center p-4 border-t">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load More"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Detail Sheet */}
        <CallLogDetail
          logId={selectedLogId}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      </div>
    </TooltipProvider>
  );
}

function StatusBadge({ statusCode }: { statusCode: number }) {
  let className: string;
  if (statusCode >= 200 && statusCode < 300) {
    className = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  } else if (statusCode >= 400 && statusCode < 500) {
    className = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  } else if (statusCode >= 500) {
    className = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  } else {
    className = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  }

  return (
    <Badge variant="outline" className={className}>
      {statusCode}
    </Badge>
  );
}

function LatencyDisplay({ latencyMs }: { latencyMs: number }) {
  let className: string;
  if (latencyMs < 500) {
    className = "text-green-600";
  } else if (latencyMs < 2000) {
    className = "text-yellow-600";
  } else {
    className = "text-red-600";
  }

  const formatted = latencyMs >= 1000
    ? `${(latencyMs / 1000).toFixed(1)}s`
    : `${latencyMs}ms`;

  return <span className={`font-mono text-sm ${className}`}>{formatted}</span>;
}

function TableSkeleton() {
  return (
    <div className="divide-y">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <div className="h-4 w-28 bg-muted animate-pulse rounded" />
          <div className="h-6 w-12 bg-muted animate-pulse rounded-full" />
          <div className="h-4 w-14 bg-muted animate-pulse rounded" />
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-6 bg-muted animate-pulse rounded" />
          <div className="h-8 w-16 bg-muted animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatFullTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
