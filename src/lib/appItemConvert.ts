// ---------------------------------------------------------------------------
// Bridges the builder's internal apply-hub "AppItem" model (used by the drag +
// flowchart If/Then editor) with the app's storage/runtime "FormField" model.
//
// Only conditional blocks and the fields nested inside their branches ever pass
// through here — top-level standard fields are edited directly as FormField.
// ---------------------------------------------------------------------------

import type { AppItem, ConditionalBlock, ConditionalTriggerType, StandardAppItem } from '../types/application';
import type { ConditionalBranch, FieldType, FormField } from './types';
import { HEADSHOT_DEFAULT_ASPECT } from './types';
import { uid } from './utils';

// --- FormField -> AppItem (load into the flow editor) ----------------------

function fieldTypeToAppType(type: FieldType): StandardAppItem['type'] {
  switch (type) {
    case 'text':
      return 'short_text';
    case 'email':
      return 'email';
    case 'phone':
      return 'phone';
    case 'number':
      return 'number';
    case 'textarea':
      return 'long_text';
    case 'address':
      return 'address';
    case 'location':
      return 'location';
    case 'heading':
      return 'section';
    case 'date':
      return 'date';
    case 'select':
      return 'select';
    case 'radio':
      return 'multiple_choice';
    case 'checkbox':
    case 'yesno':
      return 'checkbox';
    case 'file':
      return 'file';
    case 'headshot':
      return 'headshot';
    case 'waiver':
      return 'waiver';
    default:
      return 'short_text';
  }
}

function triggerToAppTrigger(t: FormField['triggerType']): ConditionalTriggerType {
  if (t === 'select') return 'select';
  if (t === 'checkbox') return 'checkbox';
  return 'multiple_choice';
}

export function formFieldToAppItem(field: FormField): AppItem {
  if (field.type === 'conditional') return formFieldToBlock(field);

  const key = field.id;
  const label = field.label ?? '';
  const required = !!field.required;
  const appType = fieldTypeToAppType(field.type);

  switch (appType) {
    case 'select':
      return { type: 'select', key, label, required, options: field.options ?? [] };
    case 'multiple_choice':
      return {
        type: 'multiple_choice',
        key,
        label,
        required,
        options: field.options ?? [],
        allowMultiple: !!field.allowMultiple,
        allowOther: !!field.allowOther,
      };
    case 'checkbox':
      return { type: 'checkbox', key, label, required };
    case 'number':
      return { type: 'number', key, label, required };
    case 'email':
      return { type: 'email', key, label, required };
    case 'phone':
      return { type: 'phone', key, label, required };
    case 'section':
      return {
        type: 'section',
        key,
        label,
        richText: field.richText,
        ...(field.embedUrl ? { embedUrl: field.embedUrl } : {}),
      };
    case 'address':
      return { type: 'address', key, label, required, addressFields: field.addressFields };
    case 'location':
      return { type: 'location', key, label, required };
    case 'file':
      return { type: 'file', key, label, required, allowLink: field.allowLink !== false };
    case 'headshot':
      return { type: 'headshot', key, label, required, headshotAspect: field.headshotAspect };
    case 'waiver':
      return {
        type: 'waiver',
        key,
        label,
        required,
        waiverText: field.waiverText ?? '',
        requireSignature: !!field.requireSignature,
        requireDate: !!field.requireDate,
      };
    case 'long_text':
      return { type: 'long_text', key, label, required, maxWords: field.maxWords };
    case 'date':
      return { type: 'date', key, label, required };
    case 'short_text':
    default:
      return { type: 'short_text', key, label, required };
  }
}

export function formFieldToBlock(field: FormField): ConditionalBlock {
  return {
    type: 'conditional',
    key: field.id,
    label: field.label ?? '',
    required: !!field.required,
    triggerType: triggerToAppTrigger(field.triggerType),
    options: field.options ?? [],
    branches: (field.branches ?? []).map((b) => ({
      whenValue: b.whenValue,
      fields: (b.fields ?? []).map(formFieldToAppItem),
    })),
    ...(field.connectRegister ? { connectRegister: field.connectRegister } : {}),
    ...(field.connectYardStatus ? { connectYardStatus: field.connectYardStatus } : {}),
    ...(field.connectVolunteerStatus
      ? { connectVolunteerStatus: field.connectVolunteerStatus }
      : {}),
    ...(field.connectLayer ? { connectLayer: field.connectLayer } : {}),
    ...(field.connectHostType ? { connectHostType: field.connectHostType } : {}),
    ...(field.connectCustomPageId
      ? { connectCustomPageId: field.connectCustomPageId }
      : {}),
    ...(field.connectCustomLocationId
      ? { connectCustomLocationId: field.connectCustomLocationId }
      : {}),
    ...(field.connectCustomLayer
      ? { connectCustomLayer: field.connectCustomLayer }
      : {}),
  };
}

