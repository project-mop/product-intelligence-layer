/**
 * ComponentTree Component Tests
 *
 * Tests the visual tree representation of component hierarchy.
 *
 * @see src/components/process/ComponentTree.tsx
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor } from "../../../support/render";
import {
  ComponentTree,
  getComponentCount,
  getMaxDepth,
  findComponentById,
} from "~/components/process/ComponentTree";
import type { ComponentDefinition } from "~/components/process/types";

describe("ComponentTree", () => {
  describe("helper functions", () => {
    describe("getComponentCount", () => {
      it("returns 0 for empty array", () => {
        expect(getComponentCount([])).toBe(0);
      });

      it("counts flat components", () => {
        const components: ComponentDefinition[] = [
          { id: "1", name: "A", type: "T" },
          { id: "2", name: "B", type: "T" },
          { id: "3", name: "C", type: "T" },
        ];
        expect(getComponentCount(components)).toBe(3);
      });

      it("counts nested components", () => {
        const components: ComponentDefinition[] = [
          {
            id: "1",
            name: "Parent",
            type: "P",
            subcomponents: [
              { id: "2", name: "Child1", type: "C" },
              {
                id: "3",
                name: "Child2",
                type: "C",
                subcomponents: [
                  { id: "4", name: "Grandchild", type: "G" },
                ],
              },
            ],
          },
        ];
        expect(getComponentCount(components)).toBe(4); // 1 parent + 2 children + 1 grandchild
      });
    });

    describe("getMaxDepth", () => {
      it("returns 1 for flat components", () => {
        const components: ComponentDefinition[] = [
          { id: "1", name: "A", type: "T" },
          { id: "2", name: "B", type: "T" },
        ];
        expect(getMaxDepth(components)).toBe(1);
      });

      it("returns correct depth for nested components", () => {
        const components: ComponentDefinition[] = [
          {
            id: "1",
            name: "L1",
            type: "T",
            subcomponents: [
              {
                id: "2",
                name: "L2",
                type: "T",
                subcomponents: [
                  { id: "3", name: "L3", type: "T" },
                ],
              },
            ],
          },
        ];
        expect(getMaxDepth(components)).toBe(3);
      });

      it("returns max depth when multiple branches have different depths", () => {
        const components: ComponentDefinition[] = [
          {
            id: "1",
            name: "ShallowParent",
            type: "T",
            subcomponents: [
              { id: "2", name: "Shallow", type: "T" },
            ],
          },
          {
            id: "3",
            name: "DeepParent",
            type: "T",
            subcomponents: [
              {
                id: "4",
                name: "DeepL2",
                type: "T",
                subcomponents: [
                  { id: "5", name: "DeepL3", type: "T" },
                ],
              },
            ],
          },
        ];
        expect(getMaxDepth(components)).toBe(3);
      });
    });

    describe("findComponentById", () => {
      const components: ComponentDefinition[] = [
        {
          id: "parent",
          name: "Parent",
          type: "P",
          subcomponents: [
            {
              id: "child",
              name: "Child",
              type: "C",
              subcomponents: [
                { id: "grandchild", name: "Grandchild", type: "G" },
              ],
            },
          ],
        },
        { id: "sibling", name: "Sibling", type: "S" },
      ];

      it("finds top-level component", () => {
        const found = findComponentById(components, "parent");
        expect(found?.name).toBe("Parent");
      });

      it("finds nested component", () => {
        const found = findComponentById(components, "child");
        expect(found?.name).toBe("Child");
      });

      it("finds deeply nested component", () => {
        const found = findComponentById(components, "grandchild");
        expect(found?.name).toBe("Grandchild");
      });

      it("returns null for non-existent ID", () => {
        const found = findComponentById(components, "nonexistent");
        expect(found).toBeNull();
      });

      it("returns null for empty array", () => {
        const found = findComponentById([], "any");
        expect(found).toBeNull();
      });
    });
  });

  describe("component rendering", () => {
    it("shows empty state when no components", () => {
      renderWithProviders(
        <ComponentTree components={[]} />
      );

      expect(screen.getByText("No components defined")).toBeInTheDocument();
    });

    it("renders component hierarchy header", () => {
      const components: ComponentDefinition[] = [
        { id: "1", name: "Product", type: "Entity" },
      ];

      renderWithProviders(
        <ComponentTree components={components} />
      );

      expect(screen.getByText("Component Hierarchy")).toBeInTheDocument();
    });

    it("renders component name and type", () => {
      const components: ComponentDefinition[] = [
        { id: "1", name: "ProductVariant", type: "Variant" },
      ];

      renderWithProviders(
        <ComponentTree components={components} />
      );

      expect(screen.getByText("ProductVariant")).toBeInTheDocument();
      expect(screen.getByText("(Variant)")).toBeInTheDocument();
    });

    it("shows attribute count", () => {
      const components: ComponentDefinition[] = [
        {
          id: "1",
          name: "Product",
          type: "Entity",
          attributes: [
            { id: "a1", name: "sku", type: "string", required: true },
            { id: "a2", name: "price", type: "number", required: true },
          ],
        },
      ];

      renderWithProviders(
        <ComponentTree components={components} />
      );

      expect(screen.getByText("2 attrs")).toBeInTheDocument();
    });

    it("shows singular 'attr' for one attribute", () => {
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

      renderWithProviders(
        <ComponentTree components={components} />
      );

      expect(screen.getByText("1 attr")).toBeInTheDocument();
    });

    it("renders nested subcomponents", () => {
      const components: ComponentDefinition[] = [
        {
          id: "1",
          name: "Parent",
          type: "ParentType",
          subcomponents: [
            { id: "2", name: "Child", type: "ChildType" },
          ],
        },
      ];

      renderWithProviders(
        <ComponentTree components={components} />
      );

      expect(screen.getByText("Parent")).toBeInTheDocument();
      expect(screen.getByText("Child")).toBeInTheDocument();
    });

    it("handles unnamed components gracefully", () => {
      const components: ComponentDefinition[] = [
        { id: "1", name: "", type: "" },
      ];

      renderWithProviders(
        <ComponentTree components={components} />
      );

      expect(screen.getByText("(unnamed)")).toBeInTheDocument();
      expect(screen.getByText("(no type)")).toBeInTheDocument();
    });
  });

  describe("expand/collapse functionality", () => {
    it("renders expand all and collapse all buttons", () => {
      const components: ComponentDefinition[] = [
        { id: "1", name: "Product", type: "Entity" },
      ];

      renderWithProviders(
        <ComponentTree components={components} />
      );

      expect(screen.getByRole("button", { name: /expand all/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /collapse all/i })).toBeInTheDocument();
    });

    it("components are expanded by default", () => {
      const components: ComponentDefinition[] = [
        {
          id: "1",
          name: "Parent",
          type: "P",
          attributes: [
            { id: "a1", name: "attr", type: "string", required: false },
          ],
        },
      ];

      renderWithProviders(
        <ComponentTree components={components} />
      );

      // Attribute should be visible because parent is expanded
      expect(screen.getByText("attr")).toBeInTheDocument();
    });

    it("collapse all hides nested content", async () => {
      const components: ComponentDefinition[] = [
        {
          id: "1",
          name: "Parent",
          type: "P",
          subcomponents: [
            { id: "2", name: "Child", type: "C" },
          ],
        },
      ];

      renderWithProviders(
        <ComponentTree components={components} />
      );

      // Initially visible
      expect(screen.getByText("Child")).toBeInTheDocument();

      // Click collapse all
      fireEvent.click(screen.getByRole("button", { name: /collapse all/i }));

      // Child should be hidden
      await waitFor(() => {
        expect(screen.queryByText("Child")).not.toBeInTheDocument();
      });
    });
  });

  describe("selection", () => {
    it("calls onSelect when component is clicked", async () => {
      const onSelect = vi.fn();
      const components: ComponentDefinition[] = [
        { id: "comp-1", name: "Product", type: "Entity" },
      ];

      renderWithProviders(
        <ComponentTree components={components} onSelect={onSelect} />
      );

      fireEvent.click(screen.getByText("Product"));

      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith("comp-1");
      });
    });

    it("highlights selected component", () => {
      const components: ComponentDefinition[] = [
        { id: "comp-1", name: "Product", type: "Entity" },
      ];

      const { container } = renderWithProviders(
        <ComponentTree components={components} selectedId="comp-1" />
      );

      // Selected component should have ring styling
      const selectedElement = container.querySelector(".ring-primary");
      expect(selectedElement).toBeInTheDocument();
    });
  });

  describe("attribute display", () => {
    it("shows attribute types", () => {
      const components: ComponentDefinition[] = [
        {
          id: "1",
          name: "Product",
          type: "Entity",
          attributes: [
            { id: "a1", name: "sku", type: "string", required: false },
            { id: "a2", name: "price", type: "number", required: true },
          ],
        },
      ];

      renderWithProviders(
        <ComponentTree components={components} />
      );

      expect(screen.getByText(": string")).toBeInTheDocument();
      expect(screen.getByText(": number")).toBeInTheDocument();
    });

    it("marks required attributes", () => {
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

      renderWithProviders(
        <ComponentTree components={components} />
      );

      // Required indicator
      expect(screen.getByText("*")).toBeInTheDocument();
    });
  });

  describe("3-level nesting", () => {
    it("renders components at all 3 levels", () => {
      const components: ComponentDefinition[] = [
        {
          id: "1",
          name: "Level1",
          type: "L1",
          subcomponents: [
            {
              id: "2",
              name: "Level2",
              type: "L2",
              subcomponents: [
                { id: "3", name: "Level3", type: "L3" },
              ],
            },
          ],
        },
      ];

      renderWithProviders(
        <ComponentTree components={components} />
      );

      expect(screen.getByText("Level1")).toBeInTheDocument();
      expect(screen.getByText("Level2")).toBeInTheDocument();
      expect(screen.getByText("Level3")).toBeInTheDocument();
    });
  });
});
