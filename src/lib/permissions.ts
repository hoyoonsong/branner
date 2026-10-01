export const STAFF_PAGES = [
  { id: "attendance", label: "Attendance", to: "/attendance" },
  { id: "residents", label: "Residents", to: "/residents" },
  { id: "contracts", label: "Contracts", to: "/contracts" },
  { id: "birthdays", label: "Birthdays", to: "/birthdays" },
  { id: "map", label: "Map", to: "/map" },
] as const;

export type StaffPageId = (typeof STAFF_PAGES)[number]["id"];
export type AdminRole = "admin" | "student_leader";

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

export function firstStaffPath(
  user: { role?: string | null; pages?: readonly string[] | null } | null | undefined,
): string | null {
  return STAFF_PAGES.find((page) => canAccessPage(user, page.id))?.to ?? null;
}
