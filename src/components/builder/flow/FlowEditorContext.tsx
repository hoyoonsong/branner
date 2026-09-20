import { createContext, useContext } from 'react';
import type {
  ConditionalBlock,
  ConditionalTriggerType,
  StandardAppItem,
} from '../../../types/application';
import type { RegisterLayer, RegisterTarget } from '../../../lib/types';

export type FlowEditorContextValue = {
  block: ConditionalBlock;
  disabled: boolean;
  /** Form-level File submissions on — drives per-answer yard status UI. */
  formRegisterTo?: RegisterTarget | null;
  /** Form-level map layer; when set, per-answer size is ignored. */
  formRegisterLayer?: RegisterLayer | null;
  /** When the form files to a custom page, that page's id (for map-dot pickers). */
  formRegisterCustomPageId?: string | null;
  /** Form-level custom page layer; when set, hide per-answer layer pickers. */
  formRegisterCustomLayer?: string | null;
  onUpdateTrigger: (path: string, updates: Partial<ConditionalBlock>) => void;
  onUpdateTriggerOptions: (path: string, options: string[]) => void;
  onRenameTriggerOption: (path: string, index: number, label: string) => void;
  onUpdateField: (fieldPath: string, updates: Partial<StandardAppItem>) => void;
  onChangeFieldType: (fieldPath: string, type: StandardAppItem['type']) => void;
  onRemoveField: (fieldPath: string) => void;
  onUpdateRootRequired: (required: boolean) => void;
  onAddFollowUp: (branchPath: string) => void;
};

export const FlowEditorContext = createContext<FlowEditorContextValue | null>(null);

export function useFlowEditor() {
  const ctx = useContext(FlowEditorContext);
  if (!ctx) throw new Error('useFlowEditor must be used within FlowEditorContext');
  return ctx;
}

export const TRIGGER_TYPES: { value: ConditionalTriggerType; label: string }[] = [
  { value: 'select', label: 'Dropdown' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'checkbox', label: 'Yes / No' },
];

export const FIELD_TYPES: { value: StandardAppItem['type']; label: string }[] = [
  { value: 'short_text', label: 'Short text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'address', label: 'Address' },
  { value: 'location', label: 'Location' },
  { value: 'file', label: 'File upload' },
  { value: 'headshot', label: 'Image upload' },
  { value: 'section', label: 'Section' },
];

/** Prevent React Flow from capturing pointer events on interactive controls */
export function stopFlowPointer(e: React.SyntheticEvent) {
  e.stopPropagation();
}
