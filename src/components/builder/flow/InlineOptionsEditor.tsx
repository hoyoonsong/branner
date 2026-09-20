import { useEffect, useRef, useState } from 'react';
import { stopFlowPointer } from './FlowEditorContext';

type InlineOptionsEditorProps = {
  options: string[];
  onChange: (options: string[]) => void;
  onRename?: (index: number, label: string) => void;
  disabled?: boolean;
  minOptions?: number;
};

export default function InlineOptionsEditor({
  options,
  onChange,
  onRename,
  disabled = false,
  minOptions = 1,
}: InlineOptionsEditorProps) {
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
    const trimmed = (drafts[index] ?? '').trim();
    if (!trimmed) return;
    if (onRename) {
      onRename(index, trimmed);
      return;
    }
    const next = [...drafts];
    next[index] = trimmed;
    commitDrafts(next);
  }

  function removeAt(index: number) {
    if (drafts.length <= minOptions || disabled) return;
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
      <div className="text-[10px] font-medium text-gray-500">Answer choices</div>
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
            placeholder={`Option ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => removeAt(index)}
            disabled={disabled || drafts.length <= minOptions}
            className="nodrag shrink-0 rounded px-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-30"
            aria-label="Remove option"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => addOptionAtEnd(false)}
        disabled={disabled}
        className="nodrag text-[11px] font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
      >
        + Add branch
      </button>
    </div>
  );
}
