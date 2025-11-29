/**
 * Intelligence Card Component
 *
 * Displays a process/intelligence in card format with name, description,
 * status badge, and hover action buttons.
 *
 * @see docs/stories/3-4-intelligence-list-dashboard.md - AC: 2, 3, 8
 */

"use client";

import Link from "next/link";
import { FlaskConical, Pencil, FileText } from "lucide-react";

import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { ProcessStatusBadge } from "./ProcessStatusBadge";
import { EnvironmentBadge } from "~/components/process/EnvironmentBadge";
import type { ProcessStatus } from "~/lib/process/status";

/**
 * Process data shape for the card.
 */
export interface ProcessWithStatus {
  id: string;
  name: string;
  description: string | null;
  status: ProcessStatus;
  hasSandbox?: boolean;
  hasProduction?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntelligenceCardProps {
  process: ProcessWithStatus;
  onTest: () => void;
  onEdit: () => void;
  onDocs: () => void;
}

/**
 * Truncates description to approximately 100 characters with ellipsis.
 */
function truncateDescription(description: string | null, maxLength = 100): string {
  if (!description) return "";
  if (description.length <= maxLength) return description;
  return description.slice(0, maxLength).trim() + "...";
}

export function IntelligenceCard({
  process,
  onTest,
  onEdit,
  onDocs,
}: IntelligenceCardProps) {
  const truncatedDescription = truncateDescription(process.description);

  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <Link
        href={`/dashboard/processes/${process.id}`}
        className="block"
      >
        <CardContent className="p-6">
          {/* Header: Name and Status */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground truncate flex-1 min-w-0">
              {process.name}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Environment badges - Story 5.1 AC: 8 */}
              {process.hasSandbox && (
                <EnvironmentBadge environment="SANDBOX" size="sm" />
              )}
              {process.hasProduction && (
                <EnvironmentBadge environment="PRODUCTION" size="sm" />
              )}
              <ProcessStatusBadge status={process.status} />
            </div>
          </div>

          {/* Description */}
          {truncatedDescription ? (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              {truncatedDescription}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground/60 italic">
              No description
            </p>
          )}

          {/* Spacer for action buttons */}
          <div className="h-10 mt-4" />
        </CardContent>
      </Link>

      {/* Quick Actions - Show on hover */}
      <div className="absolute bottom-6 left-6 right-6 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTest();
          }}
        >
          <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
          Test
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDocs();
          }}
        >
          <FileText className="h-3.5 w-3.5 mr-1.5" />
          Docs
        </Button>
      </div>
    </Card>
  );
}
