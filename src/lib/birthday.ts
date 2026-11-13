import type { ParsedBirthday } from "../../server/birthday-match";

export { birthdayFor, parseBirthday } from "../../server/birthday-match";
export type { ParsedBirthday } from "../../server/birthday-match";

export function monthDayKey(value: ParsedBirthday): number {
  return value.month * 100 + value.day;
}

/** School year starts September 15, so June–August sort after spring and before the next September. */
const SCHOOL_YEAR_START = 915;

export function schoolYearOrder(month: number, day: number): number {
  const key = month * 100 + day;
  return key >= SCHOOL_YEAR_START ? key : key + 10_000;
}

export function isSummerBirthday(month: number): boolean {
  return month >= 6 && month <= 8;
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
  const md = (on.getMonth() + 1) * 100 + on.getDate();
  if (md < monthDayKey(value)) age -= 1;
  return age;
}

export function isBirthdayToday(value: ParsedBirthday, today = new Date()): boolean {
  return today.getMonth() + 1 === value.month && today.getDate() === value.day;
}

export function birthdayHasPassed(value: ParsedBirthday, today = new Date()): boolean {
  return (
    schoolYearOrder(value.month, value.day) <
    schoolYearOrder(today.getMonth() + 1, today.getDate())
  );
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

export function msUntilMidnight(now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight.getTime() - now.getTime();
}

/** Time left until midnight, counting down to 0:00:00. */
export function midnightCountdown(now: Date): { clock: string; done: boolean } {
  const ms = msUntilMidnight(now);
  if (ms <= 0) return { clock: "0:00:00", done: true };
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return { clock, done: false };
}
