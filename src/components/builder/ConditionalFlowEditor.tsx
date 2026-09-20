import { useEffect } from 'react';
import type { ConditionalBlock } from '../../types/application';
import type { RegisterLayer, RegisterTarget } from '../../lib/types';
import ConditionalFlowCanvas from './ConditionalFlowCanvas';
import FieldTypePickerModal from './FieldTypePickerModal';
import { useConditionalFlowEditor } from './useConditionalFlowEditor';

type ConditionalFlowEditorProps = {
  block: ConditionalBlock;
  onChange: (block: ConditionalBlock) => void;
  onClose: () => void;
  disabled?: boolean;
  formRegisterTo?: RegisterTarget | null;
  formRegisterLayer?: RegisterLayer | null;
  formRegisterCustomPageId?: string | null;
  formRegisterCustomLayer?: string | null;
};

export default function ConditionalFlowEditor({
  block,
  onChange,
  onClose,
  disabled = false,
  formRegisterTo,
  formRegisterLayer,
  formRegisterCustomPageId,
  formRegisterCustomLayer,
}: ConditionalFlowEditorProps) {
  const {
    normalized,
    contextValue,
    pickerOpen,
    setPickerOpen,
    layoutResetToken,
    resetLayout,
    handleAddFieldClick,
    handleAddField,
    handleAddConditional,
  } = useConditionalFlowEditor(
    block,
    onChange,
    disabled,
    formRegisterTo,
    formRegisterLayer,
    formRegisterCustomPageId,
    formRegisterCustomLayer,
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pickerOpen) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pickerOpen]);

  const title = normalized.label.replace(/<[^>]+>/g, '').trim() || 'If / Then';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Edit flow: {title}</h2>
          <p className="text-xs text-gray-500">
            Click a + to add a follow-up. Drag a node to reposition. Edits save automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetLayout}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            title="Re-run automatic layout"
          >
            Reset layout
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ConditionalFlowCanvas
          block={normalized}
          contextValue={contextValue}
          onAddFieldClick={handleAddFieldClick}
          layoutResetToken={layoutResetToken}
          className="h-full"
        />
      </div>

      <FieldTypePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={handleAddField}
        onAddConditional={handleAddConditional}
        disabled={disabled}
        title="Add follow-up question"
      />
    </div>
  );
}
