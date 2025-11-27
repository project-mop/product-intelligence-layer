"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Zap, MoreHorizontal, Search, Pencil, Copy, Trash2 } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useState } from "react";
import { DuplicateDialog } from "~/components/process/DuplicateDialog";
import { DeleteDialog } from "~/components/process/DeleteDialog";

function formatDate(date: Date | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ProcessCardSkeleton() {
  return (
    <Card className="h-[180px]">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-3/4" />
        <div className="mt-4 flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProcessesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [duplicateProcess, setDuplicateProcess] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteProcess, setDeleteProcess] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: processes, isLoading, error } = api.process.list.useQuery({
    search: search || undefined,
  });

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-md bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              Failed to load intelligences: {error.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Intelligences</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create and manage your product intelligence definitions
            </p>
          </div>
          <Link href="/dashboard/processes/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Intelligence
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search intelligences..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Process Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ProcessCardSkeleton key={i} />
            ))}
          </div>
        ) : !processes || processes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                No intelligences yet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
                Create your first intelligence definition to transform your product data into a working API.
              </p>
              <Link href="/dashboard/processes/new" className="mt-6">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Intelligence
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {processes.map((process) => (
              <Card
                key={process.id}
                className="group transition-shadow hover:shadow-md"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {process.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge
                        variant={process.hasProductionVersion ? "default" : "secondary"}
                      >
                        {process.hasProductionVersion ? "Live" : "Sandbox"}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/dashboard/processes/${process.id}/edit`)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDuplicateProcess({ id: process.id, name: process.name })}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteProcess({ id: process.id, name: process.name })}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {process.description && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {process.description}
                    </p>
                  )}
                  {!process.description && (
                    <p className="mt-2 text-sm text-muted-foreground/60 italic">
                      No description
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {process.versionCount} version{process.versionCount !== 1 ? "s" : ""}
                    </span>
                    <span>Updated {formatDate(process.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Duplicate Dialog */}
      {duplicateProcess && (
        <DuplicateDialog
          open={!!duplicateProcess}
          onOpenChange={(open) => {
            if (!open) setDuplicateProcess(null);
          }}
          process={duplicateProcess}
        />
      )}

      {/* Delete Dialog */}
      {deleteProcess && (
        <DeleteDialog
          open={!!deleteProcess}
          onOpenChange={(open) => {
            if (!open) setDeleteProcess(null);
          }}
          process={deleteProcess}
        />
      )}
    </div>
  );
}
