import { useEffect, useRef, useState } from 'react';
import { stopFlowPointer } from './FlowEditorContext';

type InlineFieldOptionsEditorProps = {
  options: string[];
  onChange: (options: string[]) => void;
  disabled?: boolean;
  allowMultiple?: boolean;
  allowOther?: boolean;
  onAllowMultipleChange?: (value: boolean) => void;
  onAllowOtherChange?: (value: boolean) => void;
  showMultipleChoiceSettings?: boolean;
};

export default function InlineFieldOptionsEditor({
  options,
  onChange,
  disabled = false,
  allowMultiple = false,
  allowOther = false,
  onAllowMultipleChange,
  onAllowOtherChange,
  showMultipleChoiceSettings = false,
}: InlineFieldOptionsEditorProps) {
  const [drafts, setDrafts] = useState<string[]>(options);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    setDrafts(options);
  }, [options]);

  useEffect(() => {
    if (focusIndex === null) return;
    inputRefs.current[focusIndex]?.focus();
    inputRefs.current[focusIndex]?.select();
    setFocusIndex(null);
  }, [focusIndex, drafts.length]);

  function commitDrafts(next: string[]) {
    setDrafts(next);
    onChange(next.filter((o) => o.trim() !== ''));
  }

  function updateAt(index: number, value: string) {
    const next = [...drafts];
    next[index] = value;
    setDrafts(next);
  }

  function commitAt(index: number) {
    const next = [...drafts];
    next[index] = (next[index] ?? '').trim();
    if (!next[index]) return;
    commitDrafts(next);
  }

  function removeAt(index: number) {
    if (drafts.length <= 1 || disabled) return;
    commitDrafts(drafts.filter((_, i) => i !== index));
  }

  function addOptionAtEnd(select: boolean) {
    if (disabled) return;
    const next = [...drafts, `Option ${drafts.length + 1}`];
    setDrafts(next);
    onChange(next);
    if (select) setFocusIndex(next.length - 1);
  }

  function handleEnter(index: number) {
    commitAt(index);
    if (index < drafts.length - 1) setFocusIndex(index + 1);
    else addOptionAtEnd(true);
  }

  return (
    <div className="mt-2 space-y-1" onPointerDown={stopFlowPointer}>
      {showMultipleChoiceSettings && (
        <label className="mb-1 flex items-center gap-1.5 text-[10px] text-gray-600">
          <input
            type="checkbox"
            checked={allowMultiple}
            onChange={(e) => onAllowMultipleChange?.(e.target.checked)}
            disabled={disabled}
            className="nodrag h-3 w-3 rounded text-indigo-600"
          />
          Allow multiple selections
        </label>
      )}
      <div className="text-[10px] font-medium text-gray-500">Options</div>
      {drafts.map((option, index) => (
        <div key={index} className="flex items-center gap-1">
          <input
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            value={option}
            onChange={(e) => updateAt(index, e.target.value)}
            onBlur={() => commitAt(index)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                handleEnter(index);
              }
            }}
            disabled={disabled}
            className="nodrag nopan min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => removeAt(index)}
            disabled={disabled || drafts.length <= 1}
            className="nodrag shrink-0 rounded px-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-30"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={() => addOptionAtEnd(false)}
          disabled={disabled}
          className="nodrag font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          + Add option
        </button>
        {showMultipleChoiceSettings && onAllowOtherChange && (
          <label className="flex items-center gap-1 text-gray-600">
            <input
              type="checkbox"
              checked={allowOther}
              onChange={(e) => onAllowOtherChange(e.target.checked)}
              disabled={disabled}
              className="nodrag h-3 w-3 rounded text-indigo-600"
            />
            &quot;Other&quot;
          </label>
        )}
      </div>
    </div>
  );
}
