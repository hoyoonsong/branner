import type { FieldValues, Resolver } from "react-hook-form";
import type { FormField, FormSchema } from "./types";
import { NON_INPUT_TYPES } from "./types";
import { flattenInputFields, flattenVisibleFields, isConditional } from "./conditional";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function labelOf(field: FormField): string {
  return field.label?.trim() || "This field";
}

export function validateField(field: FormField, value: unknown): string | null {
  if (NON_INPUT_TYPES.includes(field.type) && !isConditional(field)) return null;
  const empty = isEmpty(value);
  if (field.type === "checkbox") {
    if (field.required && value !== true) return `${labelOf(field)} is required`;
    return null;
  }
  if (field.required && empty) return `${labelOf(field)} is required`;
  if (empty) return null;
  if (field.type === "email" && typeof value === "string" && !EMAIL_RE.test(value.trim())) {
    return "Enter a valid email";
  }
  if (field.type === "number" && typeof value === "string" && Number.isNaN(Number(value.trim()))) {
    return "Enter a valid number";
  }
  return null;
}

export function makeFormResolver(schema: FormSchema): Resolver<FieldValues> {
  const resolver = async (values: FieldValues) => {
    const visible = flattenVisibleFields(schema.fields, values as Record<string, unknown>);
    const errors: Record<string, { type: string; message: string }> = {};
    for (const field of visible) {
      const msg = validateField(field, (values as Record<string, unknown>)[field.id]);
      if (msg) errors[field.id] = { type: "validate", message: msg };
    }
    return {
      values: Object.keys(errors).length ? {} : values,
      errors,
    };
  };
  return resolver as unknown as Resolver<FieldValues>;
}

export function buildDefaultValues(schema: FormSchema): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of flattenInputFields(schema.fields)) {
    if (field.type === "checkbox") values[field.id] = false;
    else if (field.type === "radio" && field.allowMultiple) values[field.id] = [];
    else values[field.id] = "";
  }
  return values;
}
