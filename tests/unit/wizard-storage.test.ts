/**
 * Wizard Storage Utility Tests
 *
 * Tests the localStorage persistence for wizard auto-save.
 *
 * @see src/lib/wizard-storage.ts
 */

import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  saveWizardDraft,
  loadWizardDraft,
  clearWizardDraft,
  hasSavedDraft,
} from "~/lib/wizard-storage";
import { WizardStep, defaultWizardData } from "~/components/process/types";

describe("wizard-storage", () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  beforeEach(() => {
    localStorageMock.clear();
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("saveWizardDraft", () => {
    it("saves wizard data to localStorage", () => {
      const data = {
        ...defaultWizardData,
        name: "Test Intelligence",
        goal: "Test goal",
      };

      saveWizardDraft(data, WizardStep.Name);

      const saved = localStorageMock.getItem("process-wizard-draft");
      expect(saved).not.toBeNull();

      const parsed = JSON.parse(saved!);
      expect(parsed.data.name).toBe("Test Intelligence");
      expect(parsed.data.goal).toBe("Test goal");
      expect(parsed.step).toBe(WizardStep.Name);
    });

    it("includes savedAt timestamp", () => {
      saveWizardDraft(defaultWizardData, WizardStep.Template);

      const saved = localStorageMock.getItem("process-wizard-draft");
      const parsed = JSON.parse(saved!);

      expect(parsed.savedAt).toBeDefined();
      expect(new Date(parsed.savedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("loadWizardDraft", () => {
    it("returns null when no draft exists", () => {
      const result = loadWizardDraft();
      expect(result).toBeNull();
    });

    it("loads saved draft from localStorage", () => {
      const data = {
        ...defaultWizardData,
        name: "Saved Draft",
      };

      saveWizardDraft(data, WizardStep.Goal);
      const loaded = loadWizardDraft();

      expect(loaded).not.toBeNull();
      expect(loaded!.data.name).toBe("Saved Draft");
      expect(loaded!.step).toBe(WizardStep.Goal);
    });

    it("merges with defaults for missing fields", () => {
      // Save a partial draft (simulating older version)
      localStorageMock.setItem(
        "process-wizard-draft",
        JSON.stringify({
          data: { name: "Partial" },
          step: 1,
          savedAt: new Date().toISOString(),
        })
      );

      const loaded = loadWizardDraft();

      expect(loaded).not.toBeNull();
      expect(loaded!.data.name).toBe("Partial");
      // Should have default values for missing fields
      expect(loaded!.data.inputSchema).toBeDefined();
      expect(loaded!.data.outputSchema).toBeDefined();
    });

    it("returns null for invalid JSON", () => {
      localStorageMock.setItem("process-wizard-draft", "invalid json");

      const loaded = loadWizardDraft();
      expect(loaded).toBeNull();
    });

    it("returns null for invalid structure", () => {
      localStorageMock.setItem(
        "process-wizard-draft",
        JSON.stringify({ invalid: true })
      );

      const loaded = loadWizardDraft();
      expect(loaded).toBeNull();
    });
  });

  describe("clearWizardDraft", () => {
    it("removes draft from localStorage", () => {
      saveWizardDraft(defaultWizardData, WizardStep.Template);
      expect(localStorageMock.getItem("process-wizard-draft")).not.toBeNull();

      clearWizardDraft();
      expect(localStorageMock.getItem("process-wizard-draft")).toBeNull();
    });

    it("does nothing if no draft exists", () => {
      // Should not throw
      expect(() => clearWizardDraft()).not.toThrow();
    });
  });

  describe("hasSavedDraft", () => {
    it("returns false when no draft exists", () => {
      expect(hasSavedDraft()).toBe(false);
    });

    it("returns true when draft exists", () => {
      saveWizardDraft(defaultWizardData, WizardStep.Template);
      expect(hasSavedDraft()).toBe(true);
    });

    it("returns false after clearing draft", () => {
      saveWizardDraft(defaultWizardData, WizardStep.Template);
      clearWizardDraft();
      expect(hasSavedDraft()).toBe(false);
    });
  });
});
