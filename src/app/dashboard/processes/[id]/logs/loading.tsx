/**
 * Call History Loading State
 *
 * Displays skeleton UI while call history page is loading.
 *
 * @see docs/stories/6-2-call-history-ui.md - AC: 10
 */

import { CallLogSkeleton } from "~/components/callLog/CallLogSkeleton";
import { Skeleton } from "~/components/ui/skeleton";

export default function CallHistoryLoading() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        {/* Breadcrumb skeleton */}
        <div className="mb-6 flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <span className="text-muted-foreground">/</span>
          <Skeleton className="h-4 w-24" />
          <span className="text-muted-foreground">/</span>
          <Skeleton className="h-4 w-32" />
          <span className="text-muted-foreground">/</span>
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Header skeleton */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </div>
          </div>
          <Skeleton className="h-4 w-32" />
        </div>

        {/* Content skeleton */}
        <CallLogSkeleton />
      </div>
    </div>
  );
}
