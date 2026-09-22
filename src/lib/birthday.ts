import { SURVEY_BIRTHDAYS } from "../data/birthdays";
import { personSearchHay } from "./utils";

export type ParsedBirthday = { year: number; month: number; day: number };

export function parseBirthday(raw: string | null | undefined): ParsedBirthday | null {
  const text = String(raw ?? "").trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  }
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    return { year: Number(us[3]), month: Number(us[1]), day: Number(us[2]) };
  }
  return null;
}

export function birthdayIso(value: ParsedBirthday): string {
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

export function monthDayKey(value: ParsedBirthday): number {
  return value.month * 100 + value.day;
}

export function formatBirthday(value: ParsedBirthday, withYear = true): string {
  const date = new Date(value.year, value.month - 1, value.day);
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export function ageOn(value: ParsedBirthday, on: Date): number {
  let age = on.getFullYear() - value.year;
  const md = on.getMonth() * 100 + on.getDate();
  if (md < monthDayKey(value)) age -= 1;
  return age;
}

export function isBirthdayToday(value: ParsedBirthday, today = new Date()): boolean {
  return today.getMonth() + 1 === value.month && today.getDate() === value.day;
}

export function birthdayHasPassed(value: ParsedBirthday, today = new Date()): boolean {
  return monthDayKey(value) < (today.getMonth() + 1) * 100 + today.getDate();
}

export function nextBirthdayDate(value: ParsedBirthday, today = new Date()): Date {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const thisYear = new Date(today.getFullYear(), value.month - 1, value.day);
  return thisYear >= start ? thisYear : new Date(today.getFullYear() + 1, value.month - 1, value.day);
}

export function daysUntilBirthday(value: ParsedBirthday, today = new Date()): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const next = nextBirthdayDate(value, today);
  return Math.round((next.getTime() - start.getTime()) / 86_400_000);
}

export function formatCountdown(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export function birthdayFor(resident: {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  legalName?: string | null;
  birthday?: string | null;
}): string | null {
  const stored = parseBirthday(resident.birthday);
  if (stored) return birthdayIso(stored);

  const emails = new Set(
    [resident.email]
      .map((value) => String(value ?? "").trim().toLowerCase())
      .filter((value) => value.includes("@")),
  );
  const byEmail = SURVEY_BIRTHDAYS.find((row) => row.emails.some((email) => emails.has(email)));
  if (byEmail) return byEmail.birthday;

  const first = personSearchHay([resident.firstName]);
  const last = personSearchHay([resident.lastName]);
  if (!first || !last) return null;
  const nameHits = SURVEY_BIRTHDAYS.filter((row) => {
    const tokens = personSearchHay([row.fullName]).split(" ").filter(Boolean);
    const surveyLast = tokens[tokens.length - 1] ?? "";
    const surveyFirst = personSearchHay([row.preferredName || tokens[0] || ""]);
    const legalFirst = personSearchHay([tokens[0] || ""]);
    return surveyLast === last && (surveyFirst === first || legalFirst === first);
  });
  return nameHits.length === 1 ? nameHits[0].birthday : null;
}
