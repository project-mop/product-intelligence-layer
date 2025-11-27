"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { api } from "~/trpc/react";
import { TestConsole } from "~/components/process/TestConsole";

interface TestPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Test Console Page
 *
 * Allows users to test their intelligence endpoint in the browser
 * with sample inputs before integrating with external systems.
 *
 * AC: 1 - Test page accessible from process detail page at /processes/:id/test
 * AC: 9 - Session-based auth (dashboard context) - no API key required
 *
 * @see docs/stories/3-3-in-browser-endpoint-testing.md
 */
export default function TestPage({ params }: TestPageProps) {
  const { id: processId } = use(params);

  const {
    data: process,
    isLoading,
    error,
  } = api.process.get.useQuery({ id: processId });

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

  // Error state
  if (error) {
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
              {error.message === "Process not found"
                ? "This intelligence was not found or you don't have access to it."
                : `Failed to load intelligence: ${error.message}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!process) {
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
            <p className="text-sm text-destructive">Intelligence not found.</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if process has a published version
  const hasPublishedVersion = process.versions.some(
    (v) => v.environment === "SANDBOX" || v.environment === "PRODUCTION"
  );

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        {/* Breadcrumbs (AC: 1 - Navigation breadcrumbs) */}
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link
                href="/dashboard/processes"
                className="hover:text-foreground transition-colors"
              >
                Intelligences
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link
                href={`/dashboard/processes/${processId}`}
                className="hover:text-foreground transition-colors"
              >
                {process.name}
              </Link>
            </li>
            <li>/</li>
            <li className="text-foreground">Test</li>
          </ol>
        </nav>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            Test Console
          </h1>
          <p className="mt-1 text-muted-foreground">
            Test your intelligence endpoint with sample inputs
          </p>
        </div>

        {/* Not published warning */}
        {!hasPublishedVersion && (
          <div className="mb-6 rounded-md bg-amber-500/10 border border-amber-500/20 p-4">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              This intelligence has no published version. The test console will
              use the latest draft configuration.
            </p>
          </div>
        )}

        {/* Test Console Component */}
        <TestConsole
          processId={processId}
          inputSchema={process.inputSchema as Record<string, unknown>}
        />
      </div>
    </div>
  );
}
