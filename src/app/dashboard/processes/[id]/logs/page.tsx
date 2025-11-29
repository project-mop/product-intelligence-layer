/**
 * Call History Page
 *
 * Displays call history for a specific process/intelligence.
 * Features breadcrumb navigation and handles process not found case.
 *
 * @see docs/stories/6-2-call-history-ui.md - AC: 1, 8
 */

"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, History } from "lucide-react";

import { api } from "~/trpc/react";
import { CallHistoryTable } from "~/components/callLog/CallHistoryTable";
import { CallLogStats } from "~/components/callLog/CallLogStats";

interface CallHistoryPageProps {
  params: Promise<{ id: string }>;
}

export default function CallHistoryPage({ params }: CallHistoryPageProps) {
  const { id: processId } = use(params);

  const { data: process, isLoading, error } = api.process.get.useQuery({ id: processId });

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error or not found state
  if (error || !process) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/dashboard/processes"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Intelligences
          </Link>
          <div className="mt-8 rounded-md bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              {error?.message === "Process not found"
                ? "This intelligence was not found or you don't have access to it."
                : `Failed to load intelligence: ${error?.message ?? "Not found"}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/dashboard"
            className="hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <span>/</span>
          <Link
            href="/dashboard/processes"
            className="hover:text-foreground transition-colors"
          >
            Intelligences
          </Link>
          <span>/</span>
          <Link
            href={`/dashboard/processes/${processId}`}
            className="hover:text-foreground transition-colors"
          >
            {process.name}
          </Link>
          <span>/</span>
          <span className="text-foreground">Call History</span>
        </nav>

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Call History</h1>
              <p className="text-sm text-muted-foreground">
                View API call logs for {process.name}
              </p>
            </div>
          </div>

          <Link
            href={`/dashboard/processes/${processId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Intelligence
          </Link>
        </div>

        {/* Stats */}
        <div className="mb-6">
          <CallLogStats processId={processId} />
        </div>

        {/* Table */}
        <CallHistoryTable processId={processId} />
      </div>
    </div>
  );
}
