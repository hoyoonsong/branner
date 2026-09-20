import { useEffect, useRef, useState } from 'react';
import { stopFlowPointer } from './FlowEditorContext';

type FlowTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onBlur?: (value: string) => void;
};

/** Strip HTML tags only — never trim, so spaces while typing are preserved */
export function toPlainLabel(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

export default function FlowTextInput({
  value,
  onChange,
  disabled = false,
  placeholder,
  className = '',
  onBlur,
}: FlowTextInputProps) {
  const [draft, setDraft] = useState(() => toPlainLabel(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(toPlainLabel(value));
  }, [value]);

  return (
    <input
      type="text"
      value={draft}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        onChange(draft);
        onBlur?.(draft);
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        onChange(next);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onPointerDown={stopFlowPointer}
      disabled={disabled}
      placeholder={placeholder}
      className={`nodrag nopan nowheel ${className}`}
    />
  );
}
