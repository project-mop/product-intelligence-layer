"use client";

import { useMemo } from "react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { generateSamplePayload } from "~/lib/schema/sample-generator";

// Register JSON language for syntax highlighting
SyntaxHighlighter.registerLanguage("json", json);

interface ExampleResponseSectionProps {
  /** JSON Schema for output to generate sample response */
  outputSchema: Record<string, unknown>;
  /** Optional class name for styling */
  className?: string;
}

/**
 * ExampleResponseSection Component
 *
 * Displays a mock success response based on the output schema,
 * including the standard response envelope with meta fields.
 *
 * AC: 7 - Example Response: Shows example success response (mock or last test response)
 *
 * @see docs/stories/3-6-auto-generated-api-documentation.md
 */
export function ExampleResponseSection({
  outputSchema,
  className,
}: ExampleResponseSectionProps) {
  // Generate sample response data from output schema
  const sampleResponse = useMemo(() => {
    const sampleData = generateSamplePayload(outputSchema, true);

    // Wrap in standard response envelope per architecture.md API Contracts
    return {
      success: true,
      data: sampleData,
      meta: {
        version: "1.0.0",
        cached: false,
        latency_ms: 1245,
        request_id: "req_01H2X3Y4Z5A6B7C8D9E0",
      },
    };
  }, [outputSchema]);

  // Format JSON with proper indentation
  const jsonResponse = useMemo(() => {
    return JSON.stringify(sampleResponse, null, 2);
  }, [sampleResponse]);

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Example Response</CardTitle>
          <Badge className="bg-green-500/10 text-green-600 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-800">
            200 OK
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* JSON Response */}
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
            {jsonResponse}
          </SyntaxHighlighter>
        </div>

        {/* Meta fields explanation */}
        <div className="rounded-md border bg-muted/30 p-3">
          <h4 className="text-sm font-medium mb-2">Response Meta Fields</h4>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="font-mono text-muted-foreground">version</dt>
              <dd>API version used for this response</dd>
            </div>
            <div>
              <dt className="font-mono text-muted-foreground">cached</dt>
              <dd>Whether the response was served from cache</dd>
            </div>
            <div>
              <dt className="font-mono text-muted-foreground">latency_ms</dt>
              <dd>Processing time in milliseconds</dd>
            </div>
            <div>
              <dt className="font-mono text-muted-foreground">request_id</dt>
              <dd>Unique identifier for debugging</dd>
            </div>
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}
