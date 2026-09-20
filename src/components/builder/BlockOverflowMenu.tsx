import { useEffect, useRef, useState } from 'react';

type BlockOverflowMenuProps = {
  onCopy: () => void;
  onCut: () => void;
  onDuplicate: () => void;
  disabled?: boolean;
};

export function BlockOverflowMenu({
  onCopy,
  onCut,
  onDuplicate,
  disabled,
}: BlockOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t && rootRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div className="relative" ref={rootRef} data-block-menu>
      <button
        type="button"
        disabled={disabled}
        aria-label="Question actions"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Copy, duplicate, or cut"
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path d="M10 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0 5.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM10 17a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[11rem] rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          <MenuItem label="Copy" hint="⌘C" onClick={() => run(onCopy)} />
          <MenuItem label="Duplicate" onClick={() => run(onDuplicate)} />
          <MenuItem label="Cut" hint="⌘X" onClick={() => run(onCut)} />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  hint,
  onClick,
  danger,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-sm ${
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
      {hint && (
        <span className="text-[10px] font-medium text-slate-400">{hint}</span>
      )}
    </button>
  );
}
