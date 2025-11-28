"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { api } from "~/trpc/react";
import { SchemaViewer } from "~/components/process/SchemaViewer";

interface SchemaPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Schema Page
 *
 * Displays input and output JSON schemas for a process.
 * Side-by-side layout on desktop, stacked on mobile.
 *
 * AC: 1 - Schema viewer is accessible from the process detail page
 * AC: 2 - Displays input schema with formatted JSON and syntax highlighting
 * AC: 3 - Displays output schema with formatted JSON and syntax highlighting
 *
 * @see docs/stories/3-5-view-json-schema.md
 */
export default function SchemaPage({ params }: SchemaPageProps) {
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

  // Parse schemas (they come as JsonValue from Prisma)
  const inputSchema = process.inputSchema as Record<string, unknown>;
  const outputSchema = process.outputSchema as Record<string, unknown>;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/dashboard/processes/${processId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {process.name}
          </Link>
        </div>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">JSON Schema</h1>
          <p className="mt-1 text-muted-foreground">
            Input and output schemas for {process.name}
          </p>
        </div>

        {/* Schema Viewers - Side by side on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Schema (AC: 2) */}
          <SchemaViewer
            schema={inputSchema}
            title="Input Schema"
            processName={process.name}
            schemaType="input"
          />

          {/* Output Schema (AC: 3) */}
          <SchemaViewer
            schema={outputSchema}
            title="Output Schema"
            processName={process.name}
            schemaType="output"
          />
        </div>
      </div>
    </div>
  );
}