// --- AppItem -> FormField (save out of the flow editor) --------------------

function appTypeToFieldType(type: StandardAppItem['type']): FieldType {
  switch (type) {
    case 'short_text':
      return 'text';
    case 'long_text':
      return 'textarea';
    case 'number':
      return 'number';
    case 'email':
      return 'email';
    case 'phone':
      return 'phone';
    case 'date':
      return 'date';
    case 'section':
      return 'heading';
    case 'address':
      return 'address';
    case 'location':
      return 'location';
    case 'select':
      return 'select';
    case 'multiple_choice':
      return 'radio';
    case 'checkbox':
      return 'checkbox';
    case 'file':
      return 'file';
    case 'headshot':
      return 'headshot';
    case 'waiver':
      return 'waiver';
    default:
      return 'text';
  }
}

function appTriggerToTrigger(t: ConditionalTriggerType): FormField['triggerType'] {
  if (t === 'select') return 'select';
  if (t === 'checkbox') return 'checkbox';
  return 'radio';
}

export function appItemToFormField(item: AppItem): FormField {
  if (item.type === 'conditional') return blockToFormField(item);

  const id = item.key || uid();
  const base: FormField = {
    id,
    type: appTypeToFieldType(item.type),
    label: item.label ?? '',
    required: 'required' in item ? !!item.required : false,
  };

  switch (item.type) {
    case 'select':
      base.options = item.options ?? [];
      break;
    case 'multiple_choice':
      base.options = item.options ?? [];
      base.allowMultiple = !!item.allowMultiple;
      base.allowOther = !!item.allowOther;
      break;
    case 'file':
      base.allowLink = item.allowLink !== false;
      break;
    case 'headshot':
      base.headshotAspect = item.headshotAspect ?? HEADSHOT_DEFAULT_ASPECT;
      break;
    case 'long_text':
      if (item.maxWords) base.maxWords = item.maxWords;
      break;
    case 'address':
      if (item.addressFields) base.addressFields = item.addressFields;
      break;
    case 'section':
      if (item.richText) base.richText = item.richText;
      if (item.embedUrl) base.embedUrl = item.embedUrl;
      break;
    case 'waiver':
      base.waiverText = item.waiverText ?? '';
      base.requireSignature = !!item.requireSignature;
      base.requireDate = !!item.requireDate;
      break;
    default:
      break;
  }
  return base;
}

export function blockToFormField(block: ConditionalBlock): FormField {
  const branches: ConditionalBranch[] = (block.branches ?? []).map((b) => ({
    whenValue: b.whenValue,
    fields: (b.fields ?? []).map(appItemToFormField),
  }));
  return {
    id: block.key || uid('branch'),
    type: 'conditional',
    label: block.label ?? '',
    required: !!block.required,
    triggerType: appTriggerToTrigger(block.triggerType),
    options: block.options ?? [],
    branches,
    ...(block.connectRegister ? { connectRegister: block.connectRegister } : {}),
    ...(block.connectYardStatus ? { connectYardStatus: block.connectYardStatus } : {}),
    ...(block.connectVolunteerStatus
      ? { connectVolunteerStatus: block.connectVolunteerStatus }
      : {}),
    ...(block.connectLayer ? { connectLayer: block.connectLayer } : {}),
    ...(block.connectHostType ? { connectHostType: block.connectHostType } : {}),
    ...(block.connectCustomPageId
      ? { connectCustomPageId: block.connectCustomPageId }
      : {}),
    ...(block.connectCustomLocationId
      ? { connectCustomLocationId: block.connectCustomLocationId }
      : {}),
    ...(block.connectCustomLayer
      ? { connectCustomLayer: block.connectCustomLayer }
      : {}),
  };
}
