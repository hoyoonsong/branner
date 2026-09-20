import { useCallback, useMemo, useState } from 'react';
import type { ConditionalBlock, StandardAppItem } from '../../types/application';
import type { RegisterLayer, RegisterTarget } from '../../lib/types';
import { normalizeConditionalBlock } from '../../lib/conditionalFields';
import {
  addConditionalAtBranch,
  addFieldAtBranch,
  changeFieldTypeAtPath,
  removeFieldAtPath,
  renameTriggerOptionAtPath,
  updateFieldAtPath,
  updateTriggerAtPath,
  updateTriggerOptions,
} from '../../lib/conditionalFlowGraph';
import type { FlowEditorContextValue } from './flow/FlowEditorContext';

export function useConditionalFlowEditor(
  block: ConditionalBlock,
  onChange: (block: ConditionalBlock) => void,
  disabled = false,
  formRegisterTo?: RegisterTarget | null,
  formRegisterLayer?: RegisterLayer | null,
  formRegisterCustomPageId?: string | null,
  formRegisterCustomLayer?: string | null,
) {
  const normalized = useMemo(() => normalizeConditionalBlock(block), [block]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerBranchPath, setPickerBranchPath] = useState('');
  const [layoutResetToken, setLayoutResetToken] = useState(0);

  const applyChange = useCallback(
    (next: ConditionalBlock) => {
      onChange(normalizeConditionalBlock(next));
    },
    [onChange],
  );

  const handleAddFieldClick = useCallback((branchPath: string) => {
    setPickerBranchPath(branchPath);
    setPickerOpen(true);
  }, []);

  const contextValue = useMemo<FlowEditorContextValue>(
    () => ({
      block: normalized,
      disabled,
      formRegisterTo,
      formRegisterLayer,
      formRegisterCustomPageId,
      formRegisterCustomLayer,
      onUpdateTrigger: (path, updates) =>
        applyChange(updateTriggerAtPath(normalized, path, updates)),
      onUpdateTriggerOptions: (path, options) =>
        applyChange(updateTriggerOptions(normalized, path, options)),
      onRenameTriggerOption: (path, index, label) =>
        applyChange(renameTriggerOptionAtPath(normalized, path, index, label)),
      onUpdateField: (fieldPath, updates) =>
        applyChange(updateFieldAtPath(normalized, fieldPath, updates)),
      onChangeFieldType: (fieldPath, type) =>
        applyChange(changeFieldTypeAtPath(normalized, fieldPath, type)),
      onRemoveField: (fieldPath) => applyChange(removeFieldAtPath(normalized, fieldPath)),
      onUpdateRootRequired: (required) =>
        applyChange(updateTriggerAtPath(normalized, '', { required })),
      onAddFollowUp: handleAddFieldClick,
    }),
    [
      normalized,
      disabled,
      formRegisterTo,
      formRegisterLayer,
      formRegisterCustomPageId,
      formRegisterCustomLayer,
      applyChange,
      handleAddFieldClick,
    ],
  );

  function handleAddField(type: StandardAppItem['type']) {
    applyChange(addFieldAtBranch(normalized, pickerBranchPath, type));
    setPickerOpen(false);
  }

  function handleAddConditional() {
    applyChange(addConditionalAtBranch(normalized, pickerBranchPath));
    setPickerOpen(false);
  }

  return {
    normalized,
    contextValue,
    pickerOpen,
    setPickerOpen,
    layoutResetToken,
    resetLayout: () => setLayoutResetToken((t) => t + 1),
    handleAddFieldClick,
    handleAddField,
    handleAddConditional,
  };
}
