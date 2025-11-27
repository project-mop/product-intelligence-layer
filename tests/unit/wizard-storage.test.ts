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
  saveEditDraft,
  loadEditDraft,
  clearEditDraft,
  hasEditDraft,
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

  // ==========================================================================
  // EDIT MODE TESTS (Story 2.4)
  // ==========================================================================

  describe("saveEditDraft", () => {
    it("saves edit draft with process ID", () => {
      const processId = "proc_test123";
      const data = {
        ...defaultWizardData,
        name: "Test Intelligence",
        goal: "Test goal",
      };

      saveEditDraft(processId, data, 2);

      const saved = localStorageMock.getItem(`process-edit-draft-${processId}`);
      expect(saved).not.toBeNull();

      const parsed = JSON.parse(saved!);
      expect(parsed.data.name).toBe("Test Intelligence");
      expect(parsed.data.goal).toBe("Test goal");
      expect(parsed.editStep).toBe(2);
      expect(parsed.processId).toBe(processId);
    });

    it("stores drafts separately for different processes", () => {
      const processId1 = "proc_111";
      const processId2 = "proc_222";

      saveEditDraft(processId1, { ...defaultWizardData, name: "Process 1" }, 0);
      saveEditDraft(processId2, { ...defaultWizardData, name: "Process 2" }, 1);

      const saved1 = localStorageMock.getItem(`process-edit-draft-${processId1}`);
      const saved2 = localStorageMock.getItem(`process-edit-draft-${processId2}`);

      expect(JSON.parse(saved1!).data.name).toBe("Process 1");
      expect(JSON.parse(saved2!).data.name).toBe("Process 2");
    });

    it("includes savedAt timestamp", () => {
      const processId = "proc_test";
      saveEditDraft(processId, defaultWizardData, 0);

      const saved = localStorageMock.getItem(`process-edit-draft-${processId}`);
      const parsed = JSON.parse(saved!);

      expect(parsed.savedAt).toBeDefined();
      expect(new Date(parsed.savedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("loadEditDraft", () => {
    it("returns null when no edit draft exists", () => {
      const result = loadEditDraft("proc_nonexistent");
      expect(result).toBeNull();
    });

    it("loads saved edit draft for specific process", () => {
      const processId = "proc_test";
      const data = {
        ...defaultWizardData,
        name: "Saved Edit Draft",
      };

      saveEditDraft(processId, data, 3);
      const loaded = loadEditDraft(processId);

      expect(loaded).not.toBeNull();
      expect(loaded!.data.name).toBe("Saved Edit Draft");
      expect(loaded!.editStep).toBe(3);
      expect(loaded!.processId).toBe(processId);
    });

    it("does not load draft for different process", () => {
      saveEditDraft("proc_111", defaultWizardData, 0);

      const loaded = loadEditDraft("proc_222");
      expect(loaded).toBeNull();
    });

    it("merges with defaults for missing fields", () => {
      const processId = "proc_test";
      // Save a partial draft (simulating older version)
      localStorageMock.setItem(
        `process-edit-draft-${processId}`,
        JSON.stringify({
          data: { name: "Partial" },
          editStep: 1,
          savedAt: new Date().toISOString(),
          processId,
        })
      );

      const loaded = loadEditDraft(processId);

      expect(loaded).not.toBeNull();
      expect(loaded!.data.name).toBe("Partial");
      // Should have default values for missing fields
      expect(loaded!.data.inputSchema).toBeDefined();
      expect(loaded!.data.outputSchema).toBeDefined();
    });

    it("returns null for invalid JSON", () => {
      const processId = "proc_test";
      localStorageMock.setItem(`process-edit-draft-${processId}`, "invalid json");

      const loaded = loadEditDraft(processId);
      expect(loaded).toBeNull();
    });

    it("returns null for mismatched process ID", () => {
      const processId = "proc_test";
      // Save draft with different processId in data
      localStorageMock.setItem(
        `process-edit-draft-${processId}`,
        JSON.stringify({
          data: defaultWizardData,
          editStep: 1,
          savedAt: new Date().toISOString(),
          processId: "proc_different",
        })
      );

      const loaded = loadEditDraft(processId);
      expect(loaded).toBeNull();
    });
  });

  describe("clearEditDraft", () => {
    it("removes edit draft for specific process", () => {
      const processId = "proc_test";
      saveEditDraft(processId, defaultWizardData, 0);
      expect(localStorageMock.getItem(`process-edit-draft-${processId}`)).not.toBeNull();

      clearEditDraft(processId);
      expect(localStorageMock.getItem(`process-edit-draft-${processId}`)).toBeNull();
    });

    it("does not affect drafts for other processes", () => {
      saveEditDraft("proc_111", defaultWizardData, 0);
      saveEditDraft("proc_222", defaultWizardData, 0);

      clearEditDraft("proc_111");

      expect(localStorageMock.getItem("process-edit-draft-proc_111")).toBeNull();
      expect(localStorageMock.getItem("process-edit-draft-proc_222")).not.toBeNull();
    });

    it("does nothing if no draft exists", () => {
      // Should not throw
      expect(() => clearEditDraft("proc_nonexistent")).not.toThrow();
    });
  });

  describe("hasEditDraft", () => {
    it("returns false when no edit draft exists", () => {
      expect(hasEditDraft("proc_nonexistent")).toBe(false);
    });

    it("returns true when edit draft exists", () => {
      const processId = "proc_test";
      saveEditDraft(processId, defaultWizardData, 0);
      expect(hasEditDraft(processId)).toBe(true);
    });

    it("returns false after clearing edit draft", () => {
      const processId = "proc_test";
      saveEditDraft(processId, defaultWizardData, 0);
      clearEditDraft(processId);
      expect(hasEditDraft(processId)).toBe(false);
    });

    it("returns correct value for different processes", () => {
      saveEditDraft("proc_111", defaultWizardData, 0);

      expect(hasEditDraft("proc_111")).toBe(true);
      expect(hasEditDraft("proc_222")).toBe(false);
    });
  });
});
