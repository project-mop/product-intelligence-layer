"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Loader2 } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { VersionHistoryTable } from "~/components/process/VersionHistoryTable";
import { VersionDetailDrawer } from "~/components/process/VersionDetailDrawer";
import { VersionCompareDialog } from "~/components/process/VersionCompareDialog";
import { RollbackConfirmDialog } from "~/components/process/RollbackConfirmDialog";

interface VersionHistoryPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Version History Page
 *
 * Displays all versions for a process with ability to:
 * - View version details
 * - Compare versions
 * - Rollback to previous versions
 *
 * Story 5.4 AC: 1, 2, 3 - Version history page accessible from process detail view
 */
export default function VersionHistoryPage({ params }: VersionHistoryPageProps) {
  const { id: processId } = use(params);

  // Version detail drawer state
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Compare dialog state
  const [compareVersion1, setCompareVersion1] = useState<string | null>(null);
  const [compareVersion2, setCompareVersion2] = useState<string | null>(null);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);

  // Rollback dialog state
  const [rollbackVersionId, setRollbackVersionId] = useState<string | null>(null);
  const [rollbackVersion, setRollbackVersion] = useState<string | null>(null);
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);

  // Selection for compare
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  // Fetch process details for name
  const {
    data: process,
    isLoading: isProcessLoading,
    error: processError,
  } = api.process.get.useQuery({ id: processId });

  // Fetch version history
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    error: historyError,
  } = api.process.getHistory.useQuery({ processId });

  const isLoading = isProcessLoading || isHistoryLoading;
  const error = processError ?? historyError;

  // Handle view details
  const handleViewDetails = (versionId: string) => {
    setSelectedVersionId(versionId);
    setDrawerOpen(true);
  };

  // Handle version selection for compare
  const handleSelectForCompare = (versionId: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(versionId)) {
        return prev.filter((id) => id !== versionId);
      }
      // Max 2 versions for compare
      if (prev.length >= 2) {
        return [prev[1]!, versionId];
      }
      return [...prev, versionId];
    });
  };

  // Handle compare button click
  const handleCompare = () => {
    if (selectedForCompare.length === 2) {
      setCompareVersion1(selectedForCompare[0]!);
      setCompareVersion2(selectedForCompare[1]!);
      setCompareDialogOpen(true);
    }
  };

  // Handle rollback
  const handleRollback = (versionId: string, version: string) => {
    setRollbackVersionId(versionId);
    setRollbackVersion(version);
    setRollbackDialogOpen(true);
  };

  // Handle rollback success
  const handleRollbackSuccess = () => {
    setRollbackVersionId(null);
    setRollbackVersion(null);
    setSelectedForCompare([]);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href={`/dashboard/processes/${processId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Process
          </Link>
          <div className="mt-8 rounded-md bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              {error.message === "Process not found"
                ? "This process was not found or you don't have access to it."
                : `Failed to load version history: ${error.message}`}
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
        <div className="mb-6">
          <Link
            href={`/dashboard/processes/${processId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {process?.name ?? "Process"}
          </Link>
        </div>

        {/* Title */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <History className="h-6 w-6 text-muted-foreground" />
              <h1 className="text-2xl font-bold text-foreground">
                Version History
              </h1>
            </div>
            <p className="mt-2 text-muted-foreground">
              {process?.name} - {historyData?.totalCount ?? 0} version
              {(historyData?.totalCount ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedForCompare.length === 2 && (
              <Button onClick={handleCompare}>
                Compare Selected
              </Button>
            )}
            {selectedForCompare.length > 0 && selectedForCompare.length < 2 && (
              <p className="text-sm text-muted-foreground">
                Select one more version to compare
              </p>
            )}
          </div>
        </div>

        {/* Version History Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Versions</CardTitle>
          </CardHeader>
          <CardContent>
            {historyData && historyData.versions.length > 0 ? (
              <VersionHistoryTable
                versions={historyData.versions}
                selectedForCompare={selectedForCompare}
                onViewDetails={handleViewDetails}
                onSelectForCompare={handleSelectForCompare}
                onRollback={handleRollback}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No versions found for this process.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Version Detail Drawer */}
        {selectedVersionId && (
          <VersionDetailDrawer
            processId={processId}
            versionId={selectedVersionId}
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            onCompare={(version1Id) => {
              // Pre-select this version for compare
              setSelectedForCompare([version1Id]);
              setDrawerOpen(false);
            }}
            onRollback={(versionId, version) => {
              handleRollback(versionId, version);
              setDrawerOpen(false);
            }}
          />
        )}

        {/* Version Compare Dialog */}
        {compareVersion1 && compareVersion2 && (
          <VersionCompareDialog
            processId={processId}
            version1Id={compareVersion1}
            version2Id={compareVersion2}
            open={compareDialogOpen}
            onOpenChange={setCompareDialogOpen}
            onSwap={() => {
              const temp = compareVersion1;
              setCompareVersion1(compareVersion2);
              setCompareVersion2(temp);
            }}
          />
        )}

        {/* Rollback Confirm Dialog */}
        {rollbackVersionId && rollbackVersion && (
          <RollbackConfirmDialog
            processId={processId}
            versionId={rollbackVersionId}
            version={rollbackVersion}
            open={rollbackDialogOpen}
            onOpenChange={setRollbackDialogOpen}
            onRollbackSuccess={handleRollbackSuccess}
          />
        )}
      </div>
    </div>
  );
}
