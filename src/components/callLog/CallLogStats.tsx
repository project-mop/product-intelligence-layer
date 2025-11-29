/**
 * Call Log Stats Component
 *
 * Displays aggregated statistics for call logs: total calls, success rate, avg latency.
 *
 * @see docs/stories/6-2-call-history-ui.md - AC: 1, Task 8
 */

"use client";

import { Activity, CheckCircle2, Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

interface CallLogStatsProps {
  processId: string;
  days?: number;
}

export function CallLogStats({ processId, days = 7 }: CallLogStatsProps) {
  const { data: stats, isLoading } = api.callLog.stats.useQuery({
    processId,
    days,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const avgLatency = stats.byStatusCode.length > 0
    ? Math.round(
        stats.byStatusCode.reduce((sum, s) => sum + s.avgLatencyMs * s.count, 0) /
        stats.totals.total
      )
    : 0;

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Calls
          </CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totals.total.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Last {days} days</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Success Rate
          </CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.totals.total > 0
              ? `${stats.totals.successRate.toFixed(1)}%`
              : "—"}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.totals.success} successful, {stats.totals.error} errors
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Avg Latency
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.totals.total > 0 ? formatLatency(avgLatency) : "—"}
          </div>
          <p className="text-xs text-muted-foreground">Average response time</p>
        </CardContent>
      </Card>
    </div>
  );
}

function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}
