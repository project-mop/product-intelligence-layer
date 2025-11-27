/**
 * SchemaBuilder Component Tests
 *
 * Tests the visual JSON Schema editor component.
 *
 * @see src/components/process/SchemaBuilder.tsx
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor } from "../../../support/render";
import {
  SchemaBuilder,
  fieldsToJsonSchema,
  jsonSchemaToFields,
  validateSchema,
  type SchemaField,
} from "~/components/process/SchemaBuilder";

describe("SchemaBuilder", () => {
  describe("fieldsToJsonSchema", () => {
    it("converts empty fields to empty object schema", () => {
      const schema = fieldsToJsonSchema([]);
      expect(schema).toEqual({
        type: "object",
        properties: {},
        required: undefined,
      });
    });

    it("converts fields to JSON Schema properties", () => {
      const fields: SchemaField[] = [
        {
          id: "1",
          name: "productName",
          type: "string",
          description: "Name of the product",
          required: true,
        },
        {
          id: "2",
          name: "price",
          type: "number",
          description: "",
          required: false,
        },
      ];

      const schema = fieldsToJsonSchema(fields);

      expect(schema.type).toBe("object");
      expect(schema.properties).toEqual({
        productName: {
          type: "string",
          description: "Name of the product",
        },
        price: {
          type: "number",
        },
      });
      expect(schema.required).toEqual(["productName"]);
    });

    it("handles array type fields", () => {
      const fields: SchemaField[] = [
        {
          id: "1",
          name: "tags",
          type: "array",
          description: "Product tags",
          required: true,
        },
      ];

      const schema = fieldsToJsonSchema(fields);

      expect(schema.properties?.tags).toEqual({
        type: "array",
        description: "Product tags",
        items: { type: "string" },
      });
    });

    it("skips fields with empty names", () => {
      const fields: SchemaField[] = [
        { id: "1", name: "valid", type: "string", description: "", required: false },
        { id: "2", name: "", type: "string", description: "", required: false },
        { id: "3", name: "  ", type: "string", description: "", required: false },
      ];

      const schema = fieldsToJsonSchema(fields);

      expect(Object.keys(schema.properties ?? {})).toEqual(["valid"]);
    });
  });

  describe("jsonSchemaToFields", () => {
    it("converts empty schema to empty fields", () => {
      const fields = jsonSchemaToFields({
        type: "object",
        properties: {},
      });
      expect(fields).toEqual([]);
    });

    it("converts JSON Schema properties to fields", () => {
      const fields = jsonSchemaToFields({
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "Product name" },
          price: { type: "number" },
        },
      });

      expect(fields).toHaveLength(2);
      expect(fields[0]).toMatchObject({
        name: "name",
        type: "string",
        description: "Product name",
        required: true,
      });
      expect(fields[1]).toMatchObject({
        name: "price",
        type: "number",
        required: false,
      });
    });

    it("handles schema without required array", () => {
      const fields = jsonSchemaToFields({
        type: "object",
        properties: {
          field1: { type: "string" },
        },
      });

      expect(fields[0]?.required).toBe(false);
    });
  });

  describe("validateSchema", () => {
    it("returns false for empty fields", () => {
      expect(validateSchema([])).toBe(false);
    });

    it("returns false if any field has empty name", () => {
      const fields: SchemaField[] = [
        { id: "1", name: "valid", type: "string", description: "", required: false },
        { id: "2", name: "", type: "string", description: "", required: false },
      ];
      expect(validateSchema(fields)).toBe(false);
    });

    it("returns false if field names are duplicates (case insensitive)", () => {
      const fields: SchemaField[] = [
        { id: "1", name: "Field", type: "string", description: "", required: false },
        { id: "2", name: "field", type: "string", description: "", required: false },
      ];
      expect(validateSchema(fields)).toBe(false);
    });

    it("returns true for valid fields with unique names", () => {
      const fields: SchemaField[] = [
        { id: "1", name: "field1", type: "string", description: "", required: false },
        { id: "2", name: "field2", type: "number", description: "", required: true },
      ];
      expect(validateSchema(fields)).toBe(true);
    });
  });

  describe("component rendering", () => {
    it("shows empty state when no fields", () => {
      const onChange = vi.fn();
      renderWithProviders(
        <SchemaBuilder onChange={onChange} />
      );

      expect(
        screen.getByText("No fields defined yet. Add your first field to get started.")
      ).toBeInTheDocument();
    });

    it("renders Add Field button", () => {
      const onChange = vi.fn();
      renderWithProviders(
        <SchemaBuilder onChange={onChange} />
      );

      expect(screen.getByRole("button", { name: /add field/i })).toBeInTheDocument();
    });

    it("adds a new field when Add Field is clicked", async () => {
      const onChange = vi.fn();
      renderWithProviders(
        <SchemaBuilder onChange={onChange} />
      );

      fireEvent.click(screen.getByRole("button", { name: /add field/i }));

      // After adding, empty state should disappear
      expect(
        screen.queryByText("No fields defined yet. Add your first field to get started.")
      ).not.toBeInTheDocument();

      // Should have a field name input now
      expect(screen.getByPlaceholderText("Field name")).toBeInTheDocument();
    });

    it("calls onChange when field is added", async () => {
      const onChange = vi.fn();
      renderWithProviders(
        <SchemaBuilder onChange={onChange} />
      );

      fireEvent.click(screen.getByRole("button", { name: /add field/i }));

      // onChange should be called with the new schema
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
    });

    it("loads initial schema", () => {
      const onChange = vi.fn();
      const initialSchema = {
        type: "object" as const,
        properties: {
          productName: { type: "string" as const, description: "Name" },
        },
        required: ["productName"],
      };

      renderWithProviders(
        <SchemaBuilder initialSchema={initialSchema} onChange={onChange} />
      );

      expect(screen.getByDisplayValue("productName")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Name")).toBeInTheDocument();
    });
  });
});
