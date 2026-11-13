import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { birthdayFor } from "./birthday-match.js";
import {
  REMINDER_HOUR,
  formatCalendarDate,
  isoDate,
  pacificNow,
  reminderMessage,
  sameDay,
  upcomingReminders,
  type BirthdaySubject,
  type UpcomingReminder,
} from "./birthday-match.js";

const TICK_MS = 60_000;

export type ReminderPerson = {
  email: string;
  name: string;
  detail: string;
  kind: "resident" | "admin";
};

export function mailConfig() {
  const from = process.env.RESEND_FROM?.trim() || "";
  const ready = Boolean(process.env.RESEND_API_KEY?.trim() && from);
  return { ready, from };
}

export async function listReminderPeople(): Promise<ReminderPerson[]> {
  const [residents, admins] = await Promise.all([
    prisma.resident.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.admin.findMany({ where: { status: "approved" }, orderBy: { name: "asc" } }),
  ]);
  const seen = new Set<string>();
  const people: ReminderPerson[] = [];
  for (const resident of residents) {
    const email = resident.email.trim().toLowerCase();
    if (!email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    people.push({
      email,
      name: `${resident.firstName} ${resident.lastName}`.trim(),
      detail: [resident.room, resident.hall].filter(Boolean).join(" · "),
      kind: "resident",
    });
  }
  for (const admin of admins) {
    const email = admin.email.trim().toLowerCase();
    if (!email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    people.push({ email, name: admin.name, detail: "Admin", kind: "admin" });
  }
  return people;
}

async function birthdaySubjects(): Promise<BirthdaySubject[]> {
  const residents = await prisma.resident.findMany();
  return residents.map((resident) => ({
    name: `${resident.firstName} ${resident.lastName}`.trim(),
    detail: [resident.room, resident.hall].filter(Boolean).join(" · "),
    birthday: birthdayFor(resident),
  }));
}

function sendLabel(reminder: UpcomingReminder, today: { year: number; month: number; day: number }) {
  const when = sameDay(reminder.send, today) ? "Today" : formatCalendarDate(reminder.send);
  return `${when} at 10:00 AM Pacific`;
}

export async function reminderOverview() {
  const clock = pacificNow();
  const [people, selectedRows, subjects, status] = await Promise.all([
    listReminderPeople(),
    prisma.birthdayReminderRecipient.findMany(),
    birthdaySubjects(),
    prisma.birthdayReminderStatus.findUnique({ where: { id: "status" } }),
  ]);
  const allowed = new Set(people.map((person) => person.email));
  const selected = selectedRows.map((row) => row.email).filter((email) => allowed.has(email));
  const hits = upcomingReminders(clock, subjects);
  let next = hits[0] ?? null;
  if (next?.due && selected.length) {
    const sent = await prisma.birthdayReminderSend.findMany({
      where: { occurrence: isoDate(next.birthday), email: { in: selected } },
    });
    if (sent.length >= selected.length) next = hits[1] ?? null;
  }
  return {
    ...mailConfig(),
    selected,
    people,
    lastError: status?.lastError ?? "",
    lastSentAt: status?.lastSentAt?.toISOString() ?? null,
    next: next
      ? {
          sendLabel: sendLabel(next, clock),
          birthdayLabel: formatCalendarDate(next.birthday),
          due: next.due,
          people: next.people,
        }
      : null,
  };
}

export async function replaceReminderRecipients(emails: string[]) {
  const allowed = new Set((await listReminderPeople()).map((person) => person.email));
  const next = [...new Set(emails.map((email) => email.trim().toLowerCase()))];
  const unknown = next.filter((email) => !allowed.has(email));
  if (unknown.length) {
    throw new Error("Those addresses are not on the roster");
  }
  await prisma.$transaction(async (tx) => {
    await tx.birthdayReminderRecipient.deleteMany();
    if (next.length) {
      await tx.birthdayReminderRecipient.createMany({ data: next.map((email) => ({ email })) });
    }
  });
}

type MailMessage = { subject: string; text: string; html: string };

async function sendEmail(to: string, message: MailMessage, idempotencyKey: string) {
  const config = mailConfig();
  if (!config.ready) throw new Error("Set RESEND_API_KEY and RESEND_FROM before sending");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    throw new Error(body.message || `Resend returned ${res.status}`);
  }
}

async function recordStatus(patch: { lastError?: string; lastSentAt?: Date }) {
  await prisma.birthdayReminderStatus.upsert({
    where: { id: "status" },
    create: { id: "status", lastError: patch.lastError ?? "", lastSentAt: patch.lastSentAt },
    update: patch,
  });
}

let running = false;
let warned = false;

export async function deliverBirthdayReminders(now = new Date()) {
  if (running) return;
  running = true;
  try {
    await deliverOnce(now);
  } catch (err) {
    console.error("Birthday reminders failed", err);
  } finally {
    running = false;
  }
}

async function deliverOnce(now: Date) {
  if (!mailConfig().ready) {
    if (!warned) {
      console.warn("Birthday reminders are off until RESEND_API_KEY and RESEND_FROM are set.");
      warned = true;
    }
    return;
  }

  const clock = pacificNow(now);
  if (clock.hour < REMINDER_HOUR) return;

  const subjects = await birthdaySubjects();
  const due = upcomingReminders(clock, subjects, 1)[0];
  if (!due?.due) return;

  const allowed = new Set((await listReminderPeople()).map((person) => person.email));
  const recipients = (await prisma.birthdayReminderRecipient.findMany())
    .map((row) => row.email)
    .filter((email) => allowed.has(email));
  if (!recipients.length) return;

  const occurrence = isoDate(due.birthday);
  const message = reminderMessage(formatCalendarDate(due.birthday), due.people);
  const errors: string[] = [];
  let sent = 0;

  for (const email of recipients) {
    const existing = await prisma.birthdayReminderSend.findUnique({
      where: { email_occurrence: { email, occurrence } },
    });
    if (existing) continue;
    const key = `birthday-${occurrence}-${email}`.replace(/[^a-zA-Z0-9_-]/g, "-");
    try {
      await sendEmail(email, message, key);
      await prisma.birthdayReminderSend.create({ data: { email, occurrence } });
      sent += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Send failed";
      if (reason.includes("Unique constraint")) continue;
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      errors.push(`${email}: ${reason}`);
    }
  }

  if (sent) {
    console.log(`Birthday reminders sent to ${sent} ${sent === 1 ? "person" : "people"} for ${occurrence}`);
  }
  if (errors.length) {
    await recordStatus({ lastError: errors.join("\n"), ...(sent ? { lastSentAt: now } : {}) });
    console.error("Birthday reminder errors\n" + errors.join("\n"));
    return;
  }
  if (sent) await recordStatus({ lastError: "", lastSentAt: now });
}

export async function sendTestReminder(to: string) {
  const subjects = await birthdaySubjects();
  const next = upcomingReminders(pacificNow(), subjects, 1)[0];
  const message = next
    ? reminderMessage(formatCalendarDate(next.birthday), next.people)
    : {
        subject: "Branner birthday reminder test",
        text: "This is a test of Branner birthday reminders. Checked people get an email like this at 10:00 AM Pacific the day before a birthday.",
        html: "<p>This is a test of Branner birthday reminders. Checked people get an email like this at 10:00 AM Pacific the day before a birthday.</p>",
      };
  const prefixed = {
    subject: `Test: ${message.subject}`,
    text: `This is a test. The real email goes to the people checked in Settings.\n\n${message.text}`,
    html: `<p>This is a test. The real email goes to the people checked in Settings.</p>${message.html}`,
  };
  await sendEmail(to, prefixed, `birthday-test-${Date.now()}`);
}

export function startBirthdayReminders() {
  const tick = () => {
    void deliverBirthdayReminders();
  };
  tick();
  const timer = setInterval(tick, TICK_MS);
  timer.unref?.();
}
