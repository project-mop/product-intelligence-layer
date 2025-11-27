"use client";

import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { JSONSchema7 } from "json-schema";

/**
 * Template definition for intelligence definition wizard.
 * Each template pre-populates wizard fields with sensible defaults.
 */
export interface ProcessTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  inputSchema: JSONSchema7;
  outputSchema: JSONSchema7;
  goal: string;
}

/**
 * Pre-built templates for common intelligence definitions.
 * These help users get started quickly with familiar use cases.
 */
export const templates: ProcessTemplate[] = [
  {
    id: "product-description",
    name: "Product Description Generator",
    description: "Generate compelling product descriptions from attributes",
    icon: "📝",
    inputSchema: {
      type: "object",
      required: ["productName", "category"],
      properties: {
        productName: {
          type: "string",
          description: "Name of the product",
        },
        category: {
          type: "string",
          description: "Product category",
        },
        attributes: {
          type: "object",
          description: "Key-value product attributes",
          additionalProperties: { type: "string" },
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["shortDescription", "longDescription"],
      properties: {
        shortDescription: {
          type: "string",
          description: "Brief product description (max 160 characters)",
          maxLength: 160,
        },
        longDescription: {
          type: "string",
          description: "Detailed product description",
        },
        bulletPoints: {
          type: "array",
          description: "Key selling points as bullet points",
          items: { type: "string" },
        },
      },
    },
    goal: "Generate a compelling product description that highlights key features and benefits, optimized for ecommerce listings",
  },
  {
    id: "seo-meta",
    name: "SEO Meta Generator",
    description: "Create optimized meta titles and descriptions for products",
    icon: "🔍",
    inputSchema: {
      type: "object",
      required: ["productName", "productDescription"],
      properties: {
        productName: {
          type: "string",
          description: "Name of the product",
        },
        productDescription: {
          type: "string",
          description: "Current product description",
        },
        targetKeywords: {
          type: "array",
          description: "Target SEO keywords",
          items: { type: "string" },
        },
        brandName: {
          type: "string",
          description: "Brand name to include",
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["metaTitle", "metaDescription"],
      properties: {
        metaTitle: {
          type: "string",
          description: "SEO-optimized page title (50-60 characters)",
          maxLength: 60,
        },
        metaDescription: {
          type: "string",
          description: "SEO-optimized meta description (150-160 characters)",
          maxLength: 160,
        },
        focusKeyword: {
          type: "string",
          description: "Primary keyword used",
        },
      },
    },
    goal: "Generate SEO-optimized meta titles and descriptions that improve search visibility while accurately representing the product",
  },
  {
    id: "category-classifier",
    name: "Category Classifier",
    description: "Automatically classify products into categories",
    icon: "🏷️",
    inputSchema: {
      type: "object",
      required: ["productName", "productDescription"],
      properties: {
        productName: {
          type: "string",
          description: "Name of the product",
        },
        productDescription: {
          type: "string",
          description: "Product description or details",
        },
        availableCategories: {
          type: "array",
          description: "List of valid category options",
          items: { type: "string" },
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["primaryCategory"],
      properties: {
        primaryCategory: {
          type: "string",
          description: "Best matching category",
        },
        secondaryCategories: {
          type: "array",
          description: "Additional relevant categories",
          items: { type: "string" },
        },
        confidence: {
          type: "number",
          description: "Classification confidence (0-1)",
          minimum: 0,
          maximum: 1,
        },
        reasoning: {
          type: "string",
          description: "Explanation for the classification",
        },
      },
    },
    goal: "Classify products into the most appropriate categories based on their name, description, and attributes",
  },
  {
    id: "attribute-extractor",
    name: "Attribute Extractor",
    description: "Extract structured attributes from product text",
    icon: "🔬",
    inputSchema: {
      type: "object",
      required: ["productText"],
      properties: {
        productText: {
          type: "string",
          description: "Raw product text (title, description, specs)",
        },
        targetAttributes: {
          type: "array",
          description: "List of attributes to extract",
          items: { type: "string" },
        },
      },
    },
    outputSchema: {
      type: "object",
      required: ["attributes"],
      properties: {
        attributes: {
          type: "object",
          description: "Extracted key-value attributes",
          additionalProperties: { type: "string" },
        },
        extractedCount: {
          type: "integer",
          description: "Number of attributes extracted",
        },
        missingAttributes: {
          type: "array",
          description: "Requested attributes not found in text",
          items: { type: "string" },
        },
      },
    },
    goal: "Extract structured product attributes from unstructured text, returning clean key-value pairs",
  },
];

/**
 * Blank template for starting from scratch.
 */
export const blankTemplate: ProcessTemplate = {
  id: "blank",
  name: "Blank",
  description: "Start from scratch with empty fields",
  icon: "✨",
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
};

interface TemplatePickerProps {
  selectedId: string | null;
  onSelect: (template: ProcessTemplate) => void;
}

/**
 * Template picker component for the intelligence definition wizard.
 * Displays pre-built templates as a card grid with hover states.
 */
export function TemplatePicker({ selectedId, onSelect }: TemplatePickerProps) {
  const allTemplates = [blankTemplate, ...templates];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {allTemplates.map((template) => (
        <Card
          key={template.id}
          className={cn(
            "cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
            selectedId === template.id && "ring-2 ring-primary border-primary"
          )}
          onClick={() => onSelect(template)}
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <span className="text-3xl" role="img" aria-label={template.name}>
                {template.icon}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">
                  {template.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
