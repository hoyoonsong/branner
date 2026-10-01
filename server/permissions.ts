export const STAFF_PAGES = [
  { id: "attendance", label: "Attendance" },
  { id: "residents", label: "Residents" },
  { id: "contracts", label: "Contracts" },
  { id: "birthdays", label: "Birthdays" },
  { id: "map", label: "Map" },
] as const;

export type StaffPageId = (typeof STAFF_PAGES)[number]["id"];
export type AdminRole = "admin" | "student_leader";

const PAGE_IDS = new Set<string>(STAFF_PAGES.map((page) => page.id));

export const RESIDENT_READ_PAGES: StaffPageId[] = ["residents", "birthdays", "map", "contracts"];

export function isStaffPage(id: string): id is StaffPageId {
  return PAGE_IDS.has(id);
}

export function parsePages(raw: unknown): StaffPageId[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
  }
  const selected = new Set<string>();
  for (const item of list) {
    if (typeof item === "string" && PAGE_IDS.has(item)) selected.add(item);
  }
  return STAFF_PAGES.map((page) => page.id).filter((id) => selected.has(id));
}

export function normalizeRole(role: string | null | undefined): AdminRole {
  return role === "student_leader" ? "student_leader" : "admin";
}

export function isFullAdmin(user: { role?: string | null } | null | undefined): boolean {
  return Boolean(user) && user?.role !== "student_leader";
}

export function canAccessPage(
  user: { role?: string | null; pages?: readonly string[] | null } | null | undefined,
  page: StaffPageId,
): boolean {
  if (!user) return false;
  if (user.role !== "student_leader") return true;
  return (user.pages ?? []).includes(page);
}
