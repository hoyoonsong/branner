import { useState } from 'react';
import { clsx } from 'clsx';
import { BUILDER_PALETTE, OTHER_PALETTE, type FieldType, type PaletteItem } from '../../lib/types';
import { accentOf } from './accents';

/** The apply-hub style "Application Builder" field-type palette. */
export function FieldPalette({
  onAdd,
  onAddPersonalInfo,
  compact = false,
}: {
  onAdd: (type: FieldType) => void;
  onAddPersonalInfo: () => void;
  compact?: boolean;
}) {
  const [showOther, setShowOther] = useState(false);

  return (
    <>
      <div
        className={clsx(
          'grid gap-2',
          compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
        )}
      >
        {BUILDER_PALETTE.map((item) => (
          <PaletteButton key={item.type} item={item} onClick={() => onAdd(item.type)} />
        ))}

        {/* Personal Information quick-add */}
        <button
          type="button"
          onClick={onAddPersonalInfo}
          className={clsx(
            'flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 shadow-sm transition-colors',
            'hover:border-brand-400 hover:bg-brand-50',
          )}
        >
          <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-md bg-brand-100 text-xs text-brand-700">
            👤
          </span>
          Personal Info
        </button>

        {/* Reveal less common field types */}
        <button
          type="button"
          onClick={() => setShowOther(true)}
          className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-md bg-slate-100 text-xs text-slate-600">
            +
          </span>
          Other
        </button>
      </div>

      {showOther && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setShowOther(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">More field types</h3>
              <button
                type="button"
                onClick={() => setShowOther(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
              {OTHER_PALETTE.map((item) => (
                <PaletteButton
                  key={item.type}
                  item={item}
                  onClick={() => {
                    onAdd(item.type);
                    setShowOther(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PaletteButton({ item, onClick }: { item: PaletteItem; onClick: () => void }) {
  const a = accentOf(item.accent);
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 shadow-sm transition-colors',
        a.paletteHover,
      )}
    >
      <span
        className={clsx('grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-xs', a.paletteIcon)}
      >
        {item.icon}
      </span>
      {item.label}
    </button>
  );
}
