// Literal Tailwind class strings per accent hue, so the compiler can see them.
export interface AccentClasses {
  chip: string; // colored type chip in a card header
  bar: string; // left accent bar
  header: string; // large bold uppercase card header text
  paletteHover: string; // palette button hover border
  paletteIcon: string; // palette icon swatch
}

export const ACCENTS: Record<string, AccentClasses> = {
  emerald: {
    chip: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-500',
    header: 'text-emerald-600',
    paletteHover: 'hover:border-emerald-400 hover:bg-emerald-50',
    paletteIcon: 'bg-emerald-100 text-emerald-700',
  },
  sky: {
    chip: 'bg-sky-100 text-sky-700',
    bar: 'bg-sky-500',
    header: 'text-sky-600',
    paletteHover: 'hover:border-sky-400 hover:bg-sky-50',
    paletteIcon: 'bg-sky-100 text-sky-700',
  },
  amber: {
    chip: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-500',
    header: 'text-amber-600',
    paletteHover: 'hover:border-amber-400 hover:bg-amber-50',
    paletteIcon: 'bg-amber-100 text-amber-700',
  },
  violet: {
    chip: 'bg-violet-100 text-violet-700',
    bar: 'bg-violet-500',
    header: 'text-violet-600',
    paletteHover: 'hover:border-violet-400 hover:bg-violet-50',
    paletteIcon: 'bg-violet-100 text-violet-700',
  },
  fuchsia: {
    chip: 'bg-fuchsia-100 text-fuchsia-700',
    bar: 'bg-fuchsia-500',
    header: 'text-fuchsia-600',
    paletteHover: 'hover:border-fuchsia-400 hover:bg-fuchsia-50',
    paletteIcon: 'bg-fuchsia-100 text-fuchsia-700',
  },
  rose: {
    chip: 'bg-rose-100 text-rose-700',
    bar: 'bg-rose-500',
    header: 'text-rose-600',
    paletteHover: 'hover:border-rose-400 hover:bg-rose-50',
    paletteIcon: 'bg-rose-100 text-rose-700',
  },
  slate: {
    chip: 'bg-slate-200 text-slate-700',
    bar: 'bg-slate-500',
    header: 'text-slate-600',
    paletteHover: 'hover:border-slate-400 hover:bg-slate-50',
    paletteIcon: 'bg-slate-200 text-slate-700',
  },
  teal: {
    chip: 'bg-teal-100 text-teal-700',
    bar: 'bg-teal-500',
    header: 'text-teal-600',
    paletteHover: 'hover:border-teal-400 hover:bg-teal-50',
    paletteIcon: 'bg-teal-100 text-teal-700',
  },
  cyan: {
    chip: 'bg-cyan-100 text-cyan-700',
    bar: 'bg-cyan-500',
    header: 'text-cyan-600',
    paletteHover: 'hover:border-cyan-400 hover:bg-cyan-50',
    paletteIcon: 'bg-cyan-100 text-cyan-700',
  },
  indigo: {
    chip: 'bg-indigo-100 text-indigo-700',
    bar: 'bg-indigo-500',
    header: 'text-indigo-600',
    paletteHover: 'hover:border-indigo-400 hover:bg-indigo-50',
    paletteIcon: 'bg-indigo-100 text-indigo-700',
  },
};

export function accentOf(hue: string): AccentClasses {
  return ACCENTS[hue] ?? ACCENTS.slate;
}
