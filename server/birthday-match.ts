import { SURVEY_BIRTHDAYS } from "./survey-birthdays.js";

export type ParsedBirthday = { year: number; month: number; day: number };

/** Emails go out at 10:00 AM Pacific on the calendar day before the birthday. */
export const REMINDER_HOUR = 10;
export const REMINDER_TIME_ZONE = "America/Los_Angeles";

export type CalendarDay = { year: number; month: number; day: number };
export type PacificClock = CalendarDay & { hour: number; minute: number };

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

function personSearchHay(parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
  const byEmail = SURVEY_BIRTHDAYS.find((row) =>
    row.emails.some((email) => emails.has(email.trim().toLowerCase())),
  );
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

export function pacificNow(date = new Date()): PacificClock {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: REMINDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
  };
}

export function addDays(day: CalendarDay, days: number): CalendarDay {
  const utc = new Date(Date.UTC(day.year, day.month - 1, day.day + days));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

export function isoDate(day: CalendarDay): string {
  return `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

export function sameDay(a: CalendarDay, b: CalendarDay): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function formatCalendarDate(day: CalendarDay): string {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day, 12));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export type BirthdaySubject = { name: string; detail: string; birthday: string | null };

export function birthdaysOn(subjects: BirthdaySubject[], month: number, day: number) {
  return subjects
    .flatMap((subject) => {
      const parsed = parseBirthday(subject.birthday);
      if (!parsed || parsed.month !== month || parsed.day !== day) return [];
      return [{ name: subject.name, detail: subject.detail }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type UpcomingReminder = {
  send: CalendarDay;
  birthday: CalendarDay;
  people: { name: string; detail: string }[];
  due: boolean;
};

/** Send days from today forward. `due` means today is that send day and it is already 10:00 AM Pacific. */
export function upcomingReminders(
  clock: PacificClock,
  subjects: BirthdaySubject[],
  limit = 8,
): UpcomingReminder[] {
  const hits: UpcomingReminder[] = [];
  for (let i = 0; i < 370 && hits.length < limit; i++) {
    const send = addDays(clock, i);
    const birthday = addDays(send, 1);
    const people = birthdaysOn(subjects, birthday.month, birthday.day);
    if (!people.length) continue;
    hits.push({ send, birthday, people, due: i === 0 && clock.hour >= REMINDER_HOUR });
  }
  return hits;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

export function reminderMessage(birthdayLabel: string, people: { name: string; detail: string }[]) {
  const subject =
    people.length === 1
      ? `${possessive(people[0].name)} birthday is tomorrow`
      : `${people.length} birthdays tomorrow in Branner`;
  const intro =
    people.length === 1
      ? `Tomorrow, ${birthdayLabel}, is ${possessive(people[0].name)} birthday.`
      : `Tomorrow, ${birthdayLabel}, these birthdays are coming up in Branner.`;
  const lines =
    people.length === 1
      ? people[0].detail
        ? [people[0].detail]
        : []
      : people.map((person) => (person.detail ? `${person.name} · ${person.detail}` : person.name));
  const text = [intro, ...(lines.length ? ["", ...lines] : [])].join("\n");
  const list = lines.length
    ? `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
    : "";
  const html = `<div style="font-family: Georgia, 'Source Serif 4', serif; color: #2E2D29; font-size: 16px; line-height: 1.5;"><p>${escapeHtml(intro)}</p>${list}</div>`;
  return { subject, text, html };
}
