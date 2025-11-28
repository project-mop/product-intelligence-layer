"use client";

import { AlertTriangle } from "lucide-react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

// Register JSON language for syntax highlighting
SyntaxHighlighter.registerLanguage("json", json);

interface ErrorCodesProps {
  /** Optional class name for styling */
  className?: string;
}

/**
 * Error codes documentation per architecture.md Error Handling Matrix
 */
const ERROR_CODES = [
  {
    code: 401,
    name: "Unauthorized",
    description: "Invalid or missing API key",
    retryable: false,
  },
  {
    code: 403,
    name: "Forbidden",
    description: "API key lacks access to this process",
    retryable: false,
  },
  {
    code: 404,
    name: "Not Found",
    description: "Process not found or not published",
    retryable: false,
  },
  {
    code: 500,
    name: "Internal Server Error",
    description: "Output validation failed or unexpected error",
    retryable: false,
  },
  {
    code: 503,
    name: "Service Unavailable",
    description: "LLM provider temporarily unavailable",
    retryable: true,
  },
];

/**
 * Example error response format
 */
const ERROR_RESPONSE_EXAMPLE = JSON.stringify(
  {
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Invalid or missing API key",
      details: {
        hint: "Ensure your API key is valid and included in the Authorization header",
      },
    },
  },
  null,
  2
);

/**
 * ErrorCodesSection Component
 *
 * Documents all error codes and response format for the API.
 *
 * AC: 8 - Error Codes Section: Documents all error codes: 401, 403, 404, 500, 503
 *
 * @see docs/stories/3-6-auto-generated-api-documentation.md
 * @see docs/architecture.md#Error-Handling-Matrix
 */
export function ErrorCodesSection({ className }: ErrorCodesProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Error Codes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error codes table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Code</TableHead>
                <TableHead className="w-[150px]">Status</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px] text-right">Retry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ERROR_CODES.map((error) => (
                <TableRow key={error.code}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-mono",
                        error.code >= 500
                          ? "text-orange-600 border-orange-200 dark:text-orange-400 dark:border-orange-800"
                          : "text-red-600 border-red-200 dark:text-red-400 dark:border-red-800"
                      )}
                    >
                      {error.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{error.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {error.description}
                  </TableCell>
                  <TableCell className="text-right">
                    {error.retryable ? (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-200 dark:text-green-400 dark:border-green-800"
                      >
                        Yes
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Error response format */}
        <div>
          <h4 className="text-sm font-medium mb-2">Error Response Format</h4>
          <div className="rounded-md overflow-hidden">
            <SyntaxHighlighter
              language="json"
              style={atomOneDark}
              customStyle={{
                margin: 0,
                padding: "1rem",
                borderRadius: "0.375rem",
                fontSize: "0.75rem",
              }}
            >
              {ERROR_RESPONSE_EXAMPLE}
            </SyntaxHighlighter>
          </div>
        </div>

        {/* Retry guidance */}
        <div className="rounded-md bg-amber-500/10 border border-amber-200 dark:border-amber-800 p-3">
          <h4 className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
            Retry Guidance
          </h4>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            For <strong>503 Service Unavailable</strong> errors, check the{" "}
            <code className="font-mono bg-amber-200/50 dark:bg-amber-800/50 px-1 rounded">
              Retry-After
            </code>{" "}
            header for recommended wait time before retrying. Implement exponential backoff
            with a maximum of 3 retry attempts.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
