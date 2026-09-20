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

export function formatCheckIn(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameDay = d.toDateString() === new Date().toDateString();
  const when = sameDay
    ? time
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `${when} · ${formatRelative(d)}`;
}

export function formatRelative(d: Date): string {
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 90) return "1 min ago";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 5400) return "1 hr ago";
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hr ago`;
  if (seconds < 172800) return "yesterday";
  return `${Math.round(seconds / 86400)} days ago`;
}

export function personSearchHay(parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
