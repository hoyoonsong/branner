import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  ageOn,
  birthdayFor,
  birthdayHasPassed,
  daysUntilBirthday,
  formatBirthday,
  formatCountdown,
  isBirthdayToday,
  monthDayKey,
  nextBirthdayDate,
  parseBirthday,
} from "../lib/birthday";
import { isRa, type Resident } from "../lib/types";
import { clsx, fullName, personSearchHay } from "../lib/utils";
import { Avatar, RaBadge } from "./Residents";

type BirthdayRow = {
  resident: Resident;
  birthday: NonNullable<ReturnType<typeof parseBirthday>>;
  today: boolean;
  past: boolean;
  age: number;
  days: number;
};

export function Birthdays() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    api<{ residents: Resident[] }>("/api/residents")
      .then((d) => setResidents(d.residents))
      .catch(console.error);
  }, []);

  const today = useMemo(() => new Date(), []);
  const rows = useMemo(() => {
    return residents.flatMap((resident) => {
      const parsed = parseBirthday(birthdayFor(resident));
      if (!parsed) return [];
      return [
        {
          resident,
          birthday: parsed,
          today: isBirthdayToday(parsed, today),
          past: birthdayHasPassed(parsed, today),
          age: ageOn(parsed, today),
          days: daysUntilBirthday(parsed, today),
        } satisfies BirthdayRow,
      ];
    });
  }, [residents, today]);

  const filtered = useMemo(() => {
    const needle = personSearchHay([q]);
    if (!needle) return rows;
    return rows.filter(({ resident, birthday }) =>
      personSearchHay([
        resident.firstName,
        resident.lastName,
        resident.legalName,
        resident.email,
        resident.room,
        resident.hall,
        formatBirthday(birthday),
      ]).includes(needle),
    );
  }, [q, rows]);

  const nextKey = useMemo(() => {
    if (!filtered.length) return null;
    return Math.min(...filtered.map((row) => row.days));
  }, [filtered]);
  const featured = useMemo(
    () =>
      nextKey == null
        ? []
        : filtered
            .filter((row) => row.days === nextKey)
            .sort((a, b) =>
              fullName(a.resident).localeCompare(fullName(b.resident)),
            ),
    [filtered, nextKey],
  );
  const featuredIds = useMemo(
    () => new Set(featured.map((row) => row.resident.id)),
    [featured],
  );

  const later = useMemo(
    () =>
      filtered
        .filter((row) => !row.past && !featuredIds.has(row.resident.id))
        .sort(
          (a, b) =>
            a.days - b.days ||
            monthDayKey(a.birthday) - monthDayKey(b.birthday),
        ),
    [filtered, featuredIds],
  );
  const past = useMemo(
    () =>
      filtered
        .filter((row) => row.past && !featuredIds.has(row.resident.id))
        .sort((a, b) => monthDayKey(b.birthday) - monthDayKey(a.birthday)),
    [filtered, featuredIds],
  );
  const pastByMonth = useMemo(() => groupByMonth(past, today), [past, today]);
  const missing = residents.length - rows.length;
  const searching = Boolean(q.trim());

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Birthdays</h1>
          <p className="mt-1 text-sm text-stone-mute">
            {missing > 0
              ? `${missing} ${missing === 1 ? "person has" : "people have"} no birthday on file.`
              : "Who’s up next, then the rest of the year."}
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, hall, date…"
          className="w-full max-w-sm rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
        />
      </div>

      {featured.length > 0 && <NextHero rows={featured} today={today} />}

      <section className="mt-10">
        <SectionHead title="Later this year" count={later.length} />
        {later.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-white px-4 py-5 text-sm text-stone-mute shadow-sm">
            {searching
              ? "No other matching upcoming birthdays."
              : "No more birthdays after this one."}
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-black/5 overflow-hidden rounded-2xl bg-white shadow-sm">
            {later.map((row) => (
              <UpcomingRow key={row.resident.id} row={row} today={today} />
            ))}
          </ol>
        )}
      </section>

      <section className="mt-10">
        <SectionHead title="Already happened" count={past.length} />
        {past.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-white px-4 py-5 text-sm text-stone-mute shadow-sm">
            {searching
              ? "No matching past birthdays."
              : "No past birthdays yet this year."}
          </p>
        ) : (
          <div className="mt-3 space-y-6">
            {pastByMonth.map(([month, monthRows]) => (
              <div key={month}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-mute">
                  {month}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {monthRows.map((row) => (
                    <PastCard key={row.resident.id} row={row} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function NextHero({ rows, today }: { rows: BirthdayRow[]; today: Date }) {
  const first = rows[0];
  const when = nextBirthdayDate(first.birthday, today);
  const dateLabel = when.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const countdown = formatCountdown(first.days);
  const one = rows.length === 1;

  return (
    <section className="mt-6 overflow-hidden rounded-[28px] bg-cardinal text-white shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
          {first.today ? "Birthday today" : "Next birthday"}
        </p>
        <p className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
          {countdown}
        </p>
      </div>
      <div className="px-6 pb-2 pt-3 sm:px-8">
        <p className="font-display text-4xl leading-tight sm:text-5xl">
          {dateLabel}
        </p>
      </div>
      {one ? (
        <Link
          to={`/residents/${first.resident.id}`}
          className="mt-4 flex items-center gap-5 px-6 pb-7 hover:bg-white/5 sm:px-8"
        >
          <Avatar resident={first.resident} size={112} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-display text-3xl leading-tight">
              {fullName(first.resident)}
              {isRa(first.resident) && <RaBadge />}
            </p>

            <p className="mt-1 text-sm text-white/65">
              {first.resident.room} · {first.resident.hall}
            </p>
          </div>
        </Link>
      ) : (
        <div className="mt-4 grid gap-3 px-6 pb-7 sm:grid-cols-2 sm:px-8">
          {rows.map((row) => (
            <Link
              key={row.resident.id}
              to={`/residents/${row.resident.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-3 hover:bg-white/15"
            >
              <Avatar resident={row.resident} size={64} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {fullName(row.resident)}
                  {isRa(row.resident) && <RaBadge />}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function UpcomingRow({ row, today }: { row: BirthdayRow; today: Date }) {
  const when = nextBirthdayDate(row.birthday, today);
  return (
    <li>
      <Link
        to={`/residents/${row.resident.id}`}
        className="flex items-center gap-4 px-4 py-3 hover:bg-stone-sand/80"
      >
        <div className="w-16 shrink-0 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cardinal">
            {when.toLocaleDateString(undefined, { month: "short" })}
          </p>
          <p className="font-display text-2xl leading-none">{when.getDate()}</p>
        </div>
        <Avatar resident={row.resident} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {fullName(row.resident)}
            {isRa(row.resident) && <RaBadge />}
          </p>
        </div>
        <p className="shrink-0 text-xs font-medium text-stone-mute">
          {formatCountdown(row.days)}
        </p>
      </Link>
    </li>
  );
}

function PastCard({ row }: { row: BirthdayRow }) {
  return (
    <Link
      to={`/residents/${row.resident.id}`}
      className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm hover:shadow"
    >
      <Avatar resident={row.resident} size={40} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {fullName(row.resident)}
          {isRa(row.resident) && <RaBadge />}
        </p>
        <p className="text-xs text-stone-mute">
          {formatBirthday(row.birthday, false)} · turned {row.age}
        </p>
      </div>
    </Link>
  );
}

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-mute">
        {count}
      </p>
    </div>
  );
}

function turningAge(row: BirthdayRow): number {
  return row.today ? row.age : row.age + 1;
}

function groupByMonth(
  rows: BirthdayRow[],
  today: Date,
): [string, BirthdayRow[]][] {
  const groups = new Map<string, BirthdayRow[]>();
  for (const row of rows) {
    const label = nextBirthdayDate(row.birthday, today).toLocaleDateString(
      undefined,
      {
        month: "long",
      },
    );
    const list = groups.get(label) ?? [];
    list.push(row);
    groups.set(label, list);
  }
  return [...groups.entries()];
}
