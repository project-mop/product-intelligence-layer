"use client";

import { use, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Loader2, FileText, Play, FileJson, History } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { EndpointUrl } from "~/components/process/EndpointUrl";
import { CacheTtlSettings } from "~/components/process/CacheTtlSettings";
import { EnvironmentBanner } from "~/components/process/EnvironmentBanner";
import { EnvironmentSelector } from "~/components/process/EnvironmentSelector";
import { EnvironmentBadge } from "~/components/process/EnvironmentBadge";
import { PromoteButton } from "~/components/process/PromoteButton";
import { PromotionConfirmDialog } from "~/components/process/PromotionConfirmDialog";
import { DEFAULT_PROCESS_CONFIG } from "~/server/services/process/types";

function formatDate(date: Date | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ProcessDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Process Detail Page
 *
 * Displays detailed information about an intelligence process,
 * including the API endpoint URL prominently at the top.
 *
 * AC: 3 - Prominent Display: Endpoint URL displayed prominently after saving
 * AC: 5 - Show "Not yet callable" message for draft-only processes
 *
 * @see docs/stories/3-1-endpoint-url-generation.md
 */
export default function ProcessDetailPage({ params }: ProcessDetailPageProps) {
  const { id: processId } = use(params);
  const router = useRouter();

  const {
    data: process,
    isLoading,
    error,
  } = api.process.get.useQuery({ id: processId });

  // Mutation for updating cache settings - must be before any early returns
  const utils = api.useUtils();
  const updateVersionConfig = api.process.updateVersionConfig.useMutation({
    onSuccess: () => {
      void utils.process.get.invalidate({ id: processId });
    },
  });

  // Handle cache settings change
  const handleCacheSettingsChange = useCallback(
    (config: { cacheTtlSeconds: number; cacheEnabled: boolean }) => {
      updateVersionConfig.mutate({
        processId,
        config,
      });
    },
    [processId, updateVersionConfig]
  );

  // Story 5.1: Environment state management - must be before early returns
  const [selectedEnvironment, setSelectedEnvironment] = useState<"SANDBOX" | "PRODUCTION">("SANDBOX");

  // Story 5.3: Promotion dialog state
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [versionToPromote, setVersionToPromote] = useState<string | null>(null);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-4xl flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/dashboard/processes"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Intelligences
          </Link>
          <div className="mt-8 rounded-md bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              {error.message === "Process not found"
                ? "This intelligence was not found or you don't have access to it."
                : `Failed to load intelligence: ${error.message}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!process) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/dashboard/processes"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Intelligences
          </Link>
          <div className="mt-8 rounded-md bg-destructive/10 p-4">
            <p className="text-sm text-destructive">Intelligence not found.</p>
          </div>
        </div>
      </div>
    );
  }

  // Determine if process has a published version (SANDBOX or PRODUCTION)
  const hasPublishedVersion = process.versions.some(
    (v) => v.environment === "SANDBOX" || v.environment === "PRODUCTION"
  );

  // Story 5.1 AC: 5 - Check version status for both environments
  const sandboxVersion = process.versions.find(
    (v) => v.environment === "SANDBOX" && v.deprecatedAt === null
  );
  const productionVersion = process.versions.find(
    (v) => v.environment === "PRODUCTION" && v.deprecatedAt === null
  );

  // Get cache settings from the version for the selected environment
  const activeVersion = selectedEnvironment === "PRODUCTION" && productionVersion
    ? productionVersion
    : sandboxVersion;
  const versionConfig = (activeVersion?.config ?? {}) as {
    cacheTtlSeconds?: number;
    cacheEnabled?: boolean;
  };
  const cacheTtlSeconds = versionConfig.cacheTtlSeconds ?? DEFAULT_PROCESS_CONFIG.cacheTtlSeconds;
  const cacheEnabled = versionConfig.cacheEnabled ?? DEFAULT_PROCESS_CONFIG.cacheEnabled;

  return (
    <div className="min-h-screen bg-background">
      {/* Story 5.1 AC: 4 - Environment banner at top */}
      <EnvironmentBanner environment={selectedEnvironment} />

      <div className="p-8">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/dashboard/processes"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Intelligences
            </Link>
          </div>

          {/* Title and Actions */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">
                  {process.name}
                </h1>
                {/* Story 5.1 AC: 5 - Show version status for both environments */}
                <div className="flex items-center gap-2">
                  {sandboxVersion && <EnvironmentBadge environment="SANDBOX" size="md" />}
                  {productionVersion && <EnvironmentBadge environment="PRODUCTION" size="md" />}
                </div>
              </div>
              {process.description && (
                <p className="mt-2 text-muted-foreground">{process.description}</p>
              )}
              {/* Story 5.1 AC: 5 - Version status summary */}
              <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Sandbox: {sandboxVersion ? `v${sandboxVersion.version}` : "Not deployed"}
                </span>
                <span>
                  Production: {productionVersion ? `v${productionVersion.version}` : "Not deployed"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Story 5.3 AC: 1 - Promote to Production button */}
              {sandboxVersion && (
                <PromoteButton
                  version={{
                    id: sandboxVersion.id,
                    environment: sandboxVersion.environment as "SANDBOX" | "PRODUCTION",
                    status: sandboxVersion.status as "DRAFT" | "ACTIVE" | "DEPRECATED",
                  }}
                  onPromote={() => {
                    setVersionToPromote(sandboxVersion.id);
                    setPromotionDialogOpen(true);
                  }}
                />
              )}
              {/* Story 5.1 AC: 9, 10 - Environment selector */}
              <EnvironmentSelector
                currentEnvironment={selectedEnvironment}
                onEnvironmentChange={setSelectedEnvironment}
                productionAvailable={!!productionVersion}
              />
              {/* Schema button - Story 3.5 AC: 1 */}
              <Button
                variant="outline"
                onClick={() => router.push(`/dashboard/processes/${processId}/schema`)}
              >
                <FileJson className="h-4 w-4 mr-2" />
                Schema
              </Button>
              {/* Test button - Story 3.3 AC: 1 */}
              {hasPublishedVersion && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/processes/${processId}/test`)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Test
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => router.push(`/dashboard/processes/${processId}/edit`)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>

          {/* Endpoint URL - Positioned prominently (AC: 3) */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">API Endpoint</CardTitle>
          </CardHeader>
          <CardContent>
            <EndpointUrl
              processId={processId}
              isPublished={hasPublishedVersion}
              environment={selectedEnvironment}
            />
            {/* API Docs link - Story 3.6 AC: 1 */}
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/dashboard/processes/${processId}/docs`)}
              >
                <FileText className="h-4 w-4 mr-2" />
                API Documentation
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Process Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Process ID</span>
                <p className="font-mono text-foreground">{process.id}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Versions</span>
                <p className="text-foreground">{process.versionCount}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Created</span>
                <p className="text-foreground">{formatDate(process.createdAt)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Last Updated</span>
                <p className="text-foreground">{formatDate(process.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cache Settings - Story 4.6 AC: 6 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Cache Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <CacheTtlSettings
              cacheTtlSeconds={cacheTtlSeconds}
              cacheEnabled={cacheEnabled}
              onChange={handleCacheSettingsChange}
              disabled={updateVersionConfig.isPending}
            />
            {updateVersionConfig.error && (
              <p className="mt-2 text-sm text-destructive">
                Failed to update cache settings: {updateVersionConfig.error.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Versions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Versions</CardTitle>
            {/* Story 5.4 AC: 1 - Version history link */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/dashboard/processes/${processId}/versions`)}
            >
              <History className="h-4 w-4 mr-2" />
              View History
            </Button>
          </CardHeader>
          <CardContent>
            {process.versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No versions yet.</p>
            ) : (
              <div className="space-y-3">
                {process.versions.map((version, index) => (
                  <div key={version.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            v{version.version}
                          </span>
                          <Badge
                            variant={
                              version.environment === "PRODUCTION"
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {version.environment}
                          </Badge>
                          {version.deprecatedAt && (
                            <Badge variant="outline" className="text-xs text-orange-600">
                              Deprecated
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {formatDate(version.createdAt)}
                          {version.publishedAt && (
                            <> &middot; Published {formatDate(version.publishedAt)}</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          </Card>

          {/* Story 5.3 AC: 2, 3, 4 - Promotion confirmation dialog */}
          {versionToPromote && (
            <PromotionConfirmDialog
              open={promotionDialogOpen}
              onOpenChange={setPromotionDialogOpen}
              processId={processId}
              versionId={versionToPromote}
              onPromoted={() => {
                setVersionToPromote(null);
                // Optionally switch to production view after promotion
                setSelectedEnvironment("PRODUCTION");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
