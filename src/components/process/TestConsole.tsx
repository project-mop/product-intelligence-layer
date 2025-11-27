"use client";

import { useState, useMemo, useCallback } from "react";
import { Play, Check, Loader2, AlertCircle, Clock, Terminal } from "lucide-react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { generateSamplePayload } from "~/lib/schema/sample-generator";
import { generateCurlCommand } from "~/lib/api/curl-generator";
import { api } from "~/trpc/react";

// Register JSON language for syntax highlighting
SyntaxHighlighter.registerLanguage("json", json);

interface TestConsoleProps {
  /** Process ID (proc_*) */
  processId: string;
  /** Process name for display */
  _processName?: string;
  /** JSON Schema for input validation and sample generation */
  inputSchema: Record<string, unknown>;
  /** Optional class name */
  className?: string;
}

/**
 * Response state type
 */
type ResponseState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "success";
      data: Record<string, unknown>;
      meta: { latency_ms: number; request_id: string };
    }
  | { status: "error"; error: string; code?: string };

/**
 * TestConsole Component
 *
 * Split-panel interface for testing intelligence endpoints in the browser.
 * Left panel: Editable JSON input with syntax highlighting
 * Right panel: Response display with latency and error handling
 *
 * AC: 2 - Editable Input Panel with syntax highlighting
 * AC: 3 - Sample payload auto-generated from input schema
 * AC: 4 - Send Request button with loading state
 * AC: 5 - Response Panel with formatted JSON
 * AC: 6 - Latency display
 * AC: 7 - Error display with appropriate styling
 * AC: 8 - Copy cURL command
 *
 * @see docs/stories/3-3-in-browser-endpoint-testing.md
 */
export function TestConsole({
  processId,
  inputSchema,
  className,
}: TestConsoleProps) {
  // Generate initial sample payload from schema
  const initialPayload = useMemo(() => {
    const sample = generateSamplePayload(inputSchema);
    return JSON.stringify(sample, null, 2);
  }, [inputSchema]);

  // State
  const [inputJson, setInputJson] = useState(initialPayload);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [response, setResponse] = useState<ResponseState>({ status: "idle" });
  const [curlCopied, setCurlCopied] = useState(false);

  // tRPC mutation for test generation
  const testMutation = api.process.testGenerate.useMutation({
    onSuccess: (data) => {
      setResponse({
        status: "success",
        data: data.data,
        meta: data.meta,
      });
    },
    onError: (error) => {
      setResponse({
        status: "error",
        error: error.message,
        code: error.data?.code,
      });
    },
  });

  // Validate JSON on change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setInputJson(value);

      // Validate JSON
      try {
        JSON.parse(value);
        setJsonError(null);
      } catch (err) {
        setJsonError(err instanceof Error ? err.message : "Invalid JSON");
      }
    },
    []
  );

  // Send test request
  const handleSendRequest = useCallback(async () => {
    // Validate JSON before sending
    let parsedInput: Record<string, unknown>;
    try {
      parsedInput = JSON.parse(inputJson) as Record<string, unknown>;
    } catch {
      setJsonError("Invalid JSON - cannot send request");
      return;
    }

    setResponse({ status: "loading" });
    testMutation.mutate({
      processId,
      input: parsedInput,
    });
  }, [inputJson, processId, testMutation]);

  // Copy cURL command to clipboard
  const handleCopyCurl = useCallback(async () => {
    let parsedInput: Record<string, unknown>;
    try {
      parsedInput = JSON.parse(inputJson) as Record<string, unknown>;
    } catch {
      toast.error("Fix JSON errors before copying cURL command");
      return;
    }

    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";
    const curlCommand = generateCurlCommand(processId, parsedInput, baseUrl);

    try {
      await navigator.clipboard.writeText(curlCommand);
      setCurlCopied(true);
      toast.success("cURL command copied to clipboard");
      setTimeout(() => setCurlCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }, [inputJson, processId]);

  // Format latency for display
  const formatLatency = (ms: number): string => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    return `${ms.toLocaleString()}ms`;
  };

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-6", className)}>
      {/* Left Panel - Request (AC: 2) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Request</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCurl}
              className="gap-2"
            >
              {curlCopied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Terminal className="h-4 w-4" />
              )}
              Copy cURL
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* JSON Input (AC: 2 - Editable with syntax highlighting) */}
          <div className="relative">
            <Textarea
              value={inputJson}
              onChange={handleInputChange}
              placeholder="Enter JSON input..."
              className={cn(
                "font-mono text-sm min-h-[300px] resize-y",
                jsonError && "border-red-500 focus-visible:ring-red-500"
              )}
              spellCheck={false}
            />
            {jsonError && (
              <p className="mt-1 text-xs text-red-500">{jsonError}</p>
            )}
          </div>

          {/* Send Button (AC: 4) */}
          <Button
            onClick={handleSendRequest}
            disabled={!!jsonError || response.status === "loading"}
            className="w-full"
          >
            {response.status === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Send Request
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Right Panel - Response (AC: 5) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Response</CardTitle>
            {response.status === "success" && (
              <div className="flex items-center gap-2">
                {/* Latency Display (AC: 6) */}
                <Badge variant="outline" className="gap-1 font-mono">
                  <Clock className="h-3 w-3" />
                  {formatLatency(response.meta.latency_ms)}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Idle State */}
          {response.status === "idle" && (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <Terminal className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">Send a request to see the response</p>
            </div>
          )}

          {/* Loading State (AC: 4) */}
          {response.status === "loading" && (
            <div className="flex flex-col items-center justify-center h-[300px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                Processing request...
              </p>
            </div>
          )}

          {/* Success State (AC: 5, 6) */}
          {response.status === "success" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant="default"
                  className="bg-green-500/10 text-green-600 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-800"
                >
                  200 OK
                </Badge>
              </div>
              <div className="rounded-md overflow-hidden">
                <SyntaxHighlighter
                  language="json"
                  style={atomOneDark}
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.75rem",
                    maxHeight: "400px",
                    overflow: "auto",
                  }}
                >
                  {JSON.stringify(response.data, null, 2)}
                </SyntaxHighlighter>
              </div>
            </div>
          )}

          {/* Error State (AC: 7) */}
          {response.status === "error" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant="destructive"
                  className="gap-1"
                >
                  <AlertCircle className="h-3 w-3" />
                  Error
                </Badge>
                {response.code && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {response.code}
                  </Badge>
                )}
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-4">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {response.error}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
