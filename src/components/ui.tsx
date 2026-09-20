import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Spinner({
  label,
  inline = false,
}: {
  label?: string;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 align-[-2px]" />
    );
  }
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function Alert({
  variant = "info",
  children,
}: {
  variant?: "info" | "success" | "error" | "warning";
  children: ReactNode;
}) {
  const map = {
    info: "bg-brand-50 text-brand-800 border-brand-200",
    success: "bg-green-50 text-green-800 border-green-200",
    error: "bg-red-50 text-red-800 border-red-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
  };
  return (
    <div className={clsx("rounded-md border px-4 py-3 text-sm", map[variant])}>
      {children}
    </div>
  );
}
