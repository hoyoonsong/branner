export function uid(prefix = "q"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function fullName(r: { firstName: string; lastName: string }): string {
  return `${r.firstName} ${r.lastName}`;
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
