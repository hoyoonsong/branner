import type { ConditionalBranch, FieldType, FormField } from "./types";
import { HEADSHOT_DEFAULT_ASPECT, OPTION_TYPES } from "./types";
import { uid } from "./utils";

export function isConditional(field: FormField): boolean {
  return field.type === "conditional";
}

export function createField(type: FieldType): FormField {
  if (type === "conditional") return createConditionalBlock();
  const base: FormField = {
    id: uid(),
    type,
    label: type === "heading" ? "Section heading" : "",
    required: false,
  };
  if (OPTION_TYPES.includes(type)) base.options = ["Option 1", "Option 2"];
  if (type === "radio") base.allowMultiple = false;
  if (type === "file") base.allowLink = true;
  if (type === "headshot") {
    base.label = "Image upload";
    base.headshotAspect = HEADSHOT_DEFAULT_ASPECT;
  }
  if (type === "waiver") {
    base.waiverText = "";
    base.required = true;
  }
  return base;
}

export function createConditionalBlock(): FormField {
  return {
    id: uid("branch"),
    type: "conditional",
    label: "",
    required: false,
    triggerType: "radio",
    options: ["Option 1", "Option 2"],
    branches: [
      { whenValue: "Option 1", fields: [] },
      { whenValue: "Option 2", fields: [] },
    ],
  };
}

export function triggerInputType(block: FormField): FieldType {
  return block.triggerType ?? "radio";
}

export function triggerAsField(block: FormField): FormField {
  return {
    id: block.id,
    type: triggerInputType(block),
    label: block.label,
    required: block.required,
    options: block.options,
    help: block.help,
  };
}

export function syncBranches(field: FormField): FormField {
  if (field.type !== "conditional") return field;
  if (field.triggerType === "checkbox") {
    const existing = field.branches ?? [];
    const trueBranch = existing.find((b) => b.whenValue === "true") ?? {
      whenValue: "true",
      fields: [],
    };
    const falseBranch = existing.find((b) => b.whenValue === "false") ?? {
      whenValue: "false",
      fields: [],
    };
    return { ...field, branches: [trueBranch, falseBranch] };
  }
  const existing = field.branches ?? [];
  const options = (field.options ?? []).map((o) => o.trim()).filter(Boolean);
  const branches: ConditionalBranch[] = options.map(
    (opt) => existing.find((b) => b.whenValue === opt) ?? { whenValue: opt, fields: [] },
  );
  return { ...field, branches };
}

export function flattenInputFields(fields: FormField[]): FormField[] {
  const out: FormField[] = [];
  for (const field of fields) {
    if (field.type === "conditional") {
      out.push(triggerAsField(field));
      for (const branch of field.branches ?? []) {
        out.push(...flattenInputFields(branch.fields));
      }
      continue;
    }
    out.push(field);
  }
  return out;
}

export function getActiveBranch(field: FormField, answer: unknown): ConditionalBranch | null {
  const branches = field.branches ?? [];
  if (Array.isArray(answer)) {
    return branches.find((b) => answer.map(String).includes(b.whenValue)) ?? null;
  }
  if (answer == null || answer === "") return null;
  return branches.find((b) => b.whenValue === String(answer)) ?? null;
}

export function flattenVisibleFields(
  fields: FormField[],
  answers: Record<string, unknown>,
): FormField[] {
  const out: FormField[] = [];
  for (const field of fields) {
    if (field.type === "conditional") {
      out.push(triggerAsField(field));
      const branch = getActiveBranch(field, answers[field.id]);
      if (branch) out.push(...flattenVisibleFields(branch.fields, answers));
      continue;
    }
    out.push(field);
  }
  return out;
}
