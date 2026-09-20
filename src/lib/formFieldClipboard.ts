import type { FormField } from './types';
import { uid } from './utils';

export const FORM_FIELD_CLIPBOARD_KIND = 'campaign-form-fields';
export const FORM_FIELD_CLIPBOARD_KEY = 'form-builder-field-clipboard';
export const FORM_FIELD_CLIPBOARD_EVENT = 'form-builder-clipboard';

type ClipboardPayload = {
  v: 1;
  kind: typeof FORM_FIELD_CLIPBOARD_KIND;
  fields: FormField[];
};

function reassignIds(field: FormField): void {
  field.id = uid(field.type === 'conditional' ? 'branch' : 'q');
  for (const branch of field.branches ?? []) {
    for (const nested of branch.fields ?? []) reassignIds(nested);
  }
}

/** Deep clone a block (and nested if/then follow-ups) with fresh ids. */
export function cloneFormField(field: FormField): FormField {
  const copy = JSON.parse(JSON.stringify(field)) as FormField;
  reassignIds(copy);
  return copy;
}

export function cloneFormFields(fields: FormField[]): FormField[] {
  return fields.map(cloneFormField);
}

export function parseFormFieldClipboard(raw: string): FormField[] | null {
  try {
    const data = JSON.parse(raw) as ClipboardPayload;
    if (
      !data ||
      data.kind !== FORM_FIELD_CLIPBOARD_KIND ||
      data.v !== 1 ||
      !Array.isArray(data.fields) ||
      data.fields.length === 0
    ) {
      return null;
    }
    const ok = data.fields.every(
      (f) =>
        f &&
        typeof f === 'object' &&
        typeof f.id === 'string' &&
        typeof f.type === 'string',
    );
    return ok ? data.fields : null;
  } catch {
    return null;
  }
}

function payloadJson(fields: FormField[]): string {
  const payload: ClipboardPayload = {
    v: 1,
    kind: FORM_FIELD_CLIPBOARD_KIND,
    fields,
  };
  return JSON.stringify(payload);
}

function notifyClipboard() {
  window.dispatchEvent(new Event(FORM_FIELD_CLIPBOARD_EVENT));
}

export function clipboardHasFormFields(): boolean {
  try {
    return parseFormFieldClipboard(
      localStorage.getItem(FORM_FIELD_CLIPBOARD_KEY) ?? '',
    ) !== null;
  } catch {
    return false;
  }
}

export async function writeFormFieldClipboard(
  fields: FormField[],
): Promise<void> {
  if (fields.length === 0) return;
  const json = payloadJson(fields);
  try {
    localStorage.setItem(FORM_FIELD_CLIPBOARD_KEY, json);
  } catch {
    /* ignore quota */
  }
  notifyClipboard();
  try {
    await navigator.clipboard.writeText(json);
  } catch {
    /* localStorage is enough to paste in another form tab */
  }
}

export async function readFormFieldClipboard(
  pastedText?: string,
): Promise<FormField[] | null> {
  if (pastedText) {
    const fromPaste = parseFormFieldClipboard(pastedText);
    if (fromPaste) return fromPaste;
  }
  try {
    const fromOs = parseFormFieldClipboard(await navigator.clipboard.readText());
    if (fromOs) return fromOs;
  } catch {
    /* permission / empty */
  }
  try {
    return parseFormFieldClipboard(
      localStorage.getItem(FORM_FIELD_CLIPBOARD_KEY) ?? '',
    );
  } catch {
    return null;
  }
}

export function isBuilderEditableTarget(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  return !!el.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"]',
  );
}

export function isBuilderInteractiveTarget(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  return !!el.closest(
    'input, textarea, select, button, a, label, [contenteditable="true"], [role="textbox"], [role="menu"], [data-block-menu]',
  );
}
