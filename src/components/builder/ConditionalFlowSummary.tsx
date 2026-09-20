import type { ConditionalBlock } from '../../types/application';
import type { RegisterLayer, RegisterTarget } from '../../lib/types';
import {
  countBranches,
  countFollowUpFields,
  triggerTypeLabel,
} from '../../lib/conditionalFlowGraph';
import { fieldTypeHeaderClass, fieldTypeLabel } from '../../lib/fieldTypes';
import ConditionalFlowCanvas from './ConditionalFlowCanvas';
import FieldTypePickerModal from './FieldTypePickerModal';
import { useConditionalFlowEditor } from './useConditionalFlowEditor';
import { BlockOverflowMenu } from './BlockOverflowMenu';

type ConditionalFlowSummaryProps = {
  block: ConditionalBlock;
  disabled?: boolean;
  formRegisterTo?: RegisterTarget | null;
  formRegisterLayer?: RegisterLayer | null;
  formRegisterCustomPageId?: string | null;
  formRegisterCustomLayer?: string | null;
  onChange: (block: ConditionalBlock) => void;
  onFullScreen: () => void;
  onRemove: () => void;
  onRequiredChange: (required: boolean) => void;
  selected?: boolean;
  onCopy?: () => void;
  onCut?: () => void;
  onDuplicate?: () => void;
};

function stripLabel(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim() || 'Choose an option';
}

export default function ConditionalFlowSummary({
  block,
  disabled = false,
  formRegisterTo,
  formRegisterLayer,
  formRegisterCustomPageId,
  formRegisterCustomLayer,
  onChange,
  onFullScreen,
  onRemove,
  onRequiredChange,
  selected,
  onCopy,
  onCut,
  onDuplicate,
}: ConditionalFlowSummaryProps) {
  const branches = countBranches(block);
  const followUps = countFollowUpFields(block);

  const { normalized, contextValue, pickerOpen, setPickerOpen, handleAddField, handleAddConditional } =
    useConditionalFlowEditor(
      block,
      onChange,
      disabled,
      formRegisterTo,
      formRegisterLayer,
      formRegisterCustomPageId,
      formRegisterCustomLayer,
    );

  return (
    <div
      className={`rounded-xl border-2 bg-gray-50 p-6 transition-all duration-200 hover:shadow-md ${
        selected
          ? 'border-brand-500 ring-2 ring-brand-200'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <span
            className={`text-2xl font-bold uppercase tracking-wide ${fieldTypeHeaderClass('conditional')}`}
          >
            {fieldTypeLabel('conditional')}
          </span>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <input
              type="checkbox"
              checked={!!block.required}
              onChange={(e) => onRequiredChange(e.target.checked)}
              disabled={disabled}
              className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Required
          </label>
          <p className="hidden min-w-0 truncate text-sm font-medium text-gray-900 sm:block">
            {stripLabel(block.label)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onCopy && onCut && onDuplicate && (
            <BlockOverflowMenu
              onCopy={onCopy}
              onCut={onCut}
              onDuplicate={onDuplicate}
              disabled={disabled}
            />
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
      <p className="mb-1 text-sm font-medium text-gray-900 sm:hidden">{stripLabel(block.label)}</p>
      <p className="text-xs text-gray-500">
        {triggerTypeLabel(block.triggerType)} · {branches} branch
        {branches !== 1 ? 'es' : ''} · {followUps} follow-up
        {followUps !== 1 ? 's' : ''}
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
        <ConditionalFlowCanvas
          block={normalized}
          contextValue={contextValue}
          onAddFieldClick={contextValue.onAddFollowUp}
          className="h-[420px] w-full"
          showControls
          fitPadding={0.15}
        />
      </div>

      <button
        type="button"
        onClick={onFullScreen}
        disabled={disabled}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
          />
        </svg>
        Full screen
      </button>

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
