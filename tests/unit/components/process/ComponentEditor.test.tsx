/**
 * ComponentEditor Component Tests
 *
 * Tests the component editor for defining hierarchical component structures.
 *
 * @see src/components/process/ComponentEditor.tsx
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor } from "../../../support/render";
import {
  ComponentEditor,
  createEmptyComponent,
  createEmptyAttribute,
  validateComponentNames,
  validateAttributeNames,
  validateComponents,
  componentsToServerFormat,
} from "~/components/process/ComponentEditor";
import type { ComponentDefinition, AttributeDefinition } from "~/components/process/types";

describe("ComponentEditor", () => {
  describe("helper functions", () => {
    describe("createEmptyComponent", () => {
      it("creates a component with empty fields and unique ID", () => {
        const comp = createEmptyComponent();
        expect(comp.id).toBeTruthy();
        expect(comp.name).toBe("");
        expect(comp.type).toBe("");
        expect(comp.attributes).toEqual([]);
        expect(comp.subcomponents).toEqual([]);
        expect(comp.expanded).toBe(true);
      });

      it("generates unique IDs", () => {
        const comp1 = createEmptyComponent();
        const comp2 = createEmptyComponent();
        expect(comp1.id).not.toBe(comp2.id);
      });
    });

    describe("createEmptyAttribute", () => {
      it("creates an attribute with default values", () => {
        const attr = createEmptyAttribute();
        expect(attr.id).toBeTruthy();
        expect(attr.name).toBe("");
        expect(attr.type).toBe("string");
        expect(attr.description).toBe("");
        expect(attr.required).toBe(false);
      });
    });

    describe("validateComponentNames", () => {
      it("returns true for empty array", () => {
        expect(validateComponentNames([])).toBe(true);
      });

      it("returns true for components with unique names", () => {
        const components: ComponentDefinition[] = [
          { id: "1", name: "ComponentA", type: "TypeA" },
          { id: "2", name: "ComponentB", type: "TypeB" },
        ];
        expect(validateComponentNames(components)).toBe(true);
      });

      it("returns false for duplicate names (case insensitive)", () => {
        const components: ComponentDefinition[] = [
          { id: "1", name: "component", type: "TypeA" },
          { id: "2", name: "Component", type: "TypeB" },
        ];
        expect(validateComponentNames(components)).toBe(false);
      });

      it("validates subcomponent names within their level", () => {
        const components: ComponentDefinition[] = [
          {
            id: "1",
            name: "Parent",
            type: "Parent",
            subcomponents: [
              { id: "2", name: "ChildA", type: "Child" },
              { id: "3", name: "ChildA", type: "Child" }, // Duplicate!
            ],
          },
        ];
        expect(validateComponentNames(components)).toBe(false);
      });

      it("allows same names at different levels", () => {
        const components: ComponentDefinition[] = [
          {
            id: "1",
            name: "Parent",
            type: "Parent",
            subcomponents: [
              { id: "2", name: "Parent", type: "Child" }, // Same name as parent but different level
            ],
          },
        ];
        expect(validateComponentNames(components)).toBe(true);
      });
    });

    describe("validateAttributeNames", () => {
      it("returns true for empty array", () => {
        expect(validateAttributeNames([])).toBe(true);
      });

      it("returns true for unique attribute names", () => {
        const attrs: AttributeDefinition[] = [
          { id: "1", name: "attr1", type: "string", required: false },
          { id: "2", name: "attr2", type: "number", required: true },
        ];
        expect(validateAttributeNames(attrs)).toBe(true);
      });

      it("returns false for duplicate attribute names", () => {
        const attrs: AttributeDefinition[] = [
          { id: "1", name: "attr", type: "string", required: false },
          { id: "2", name: "Attr", type: "number", required: true },
        ];
        expect(validateAttributeNames(attrs)).toBe(false);
      });
    });

    describe("validateComponents", () => {
      it("returns true for valid components", () => {
        const components: ComponentDefinition[] = [
          {
            id: "1",
            name: "Product",
            type: "Entity",
            attributes: [
              { id: "a1", name: "sku", type: "string", required: true },
            ],
          },
        ];
        expect(validateComponents(components)).toBe(true);
      });

      it("returns false if component name is empty", () => {
        const components: ComponentDefinition[] = [
          { id: "1", name: "", type: "Entity" },
        ];
        expect(validateComponents(components)).toBe(false);
      });

      it("returns false if component type is empty", () => {
        const components: ComponentDefinition[] = [
          { id: "1", name: "Product", type: "" },
        ];
        expect(validateComponents(components)).toBe(false);
      });

      it("returns false if attribute name is empty", () => {
        const components: ComponentDefinition[] = [
          {
            id: "1",
            name: "Product",
            type: "Entity",
            attributes: [
              { id: "a1", name: "", type: "string", required: false },
            ],
          },
        ];
        expect(validateComponents(components)).toBe(false);
      });

      it("validates nested subcomponents", () => {
        const components: ComponentDefinition[] = [
          {
            id: "1",
            name: "Parent",
            type: "Parent",
            subcomponents: [
              {
                id: "2",
                name: "", // Invalid!
                type: "Child",
              },
            ],
          },
        ];
        expect(validateComponents(components)).toBe(false);
      });
    });

    describe("componentsToServerFormat", () => {
      it("strips client-only fields (id, expanded)", () => {
        const components: ComponentDefinition[] = [
          {
            id: "client-id-123",
            name: "Product",
            type: "Entity",
            expanded: true,
            attributes: [
              {
                id: "attr-id-456",
                name: "sku",
                type: "string",
                description: "Stock keeping unit",
                required: true,
              },
            ],
          },
        ];

        const serverFormat = componentsToServerFormat(components);

        expect(serverFormat).toEqual([
          {
            name: "Product",
            type: "Entity",
            attributes: [
              {
                name: "sku",
                type: "string",
                description: "Stock keeping unit",
                required: true,
              },
            ],
            subcomponents: undefined,
          },
        ]);
        // Ensure no id or expanded fields
        expect(serverFormat[0]).not.toHaveProperty("id");
        expect(serverFormat[0]).not.toHaveProperty("expanded");
      });

      it("recursively processes subcomponents", () => {
        const components: ComponentDefinition[] = [
          {
            id: "1",
            name: "Parent",
            type: "ParentType",
            subcomponents: [
              {
                id: "2",
                name: "Child",
                type: "ChildType",
                expanded: false,
              },
            ],
          },
        ];

        const serverFormat = componentsToServerFormat(components);

        expect(serverFormat[0]?.subcomponents).toEqual([
          {
            name: "Child",
            type: "ChildType",
            attributes: undefined,
            subcomponents: undefined,
          },
        ]);
      });

      it("strips empty description", () => {
        const components: ComponentDefinition[] = [
          {
            id: "1",
            name: "Product",
            type: "Entity",
            attributes: [
              {
                id: "a1",
                name: "sku",
                type: "string",
                description: "",
                required: true,
              },
            ],
          },
        ];

        const serverFormat = componentsToServerFormat(components);
        expect(serverFormat[0]?.attributes?.[0]?.description).toBeUndefined();
      });
    });
  });

  describe("component rendering", () => {
    it("shows empty state when no components", () => {
      const onChange = vi.fn();
      renderWithProviders(
        <ComponentEditor components={[]} onChange={onChange} />
      );

      expect(
        screen.getByText("No components defined. Add a component to define structured product data.")
      ).toBeInTheDocument();
    });

    it("renders Add Component button", () => {
      const onChange = vi.fn();
      renderWithProviders(
        <ComponentEditor components={[]} onChange={onChange} />
      );

      expect(screen.getByRole("button", { name: /add component/i })).toBeInTheDocument();
    });

    it("adds a new component when Add Component is clicked", async () => {
      const onChange = vi.fn();
      renderWithProviders(
        <ComponentEditor components={[]} onChange={onChange} />
      );

      fireEvent.click(screen.getByRole("button", { name: /add component/i }));

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              name: "",
              type: "",
            }),
          ])
        );
      });
    });

    it("renders existing components", () => {
      const components: ComponentDefinition[] = [
        { id: "1", name: "ProductVariant", type: "Variant", expanded: true },
      ];
      const onChange = vi.fn();

      renderWithProviders(
        <ComponentEditor components={components} onChange={onChange} />
      );

      expect(screen.getByDisplayValue("ProductVariant")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Variant")).toBeInTheDocument();
    });

    it("allows editing component name", async () => {
      const components: ComponentDefinition[] = [
        { id: "1", name: "OldName", type: "Type", expanded: true },
      ];
      const onChange = vi.fn();

      renderWithProviders(
        <ComponentEditor components={components} onChange={onChange} />
      );

      const input = screen.getByDisplayValue("OldName");
      fireEvent.change(input, { target: { value: "NewName" } });

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              name: "NewName",
            }),
          ])
        );
      });
    });

    it("removes component when delete is clicked", async () => {
      const components: ComponentDefinition[] = [
        { id: "1", name: "ToDelete", type: "Type", expanded: true },
      ];
      const onChange = vi.fn();

      renderWithProviders(
        <ComponentEditor components={components} onChange={onChange} />
      );

      // Find the delete button (trash icon)
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(btn =>
        btn.querySelector('svg.lucide-trash-2') !== null
      );

      if (deleteButton) {
        fireEvent.click(deleteButton);
      }

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith([]);
      });
    });

    it("shows max depth message at level 3", () => {
      // Create a 3-level deep component structure
      const components: ComponentDefinition[] = [
        {
          id: "1",
          name: "Level1",
          type: "L1",
          expanded: true,
          subcomponents: [
            {
              id: "2",
              name: "Level2",
              type: "L2",
              expanded: true,
              subcomponents: [
                {
                  id: "3",
                  name: "Level3",
                  type: "L3",
                  expanded: true,
                },
              ],
            },
          ],
        },
      ];
      const onChange = vi.fn();

      renderWithProviders(
        <ComponentEditor components={components} onChange={onChange} />
      );

      expect(screen.getByText("Maximum nesting depth reached")).toBeInTheDocument();
    });
  });

  describe("attributes", () => {
    it("shows Add Attribute button when component is expanded", () => {
      const components: ComponentDefinition[] = [
        { id: "1", name: "Product", type: "Entity", expanded: true },
      ];
      const onChange = vi.fn();

      renderWithProviders(
        <ComponentEditor components={components} onChange={onChange} />
      );

      expect(screen.getByRole("button", { name: /add attribute/i })).toBeInTheDocument();
    });

    it("adds attribute when Add Attribute is clicked", async () => {
      const components: ComponentDefinition[] = [
        { id: "1", name: "Product", type: "Entity", expanded: true, attributes: [] },
      ];
      const onChange = vi.fn();

      renderWithProviders(
        <ComponentEditor components={components} onChange={onChange} />
      );

      fireEvent.click(screen.getByRole("button", { name: /add attribute/i }));

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              attributes: expect.arrayContaining([
                expect.objectContaining({
                  name: "",
                  type: "string",
                  required: false,
                }),
              ]),
            }),
          ])
        );
      });
    });

    it("renders existing attributes", () => {
      const components: ComponentDefinition[] = [
        {
          id: "1",
          name: "Product",
          type: "Entity",
          expanded: true,
          attributes: [
            { id: "a1", name: "sku", type: "string", required: true },
          ],
        },
      ];
      const onChange = vi.fn();

      renderWithProviders(
        <ComponentEditor components={components} onChange={onChange} />
      );

      expect(screen.getByDisplayValue("sku")).toBeInTheDocument();
    });
  });

  describe("validation errors", () => {
    it("shows error styling when showErrors is true and name is empty", () => {
      const components: ComponentDefinition[] = [
        { id: "1", name: "", type: "Type", expanded: true },
      ];
      const onChange = vi.fn();

      renderWithProviders(
        <ComponentEditor components={components} onChange={onChange} showErrors />
      );

      // Check for destructive border class on input
      const nameInput = screen.getByPlaceholderText("Component name");
      expect(nameInput).toHaveClass("border-destructive");
    });

    it("shows duplicate names error message", () => {
      const components: ComponentDefinition[] = [
        { id: "1", name: "Duplicate", type: "Type1", expanded: true },
        { id: "2", name: "duplicate", type: "Type2", expanded: true },
      ];
      const onChange = vi.fn();

      renderWithProviders(
        <ComponentEditor components={components} onChange={onChange} showErrors />
      );

      expect(screen.getByText("Component names must be unique within each level.")).toBeInTheDocument();
    });
  });
});
