/**
 * Call Log Detail Component
 *
 * Slide-in sheet showing full details of a call log including:
 * - Full request/response JSON with syntax highlighting
 * - Copy buttons for input/output
 * - All metadata fields
 *
 * @see docs/stories/6-2-call-history-ui.md - AC: 2, 7
 */

"use client";

import { Copy, Check, Clock, Hash, Cpu, Database, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

// Register JSON language for syntax highlighting
SyntaxHighlighter.registerLanguage("json", json);

interface CallLogDetailProps {
  logId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CallLogDetail({ logId, open, onOpenChange }: CallLogDetailProps) {
  const { data: log, isLoading, error } = api.callLog.get.useQuery(
    { id: logId! },
    { enabled: !!logId && open }
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Call Log Details</SheetTitle>
          <SheetDescription>
            Full details of the API call including request and response data.
          </SheetDescription>
        </SheetHeader>

        {isLoading && <DetailSkeleton />}

        {error && (
          <div className="mt-6 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load call details: {error.message}
          </div>
        )}

        {log && <DetailContent log={log} />}
      </SheetContent>
    </Sheet>
  );
}

interface DetailContentProps {
  log: {
    id: string;
    processId: string;
    processVersionId: string | null;
    inputHash: string | null;
    input: unknown;
    output: unknown;
    latencyMs: number;
    cached: boolean;
    errorCode: string | null;
    statusCode: number;
    modelUsed: string | null;
    createdAt: Date;
  };
}

function DetailContent({ log }: DetailContentProps) {
  const statusColor = getStatusColor(log.statusCode);
  const latencyColor = getLatencyColor(log.latencyMs);

  return (
    <div className="mt-6 space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-4">
        <InfoItem
          icon={<Clock className="h-4 w-4" />}
          label="Timestamp"
          value={formatTimestamp(log.createdAt)}
        />
        <InfoItem
          icon={<Badge className={`${statusColor} text-xs`}>{log.statusCode}</Badge>}
          label="Status"
          value={log.statusCode >= 200 && log.statusCode < 300 ? "Success" : "Error"}
        />
        <InfoItem
          icon={<Clock className="h-4 w-4" />}
          label="Latency"
          value={<span className={latencyColor}>{log.latencyMs}ms</span>}
        />
        <InfoItem
          icon={<Cpu className="h-4 w-4" />}
          label="Model"
          value={log.modelUsed ?? "—"}
        />
        <InfoItem
          icon={<Database className="h-4 w-4" />}
          label="Cached"
          value={log.cached ? "Yes" : "No"}
        />
        {log.inputHash && (
          <InfoItem
            icon={<Hash className="h-4 w-4" />}
            label="Input Hash"
            value={<code className="text-xs">{log.inputHash.slice(0, 16)}...</code>}
          />
        )}
      </div>

      {/* Error details */}
      {log.errorCode && (
        <div className="rounded-md bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Error: {log.errorCode}</span>
          </div>
        </div>
      )}

      {/* Request Input */}
      <JsonSection
        title="Request Input"
        data={log.input}
        copyLabel="Copy Input"
      />

      {/* Response Output */}
      <JsonSection
        title="Response Output"
        data={log.output}
        copyLabel="Copy Output"
      />

      {/* Metadata */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Metadata</h4>
        <div className="rounded-md bg-muted/50 p-3 text-xs font-mono space-y-1">
          <div>
            <span className="text-muted-foreground">Log ID: </span>
            {log.id}
          </div>
          <div>
            <span className="text-muted-foreground">Process ID: </span>
            {log.processId}
          </div>
          {log.processVersionId && (
            <div>
              <span className="text-muted-foreground">Version ID: </span>
              {log.processVersionId}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

interface JsonSectionProps {
  title: string;
  data: unknown;
  copyLabel: string;
}

function JsonSection({ title, data, copyLabel }: JsonSectionProps) {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available, silently fail
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 text-xs"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              {copyLabel}
            </>
          )}
        </Button>
      </div>
      <div className="rounded-md overflow-hidden text-xs">
        <SyntaxHighlighter
          language="json"
          style={atomOneDark}
          customStyle={{
            margin: 0,
            padding: "1rem",
            maxHeight: "200px",
            overflow: "auto",
          }}
        >
          {jsonString}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

function getStatusColor(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) {
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  }
  if (statusCode >= 400 && statusCode < 500) {
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  }
  if (statusCode >= 500) {
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  }
  return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
}

function getLatencyColor(latencyMs: number): string {
  if (latencyMs < 500) return "text-green-600";
  if (latencyMs < 2000) return "text-yellow-600";
  return "text-red-600";
}

function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
