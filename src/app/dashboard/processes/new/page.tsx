"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";

import {
  type WizardData,
  WizardStep,
  wizardSteps,
  defaultWizardData,
} from "~/components/process/types";
import { TemplatePicker, type ProcessTemplate } from "~/components/process/TemplatePicker";
import { NameStep } from "~/components/process/steps/NameStep";
import { InputSchemaStep } from "~/components/process/steps/InputSchemaStep";
import { GoalStep } from "~/components/process/steps/GoalStep";
import { OutputSchemaStep } from "~/components/process/steps/OutputSchemaStep";
import { ReviewStep } from "~/components/process/steps/ReviewStep";
import {
  loadWizardDraft,
  saveWizardDraft,
  clearWizardDraft,
} from "~/lib/wizard-storage";

/**
 * Step indicator component showing current progress.
 */
function StepIndicator({
  currentStep,
  completedSteps,
}: {
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
}) {
  const progress = ((currentStep + 1) / wizardSteps.length) * 100;

  return (
    <div className="space-y-4">
      <Progress value={progress} className="h-2" />
      <div className="flex justify-between">
        {wizardSteps.map(({ step, label }) => {
          const isActive = step === currentStep;
          const isCompleted = completedSteps.has(step);
          const isPast = step < currentStep;

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
                  step + 1
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
 * Resume draft prompt dialog.
 */
function ResumeDraftPrompt({
  onResume,
  onDiscard,
}: {
  onResume: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Resume Previous Draft?</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        You have an unsaved intelligence definition from a previous session.
        Would you like to continue where you left off?
      </p>
      <div className="mt-4 flex gap-3">
        <Button onClick={onResume}>Resume Draft</Button>
        <Button variant="outline" onClick={onDiscard}>
          Start Fresh
        </Button>
      </div>
    </div>
  );
}

export default function NewProcessPage() {
  const router = useRouter();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.Template);
  const [wizardData, setWizardData] = useState<WizardData>(defaultWizardData);
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());

  // Draft recovery state
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check for saved draft on mount
  useEffect(() => {
    const draft = loadWizardDraft();
    if (draft) {
      setHasSavedDraft(true);
      setShowDraftPrompt(true);
    }
    setIsInitialized(true);
  }, []);

  // Auto-save on data change (debounced)
  useEffect(() => {
    if (!isInitialized || showDraftPrompt) return;

    const timer = setTimeout(() => {
      saveWizardDraft(wizardData, currentStep);
    }, 500);

    return () => clearTimeout(timer);
  }, [wizardData, currentStep, isInitialized, showDraftPrompt]);

  // Handle draft resume
  const handleResumeDraft = useCallback(() => {
    const draft = loadWizardDraft();
    if (draft) {
      setWizardData(draft.data);
      setCurrentStep(draft.step);
      // Mark all previous steps as completed
      const completed = new Set<WizardStep>();
      for (let i = 0; i < draft.step; i++) {
        completed.add(i);
      }
      setCompletedSteps(completed);
    }
    setShowDraftPrompt(false);
  }, []);

  // Handle draft discard
  const handleDiscardDraft = useCallback(() => {
    clearWizardDraft();
    setShowDraftPrompt(false);
  }, []);

  // Update wizard data
  const handleDataChange = useCallback((data: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...data }));
  }, []);

  // Navigation
  const handleNext = useCallback(() => {
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    setCurrentStep((prev) => Math.min(prev + 1, wizardSteps.length - 1) as WizardStep);
  }, [currentStep]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0) as WizardStep);
  }, []);

  // Template selection (special case - also advances to next step)
  const handleTemplateSelect = useCallback(
    (template: ProcessTemplate) => {
      setWizardData((prev) => ({
        ...prev,
        templateId: template.id,
        name: template.id === "blank" ? "" : template.name,
        description: template.id === "blank" ? "" : template.description,
        inputSchema: template.inputSchema,
        outputSchema: template.outputSchema,
        goal: template.goal,
        outputType: template.id === "blank" ? "structured" : "structured",
      }));
      handleNext();
    },
    [handleNext]
  );

  // Handle successful creation
  const handleSuccess = useCallback(() => {
    clearWizardDraft();
    router.push("/dashboard/processes?created=true");
  }, [router]);

  // Show loading state until initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-3xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-4 w-96 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Show draft prompt if there's a saved draft
  if (showDraftPrompt && hasSavedDraft) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-3xl">
          <ResumeDraftPrompt
            onResume={handleResumeDraft}
            onDiscard={handleDiscardDraft}
          />
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
            Create Intelligence
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define what intelligence you need from your product data
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <StepIndicator
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
        </div>

        {/* Step Content */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          {currentStep === WizardStep.Template && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Choose a Template</h2>
                <p className="text-sm text-muted-foreground">
                  Start with a pre-built template or create from scratch
                </p>
              </div>
              <TemplatePicker
                selectedId={wizardData.templateId ?? null}
                onSelect={handleTemplateSelect}
              />
            </div>
          )}

          {currentStep === WizardStep.Name && (
            <NameStep
              data={wizardData}
              onDataChange={handleDataChange}
              onNext={handleNext}
              onBack={handleBack}
              currentStep={currentStep}
            />
          )}

          {currentStep === WizardStep.InputSchema && (
            <InputSchemaStep
              data={wizardData}
              onDataChange={handleDataChange}
              onNext={handleNext}
              onBack={handleBack}
              currentStep={currentStep}
            />
          )}

          {currentStep === WizardStep.Goal && (
            <GoalStep
              data={wizardData}
              onDataChange={handleDataChange}
              onNext={handleNext}
              onBack={handleBack}
              currentStep={currentStep}
            />
          )}

          {currentStep === WizardStep.OutputSchema && (
            <OutputSchemaStep
              data={wizardData}
              onDataChange={handleDataChange}
              onNext={handleNext}
              onBack={handleBack}
              currentStep={currentStep}
            />
          )}

          {currentStep === WizardStep.Review && (
            <ReviewStep
              data={wizardData}
              onDataChange={handleDataChange}
              onNext={handleSuccess}
              onBack={handleBack}
              currentStep={currentStep}
            />
          )}
        </div>
      </div>
    </div>
  );
}
