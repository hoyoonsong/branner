export type AttendanceStatus = "present" | "late" | "excused";

const META_KEYS = new Set([
  "staffMarked",
  "late",
  "lateAt",
  "excused",
  "excusedAt",
  "excusedNote",
  "formSubmitted",
]);

export function parseResponseData(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function attendanceStatus(row: {
  status?: string | null;
  responseData?: Record<string, unknown> | string | null;
}): AttendanceStatus {
  const data = parseResponseData(row.responseData);
  const status = (row.status ?? "").toLowerCase();
  if (status === "late" || data.late === true) return "late";
  if (status === "excused" || data.excused === true) return "excused";
  return "present";
}

export function formWasSubmitted(data: Record<string, unknown> | string | null | undefined): boolean {
  const parsed = parseResponseData(data);
  if (parsed.formSubmitted === true) return true;
  return Object.entries(parsed).some(([key, value]) => !META_KEYS.has(key) && value != null && value !== "" && value !== false);
}

export function lateAtOf(data: Record<string, unknown> | string | null | undefined): string | null {
  const value = parseResponseData(data).lateAt;
  return typeof value === "string" && value ? value : null;
}

export function applyAttendanceStatus(
  current: Record<string, unknown>,
  status: AttendanceStatus,
  note?: string,
): Record<string, unknown> {
  const next = { ...current };
  const now = new Date().toISOString();
  if (status === "late") {
    next.late = true;
    next.lateAt = typeof next.lateAt === "string" && next.lateAt ? next.lateAt : now;
    delete next.excused;
    delete next.excusedAt;
    delete next.excusedNote;
  } else if (status === "excused") {
    next.excused = true;
    next.excusedAt = now;
    if (note?.trim()) next.excusedNote = note.trim();
    else delete next.excusedNote;
    delete next.late;
    delete next.lateAt;
  } else {
    delete next.late;
    delete next.lateAt;
    delete next.excused;
    delete next.excusedAt;
    delete next.excusedNote;
  }
  next.staffMarked = true;
  return next;
}
