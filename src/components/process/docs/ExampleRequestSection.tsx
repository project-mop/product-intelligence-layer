"use client";

import { useState, useMemo, useCallback } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import bash from "react-syntax-highlighter/dist/esm/languages/hljs/bash";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { generateSamplePayload } from "~/lib/schema/sample-generator";
import { generateCurlCommand } from "~/lib/api/curl-generator";

// Register languages for syntax highlighting
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("bash", bash);

interface ExampleRequestSectionProps {
  /** Process ID (proc_*) */
  processId: string;
  /** JSON Schema for input to generate sample payload */
  inputSchema: Record<string, unknown>;
  /** Optional class name for styling */
  className?: string;
}

/**
 * ExampleRequestSection Component
 *
 * Displays a sample request payload auto-generated from the input schema.
 * Includes both JSON body and cURL command examples with copy functionality.
 *
 * AC: 6 - Example Request: Shows sample request payload auto-generated from input schema
 * AC: 9 - Copy Functionality: Copy buttons for sample request body
 *
 * @see docs/stories/3-6-auto-generated-api-documentation.md
 */
export function ExampleRequestSection({
  processId,
  inputSchema,
  className,
}: ExampleRequestSectionProps) {
  const [jsonCopied, setJsonCopied] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);

  // Generate sample payload from schema (reuse from Story 3.3)
  const samplePayload = useMemo(() => {
    return generateSamplePayload(inputSchema, true); // Include optional fields
  }, [inputSchema]);

  // Format JSON with proper indentation
  const jsonBody = useMemo(() => {
    return JSON.stringify({ input: samplePayload }, null, 2);
  }, [samplePayload]);

  // Generate cURL command
  const curlCommand = useMemo(() => {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return generateCurlCommand(processId, { input: samplePayload }, baseUrl);
  }, [processId, samplePayload]);

  /**
   * Copy JSON body to clipboard
   */
  const handleCopyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonBody);
      setJsonCopied(true);
      toast.success("Request body copied to clipboard");
      setTimeout(() => setJsonCopied(false), 2000);
    } catch {
      toast.error("Failed to copy request body");
    }
  }, [jsonBody]);

  /**
   * Copy cURL command to clipboard
   */
  const handleCopyCurl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCurlCopied(true);
      toast.success("cURL command copied to clipboard");
      setTimeout(() => setCurlCopied(false), 2000);
    } catch {
      toast.error("Failed to copy cURL command");
    }
  }, [curlCommand]);

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Example Request</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="json" className="w-full">
          <div className="flex items-center justify-between mb-3">
            <TabsList>
              <TabsTrigger value="json">JSON Body</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
            </TabsList>
          </div>

          {/* JSON Body Tab */}
          <TabsContent value="json" className="mt-0">
            <div className="relative">
              <div className="absolute right-2 top-2 z-10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyJson}
                  className="h-7 gap-1.5 bg-background/80 backdrop-blur-sm"
                >
                  {jsonCopied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy
                </Button>
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
                    maxHeight: "300px",
                    overflow: "auto",
                  }}
                >
                  {jsonBody}
                </SyntaxHighlighter>
              </div>
            </div>
          </TabsContent>

          {/* cURL Tab */}
          <TabsContent value="curl" className="mt-0">
            <div className="relative">
              <div className="absolute right-2 top-2 z-10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCurl}
                  className="h-7 gap-1.5 bg-background/80 backdrop-blur-sm"
                >
                  {curlCopied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Terminal className="h-3.5 w-3.5" />
                  )}
                  Copy
                </Button>
              </div>
              <div className="rounded-md overflow-hidden">
                <SyntaxHighlighter
                  language="bash"
                  style={atomOneDark}
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.75rem",
                    maxHeight: "300px",
                    overflow: "auto",
                  }}
                >
                  {curlCommand}
                </SyntaxHighlighter>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Replace <code className="font-mono bg-muted px-1 rounded">YOUR_API_KEY</code> with your actual API key.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
