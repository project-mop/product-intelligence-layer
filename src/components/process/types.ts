import type { JSONSchema7 } from "json-schema";

/**
 * Output type selection for the intelligence definition.
 */
export type OutputType = "text" | "structured";

/**
 * Attribute type for component attributes.
 * Matches AttributeDefinition type from server types.
 */
export type AttributeType = "string" | "number" | "boolean" | "array" | "object";

/**
 * Attribute definition within a component.
 * Mirrors server-side AttributeDefinition.
 */
export interface AttributeDefinition {
  /** Unique ID for React keys */
  id: string;
  /** Attribute name */
  name: string;
  /** Data type of the attribute */
  type: AttributeType;
  /** Human-readable description */
  description?: string;
  /** Whether this attribute is required */
  required: boolean;
}

/**
 * Component definition for structured intelligence.
 * Mirrors server-side ComponentDefinition with added client-side fields.
 */
export interface ComponentDefinition {
  /** Unique ID for React keys */
  id: string;
  /** Component name/identifier */
  name: string;
  /** Component type classification */
  type: string;
  /** Attributes within this component */
  attributes?: AttributeDefinition[];
  /** Nested subcomponents (max 3 levels deep) */
  subcomponents?: ComponentDefinition[];
  /** Whether this component is expanded in the tree view */
  expanded?: boolean;
}

/**
 * Wizard data structure containing all form data across steps.
 * This is the shape of data that flows through the wizard.
 */
export interface WizardData {
  /** ID of the selected template (if any) */
  templateId?: string;
  /** Name of the intelligence definition */
  name: string;
  /** Optional description */
  description?: string;
  /** Input schema in JSON Schema Draft 7 format */
  inputSchema: JSONSchema7;
  /** Output schema in JSON Schema Draft 7 format */
  outputSchema: JSONSchema7;
  /** Goal statement describing what this intelligence should do */
  goal: string;
  /** Whether output is simple text or structured JSON */
  outputType: OutputType;
  /** Whether advanced mode is enabled (shows component editor) */
  advancedMode?: boolean;
  /** Component hierarchy for structured intelligence (advanced mode) */
  components?: ComponentDefinition[];
}

/**
 * Default/initial wizard data state.
 */
export const defaultWizardData: WizardData = {
  templateId: undefined,
  name: "",
  description: "",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
  outputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
  goal: "",
  outputType: "structured",
  advancedMode: false,
  components: [],
};

/**
 * Wizard step enum for type safety.
 */
export enum WizardStep {
  Template = 0,
  Name = 1,
  InputSchema = 2,
  Goal = 3,
  OutputSchema = 4,
  Review = 5,
}

/**
 * Step metadata for display.
 */
export const wizardSteps = [
  { step: WizardStep.Template, label: "Template", shortLabel: "1" },
  { step: WizardStep.Name, label: "Name", shortLabel: "2" },
  { step: WizardStep.InputSchema, label: "Input", shortLabel: "3" },
  { step: WizardStep.Goal, label: "Goal", shortLabel: "4" },
  { step: WizardStep.OutputSchema, label: "Output", shortLabel: "5" },
  { step: WizardStep.Review, label: "Review", shortLabel: "6" },
];

/**
 * Props for individual wizard step components.
 */
export interface StepProps {
  /** Current wizard data */
  data: WizardData;
  /** Callback to update wizard data */
  onDataChange: (data: Partial<WizardData>) => void;
  /** Go to next step */
  onNext: () => void;
  /** Go to previous step */
  onBack: () => void;
  /** Current step index */
  currentStep: WizardStep;
}
