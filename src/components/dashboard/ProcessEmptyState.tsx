/**
 * Process Empty State Component
 *
 * Displays friendly message with Create Intelligence CTA when no intelligences exist.
 *
 * @see docs/stories/3-4-intelligence-list-dashboard.md - AC: 7
 */

import Link from "next/link";
import { Zap, Plus } from "lucide-react";

import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

export function ProcessEmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <Zap className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          No intelligences yet
        </h3>
        <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
          Create your first intelligence to get started.
        </p>
        <Link href="/dashboard/processes/new" className="mt-6">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Intelligence
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
