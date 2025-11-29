/**
 * Call Log Error State Component
 *
 * Displays error message with retry button when data fails to load.
 *
 * @see docs/stories/6-2-call-history-ui.md - AC: 9
 */

import { AlertCircle, RefreshCw } from "lucide-react";

import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

interface CallLogErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export function CallLogErrorState({ message, onRetry }: CallLogErrorStateProps) {
  return (
    <Card className="border-destructive/50">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          Failed to load call history
        </h3>
        <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
          {message ?? "An error occurred while fetching call logs. Please try again."}
        </p>
        <Button onClick={onRetry} variant="outline" className="mt-6 gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
