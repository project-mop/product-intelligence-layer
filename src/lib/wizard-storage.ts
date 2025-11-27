/**
 * LocalStorage utilities for wizard auto-save functionality.
 * Persists wizard progress so users can recover if the browser closes.
 */

import { type WizardData, type WizardStep, defaultWizardData } from "~/components/process/types";

const STORAGE_KEY = "process-wizard-draft";

/**
 * Saved draft structure including step position.
 */
interface SavedDraft {
  data: WizardData;
  step: WizardStep;
  savedAt: string;
}

/**
 * Save wizard state to localStorage.
 * Called on each data change (debounced in the caller).
 */
export function saveWizardDraft(data: WizardData, step: WizardStep): void {
  if (typeof window === "undefined") return;

  try {
    const draft: SavedDraft = {
      data,
      step,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Silently fail if localStorage is unavailable
    console.warn("Failed to save wizard draft to localStorage");
  }
}

/**
 * Load saved wizard draft from localStorage.
 * Returns null if no draft exists or if parsing fails.
 */
export function loadWizardDraft(): SavedDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const draft = JSON.parse(saved) as SavedDraft;

    // Validate structure
    if (!draft.data || typeof draft.step !== "number") {
      return null;
    }

    // Merge with defaults to handle any missing fields from older drafts
    const mergedData: WizardData = {
      ...defaultWizardData,
      ...draft.data,
    };

    return {
      data: mergedData,
      step: draft.step,
      savedAt: draft.savedAt,
    };
  } catch {
    // Silently fail if parsing fails
    console.warn("Failed to load wizard draft from localStorage");
    return null;
  }
}

/**
 * Clear saved wizard draft from localStorage.
 * Called after successful save or when user discards draft.
 */
export function clearWizardDraft(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently fail
    console.warn("Failed to clear wizard draft from localStorage");
  }
}

/**
 * Check if a saved draft exists.
 */
export function hasSavedDraft(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
