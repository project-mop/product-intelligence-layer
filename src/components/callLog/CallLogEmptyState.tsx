/**
 * Call Log Empty State Component
 *
 * Displays friendly message when no call logs exist for a process.
 *
 * @see docs/stories/6-2-call-history-ui.md - AC: 8
 */

import Link from "next/link";
import { History, FileText } from "lucide-react";

import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

interface CallLogEmptyStateProps {
  processId: string;
}

export function CallLogEmptyState({ processId }: CallLogEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-muted p-4 mb-4">
          <History className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          No calls yet
        </h3>
        <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
          This intelligence hasn&apos;t received any API calls yet. Test your endpoint or integrate it into your application.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href={`/dashboard/processes/${processId}/test`}>
            <Button variant="outline" className="gap-2">
              Test Endpoint
            </Button>
          </Link>
          <Link href={`/dashboard/processes/${processId}/docs`}>
            <Button variant="ghost" className="gap-2">
              <FileText className="h-4 w-4" />
              API Docs
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
