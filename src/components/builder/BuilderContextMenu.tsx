import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export type BuilderContextMenuItem = {
  id: string;
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function BuilderContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: BuilderContextMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t && ref.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const left = Math.min(x, window.innerWidth - 200);
  const top = Math.min(y, window.innerHeight - 16 - items.length * 36);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      data-block-menu
      className="fixed z-[6000] min-w-[12rem] rounded-md border border-slate-200 bg-white py-1 shadow-xl"
      style={{ left, top }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            item.onClick();
            onClose();
          }}
          className={`flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-sm disabled:opacity-40 ${
            item.danger
              ? 'text-red-600 hover:bg-red-50'
              : 'text-slate-700 hover:bg-slate-50'
          }`}
        >
          {item.label}
          {item.hint && (
            <span className="text-[10px] font-medium text-slate-400">
              {item.hint}
            </span>
          )}
        </button>
      ))}
    </div>,
    document.body,
  );
}
