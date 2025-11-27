"use client";

import { useState, useCallback, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import type { JSONSchema7 } from "json-schema";

import { api } from "~/trpc/react";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { cn } from "~/lib/utils";

import {
  type WizardData,
  WizardStep,
  wizardSteps,
  defaultWizardData,
  type ComponentDefinition,
} from "~/components/process/types";
import { NameStep } from "~/components/process/steps/NameStep";
import { InputSchemaStep } from "~/components/process/steps/InputSchemaStep";
import { GoalStep } from "~/components/process/steps/GoalStep";
import { OutputSchemaStep } from "~/components/process/steps/OutputSchemaStep";
import { EditReviewStep } from "~/components/process/steps/EditReviewStep";
import {
  saveEditDraft,
  loadEditDraft,
  clearEditDraft,
} from "~/lib/wizard-storage";

/**
 * Edit-mode wizard steps (no template selection).
 */
const editWizardSteps = wizardSteps.filter(
  (s) => s.step !== WizardStep.Template
);

/**
 * Map edit step index (0-4) to WizardStep enum.
 */
const editStepToWizardStep = [
  WizardStep.Name,
  WizardStep.InputSchema,
  WizardStep.Goal,
  WizardStep.OutputSchema,
  WizardStep.Review,
];

/**
 * Step indicator component for edit wizard (5 steps, no template).
 */
function EditStepIndicator({
  currentEditStep,
  completedSteps,
}: {
  currentEditStep: number;
  completedSteps: Set<number>;
}) {
  const progress = ((currentEditStep + 1) / editWizardSteps.length) * 100;

  return (
    <div className="space-y-4">
      <Progress value={progress} className="h-2" />
      <div className="flex justify-between">
        {editWizardSteps.map(({ step, label }, index) => {
          const isActive = index === currentEditStep;
          const isCompleted = completedSteps.has(index);
          const isPast = index < currentEditStep;

          return (
            <div
              key={step}
              className={cn(
                "flex flex-col items-center gap-1 text-xs transition-colors",
                isActive && "text-primary font-medium",
                isPast && !isActive && "text-muted-foreground",
                !isActive && !isPast && "text-muted-foreground/50"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  isCompleted && !isActive && "border-primary bg-primary/10 text-primary",
                  !isActive && !isCompleted && "border-muted"
                )}
              >
                {isCompleted && !isActive ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span className="hidden sm:block">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Convert server process config to WizardData format.
 */
function processToWizardData(
  process: {
    name: string;
    description: string | null;
    inputSchema: unknown;
    outputSchema: unknown;
    versions: Array<{ config: unknown; environment: string }>;
  }
): WizardData {
  // Get the latest version config
  const latestVersion = process.versions[0];
  const config = (latestVersion?.config ?? {}) as {
    goal?: string;
    components?: ComponentDefinition[];
  };

  // Determine output type from schema
  const outputSchema = process.outputSchema as JSONSchema7;
  const isTextOutput = outputSchema.type === "string";

  return {
    name: process.name,
    description: process.description ?? "",
    inputSchema: process.inputSchema as JSONSchema7,
    outputSchema: outputSchema,
    goal: config.goal ?? "",
    outputType: isTextOutput ? "text" : "structured",
    advancedMode: (config.components?.length ?? 0) > 0,
    components: config.components ?? [],
  };
}

interface EditProcessPageProps {
  params: Promise<{ id: string }>;
}

export default function EditProcessPage({ params }: EditProcessPageProps) {
  const { id: processId } = use(params);
  const router = useRouter();

  // Fetch process data
  const {
    data: process,
    isLoading,
    error,
  } = api.process.get.useQuery({ id: processId });

  // Edit wizard state (0-4 instead of 0-5, no template step)
  const [currentEditStep, setCurrentEditStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>(defaultWizardData);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);

  // Check for saved edit draft on mount and initialize with process data
  useEffect(() => {
    if (!process) return;

    const draft = loadEditDraft(processId);
    if (draft) {
      // Resume from draft
      setWizardData(draft.data);
      setCurrentEditStep(draft.editStep);
      // Mark previous steps as completed
      const completed = new Set<number>();
      for (let i = 0; i < draft.editStep; i++) {
        completed.add(i);
      }
      setCompletedSteps(completed);
      setHasDraftChanges(true);
    } else {
      // Initialize from process data
      setWizardData(processToWizardData(process));
    }
    setIsInitialized(true);
  }, [process, processId]);

  // Auto-save on data change (debounced)
  useEffect(() => {
    if (!isInitialized || !process) return;

    const timer = setTimeout(() => {
      saveEditDraft(processId, wizardData, currentEditStep);
      setHasDraftChanges(true);
    }, 1000); // 1s debounce per AC

    return () => clearTimeout(timer);
  }, [wizardData, currentEditStep, isInitialized, processId, process]);

  // Update wizard data
  const handleDataChange = useCallback((data: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...data }));
  }, []);

  // Navigation
  const handleNext = useCallback(() => {
    setCompletedSteps((prev) => new Set([...prev, currentEditStep]));
    setCurrentEditStep((prev) => Math.min(prev + 1, editWizardSteps.length - 1));
  }, [currentEditStep]);

  const handleBack = useCallback(() => {
    setCurrentEditStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // Handle successful save
  const handleSuccess = useCallback(() => {
    clearEditDraft(processId);
    router.push("/dashboard/processes?updated=true");
  }, [router, processId]);

  // Map current edit step to WizardStep enum for step components
  const currentWizardStep = editStepToWizardStep[currentEditStep] ?? WizardStep.Name;

  // Determine if editing a published version
  const hasProductionVersion = process?.hasProductionVersion ?? false;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-3xl flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-3xl">
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
        <div className="mx-auto max-w-3xl">
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

  // Wait for initialization
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-3xl flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/processes"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Intelligences
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-foreground">
            Edit Intelligence
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Modify your intelligence definition: {process.name}
          </p>
        </div>

        {/* Published version warning */}
        {hasProductionVersion && (
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              This intelligence has a published version. Changes will be saved as a new draft
              and won&apos;t affect the live version until published.
            </AlertDescription>
          </Alert>
        )}

        {/* Auto-save indicator */}
        {hasDraftChanges && (
          <p className="mb-4 text-xs text-muted-foreground">
            Changes auto-saved to browser
          </p>
        )}

        {/* Step Indicator */}
        <div className="mb-8">
          <EditStepIndicator
            currentEditStep={currentEditStep}
            completedSteps={completedSteps}
          />
        </div>

        {/* Step Content */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          {currentEditStep === 0 && (
            <NameStep
              data={wizardData}
              onDataChange={handleDataChange}
              onNext={handleNext}
              onBack={() => router.push("/dashboard/processes")}
              currentStep={currentWizardStep}
            />
          )}

          {currentEditStep === 1 && (
            <InputSchemaStep
              data={wizardData}
              onDataChange={handleDataChange}
              onNext={handleNext}
              onBack={handleBack}
              currentStep={currentWizardStep}
            />
          )}

          {currentEditStep === 2 && (
            <GoalStep
              data={wizardData}
              onDataChange={handleDataChange}
              onNext={handleNext}
              onBack={handleBack}
              currentStep={currentWizardStep}
            />
          )}

          {currentEditStep === 3 && (
            <OutputSchemaStep
              data={wizardData}
              onDataChange={handleDataChange}
              onNext={handleNext}
              onBack={handleBack}
              currentStep={currentWizardStep}
            />
          )}

          {currentEditStep === 4 && (
            <EditReviewStep
              data={wizardData}
              processId={processId}
              originalProcess={process}
              onDataChange={handleDataChange}
              onNext={handleSuccess}
              onBack={handleBack}
              currentStep={currentWizardStep}
            />
          )}
        </div>
      </div>
    </div>
  );
}
