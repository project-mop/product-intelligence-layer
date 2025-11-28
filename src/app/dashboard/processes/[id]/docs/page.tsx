"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { api } from "~/trpc/react";
import { EndpointSection } from "~/components/process/docs/EndpointSection";
import { AuthenticationSection } from "~/components/process/docs/AuthenticationSection";
import { SchemaSection } from "~/components/process/docs/SchemaSection";
import { ExampleRequestSection } from "~/components/process/docs/ExampleRequestSection";
import { ExampleResponseSection } from "~/components/process/docs/ExampleResponseSection";
import { ErrorCodesSection } from "~/components/process/docs/ErrorCodesSection";

interface DocsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * API Documentation Page
 *
 * Displays auto-generated API documentation for an intelligence process.
 * Includes endpoint URL, authentication, schemas, examples, and error codes.
 *
 * AC: 1 - Docs Page Access: API Docs page accessible from process detail page
 * AC: 10 - Dynamic Updates: Documentation reflects current process schema
 *
 * @see docs/stories/3-6-auto-generated-api-documentation.md
 */
export default function DocsPage({ params }: DocsPageProps) {
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
        <div className="mx-auto max-w-4xl flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-4xl">
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
        <div className="mx-auto max-w-4xl">
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
      <div className="mx-auto max-w-4xl">
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">API Documentation</h1>
          <p className="mt-1 text-muted-foreground">
            Integration guide for {process.name}
          </p>
        </div>

        {/* Documentation Sections */}
        <div className="space-y-6">
          {/* Endpoint URL (AC: 2, 9) */}
          <EndpointSection processId={processId} />

          {/* Authentication (AC: 3, 9) */}
          <AuthenticationSection />

          {/* Input/Output Schemas (AC: 4, 5) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SchemaSection
              schema={inputSchema}
              title="Input Schema"
              type="input"
            />
            <SchemaSection
              schema={outputSchema}
              title="Output Schema"
              type="output"
            />
          </div>

          {/* Example Request (AC: 6, 9) */}
          <ExampleRequestSection
            processId={processId}
            inputSchema={inputSchema}
          />

          {/* Example Response (AC: 7) */}
          <ExampleResponseSection outputSchema={outputSchema} />

          {/* Error Codes (AC: 8) */}
          <ErrorCodesSection />
        </div>
      </div>
    </div>
  );
}
