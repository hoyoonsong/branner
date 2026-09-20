import type {
  AppItem,
  ConditionalBlock,
  ConditionalBranch,
  StandardAppItem,
} from '../types/application';
import type { RegisterTarget } from './types';
import { defaultOptionsForField, fieldTypeLabel, triggerUsesOptions } from './fieldTypes';

export function isConditionalBlock(field: AppItem): field is ConditionalBlock {
  return field.type === 'conditional';
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createConditionalBlock(): ConditionalBlock {
  const options = ['Option A', 'Option B'];
  return {
    type: 'conditional',
    label: 'Choose an option',
    key: uid('conditional'),
    required: true,
    triggerType: 'select',
    options,
    branches: options.map((whenValue) => ({ whenValue, fields: [] })),
  };
}

export function createNestedField(type: StandardAppItem['type']): StandardAppItem {
  const label = fieldTypeLabel(type);
  const key = uid(type);
  if (type === 'section') {
    return { type: 'section', label: 'Section heading', key };
  }
  if (type === 'select' || type === 'multiple_choice') {
    return {
      type,
      label,
      key,
      required: false,
      options: defaultOptionsForField(type) ?? ['Option 1', 'Option 2'],
    };
  }
  if (type === 'file') {
    return { type, label, key, required: false, allowLink: true };
  }
  if (type === 'waiver') {
    return { type, label, key, required: true, waiverText: '' };
  }
  return { type, label, key, required: false };
}

export function syncConditionalBranches(
  block: ConditionalBlock,
  nextOptions: string[],
): ConditionalBranch[] {
  const byValue = new Map(block.branches.map((branch) => [branch.whenValue, branch]));
  return nextOptions.map((whenValue) => byValue.get(whenValue) ?? { whenValue, fields: [] });
}

function renameKeyedMap<T>(
  map: Partial<Record<string, T>> | undefined,
  oldKey: string,
  newKey: string,
): Partial<Record<string, T>> | undefined {
  if (!map || !(oldKey in map)) return map;
  const next = { ...map };
  const val = next[oldKey];
  delete next[oldKey];
  if (newKey && val !== undefined) next[newKey] = val;
  return Object.keys(next).length ? next : undefined;
}

export function renameConditionalOption(
  block: ConditionalBlock,
  index: number,
  nextLabel: string,
): ConditionalBlock {
  const options = [...(block.options ?? [])];
  const oldValue = options[index];
  if (!oldValue || oldValue === nextLabel) return block;
  options[index] = nextLabel;
  const branches = (block.branches ?? []).map((branch) =>
    branch.whenValue === oldValue ? { ...branch, whenValue: nextLabel } : branch,
  );
  return normalizeConditionalBlock({
    ...block,
    options,
    branches,
    connectRegister: renameKeyedMap(block.connectRegister, oldValue, nextLabel) as
      | Record<string, RegisterTarget>
      | undefined,
    connectYardStatus: renameKeyedMap(block.connectYardStatus, oldValue, nextLabel),
    connectLayer: renameKeyedMap(block.connectLayer, oldValue, nextLabel),
    connectHostType: renameKeyedMap(block.connectHostType, oldValue, nextLabel),
    connectCustomPageId: renameKeyedMap(
      block.connectCustomPageId,
      oldValue,
      nextLabel,
    ) as Record<string, string> | undefined,
    connectCustomLocationId: renameKeyedMap(
      block.connectCustomLocationId,
      oldValue,
      nextLabel,
    ) as Record<string, string> | undefined,
    connectCustomLayer: renameKeyedMap(
      block.connectCustomLayer,
      oldValue,
      nextLabel,
    ) as Record<string, string> | undefined,
  });
}

function normalizeBranchFields(fields: unknown[]): AppItem[] {
  return (fields ?? []).map((raw) => {
    if (!raw || typeof raw !== 'object') return createNestedField('short_text');
    const record = raw as Record<string, unknown>;
    const type = String(record.type ?? 'short_text').toLowerCase();
    if (type === 'conditional') {
      return normalizeConditionalBlock({
        ...(record as Partial<ConditionalBlock>),
        type: 'conditional',
        key: (typeof record.key === 'string' && record.key) || uid('conditional'),
      });
    }
    return { ...(record as StandardAppItem) };
  });
}

export function normalizeConditionalBlock(
  field: Partial<ConditionalBlock> & { type: 'conditional' },
): ConditionalBlock {
  const triggerType =
    field.triggerType === 'checkbox'
      ? 'checkbox'
      : field.triggerType === 'multiple_choice'
        ? 'multiple_choice'
        : 'select';
  const rawLabel = field.label ?? '';
  const label = rawLabel === '' ? 'Choose an option' : rawLabel;
  const key = field.key;

  const connectExtras = {
    ...(field.connectRegister ? { connectRegister: field.connectRegister } : {}),
    ...(field.connectYardStatus ? { connectYardStatus: field.connectYardStatus } : {}),
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

  if (triggerType === 'checkbox') {
    const existing = field.branches ?? [];
    const trueBranch = existing.find((b) => b.whenValue === 'true');
    const falseBranch = existing.find((b) => b.whenValue === 'false');
    return {
      type: 'conditional',
      label,
      key,
      required: field.required ?? false,
      triggerType: 'checkbox',
      branches: [
        { whenValue: 'true', fields: normalizeBranchFields(trueBranch?.fields ?? []) },
        { whenValue: 'false', fields: normalizeBranchFields(falseBranch?.fields ?? []) },
      ],
      ...connectExtras,
    };
  }

  const options =
    field.options && field.options.length > 0 ? field.options : ['Option A', 'Option B'];
  const base: ConditionalBlock = {
    type: 'conditional',
    label,
    key,
    required: field.required ?? false,
    triggerType,
    options: triggerUsesOptions(triggerType) ? options : undefined,
    branches: (field.branches ?? []).map((branch) => ({
      whenValue: branch.whenValue,
      fields: normalizeBranchFields(branch.fields ?? []),
    })),
    ...connectExtras,
  };

  return {
    ...base,
    branches: syncConditionalBranches(base, options).map((branch) => ({
      ...branch,
      fields: normalizeBranchFields(branch.fields ?? []),
    })),
  };
}

export function getActiveConditionalBranch(
  block: ConditionalBlock,
  answer: unknown,
): ConditionalBranch | null {
  const branches = block.branches ?? [];
  if (block.triggerType === 'checkbox') {
    const checked = answer === true || answer === 'true';
    return branches.find((b) => b.whenValue === (checked ? 'true' : 'false')) ?? null;
  }
  if (answer === null || answer === undefined || answer === '') return null;
  return branches.find((b) => b.whenValue === String(answer)) ?? null;
}

export function flattenVisibleFields(
  fields: AppItem[],
  answers: Record<string, unknown>,
): AppItem[] {
  const visible: AppItem[] = [];
  for (const field of fields) {
    if (isConditionalBlock(field)) {
      visible.push(field);
      const branch = getActiveConditionalBranch(field, answers[field.key ?? '']);
      if (branch) visible.push(...flattenVisibleFields(branch.fields, answers));
      continue;
    }
    visible.push(field);
  }
  return visible;
}

export function flattenAllNestedFields(fields: AppItem[]): AppItem[] {
  const result: AppItem[] = [];
  for (const field of fields) {
    if (isConditionalBlock(field)) {
      for (const branch of field.branches ?? []) {
        result.push(...flattenAllNestedFields(branch.fields ?? []));
      }
      continue;
    }
    result.push(field);
  }
  return result;
}
