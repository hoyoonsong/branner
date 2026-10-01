import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  ageOn,
  birthdayFor,
  birthdayHasPassed,
  daysUntilBirthday,
  formatBirthday,
  formatCountdown,
  midnightCountdown,
  isBirthdayToday,
  isSummerBirthday,
  nextBirthdayDate,
  parseBirthday,
  schoolYearOrder,
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
  const now = useNow();
  const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  useEffect(() => {
    api<{ residents: Resident[] }>("/api/residents")
      .then((d) => setResidents(d.residents))
      .catch(console.error);
  }, []);

  const rows = useMemo(() => {
    const [year, month, date] = dayKey.split("-").map(Number);
    const today = new Date(year, month, date);
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
  }, [residents, dayKey]);

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

  const todayRows = useMemo(
    () =>
      filtered
        .filter((row) => row.today)
        .sort((a, b) => fullName(a.resident).localeCompare(fullName(b.resident))),
    [filtered],
  );
  const showerRows = useMemo(
    () =>
      filtered
        .filter((row) => row.days === 1)
        .sort((a, b) => fullName(a.resident).localeCompare(fullName(b.resident))),
    [filtered],
  );
  const nextKey = useMemo(() => {
    const upcoming = filtered.filter((row) => !row.past && !row.today && row.days !== 1);
    if (!upcoming.length) return null;
    return Math.min(...upcoming.map((row) => row.days));
  }, [filtered]);
  const featured = useMemo(
    () =>
      todayRows.length || showerRows.length || nextKey == null
        ? []
        : filtered
            .filter((row) => row.days === nextKey)
            .sort((a, b) =>
              fullName(a.resident).localeCompare(fullName(b.resident)),
            ),
    [filtered, nextKey, showerRows.length, todayRows.length],
  );
  const featuredIds = useMemo(
    () =>
      new Set([
        ...todayRows.map((row) => row.resident.id),
        ...showerRows.map((row) => row.resident.id),
        ...featured.map((row) => row.resident.id),
      ]),
    [featured, showerRows, todayRows],
  );

  const later = useMemo(
    () =>
      filtered
        .filter((row) => !row.past && !featuredIds.has(row.resident.id))
        .sort((a, b) => a.days - b.days),
    [filtered, featuredIds],
  );
  const past = useMemo(
    () =>
      filtered
        .filter((row) => row.past && !featuredIds.has(row.resident.id))
        .sort(
          (a, b) =>
            schoolYearOrder(b.birthday.month, b.birthday.day) -
            schoolYearOrder(a.birthday.month, a.birthday.day),
        ),
    [filtered, featuredIds],
  );
  const pastByMonth = useMemo(() => groupByMonth(past), [past]);
  const missing = residents.length - rows.length;
  const searching = Boolean(q.trim());

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Birthdays</h1>
          <p className="mt-1 text-sm text-stone-mute">
            {missing > 0
              ? `${missing} ${missing === 1 ? "person has" : "people have"} no birthday on file.`
              : "Who’s up next, then the rest of the school year."}
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, hall, date…"
          className="w-full max-w-sm rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
        />
      </div>

      {todayRows.length > 0 && <NextHero rows={todayRows} today={now} />}
      {showerRows.length > 0 && (
        <ShowerCountdown rows={showerRows} now={now} prominent={todayRows.length === 0} />
      )}
      {featured.length > 0 && <NextHero rows={featured} today={now} />}

      <section className="mt-10">
        <SectionHead title="Later this school year" count={later.length} />
        {later.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-white px-4 py-5 text-sm text-stone-mute shadow-sm">
            {searching
              ? "No other matching upcoming birthdays."
              : "No more birthdays after this one."}
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-black/5 overflow-hidden rounded-2xl bg-white shadow-sm">
            {later.map((row, index) => {
              const summer = isSummerBirthday(row.birthday.month);
              const previous = later[index - 1];
              const showSummer =
                summer && (!previous || !isSummerBirthday(previous.birthday.month));
              return (
                <Fragment key={row.resident.id}>
                  {showSummer && (
                    <li className="bg-stone-sand px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-mute">
                      Summer
                    </li>
                  )}
                  <UpcomingRow row={row} today={now} />
                </Fragment>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mt-10">
        <SectionHead title="Already this school year" count={past.length} />
        {past.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-white px-4 py-5 text-sm text-stone-mute shadow-sm">
            {searching
              ? "No matching past birthdays."
              : "No birthdays yet since September 15."}
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
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-5 sm:gap-4 sm:px-8 sm:pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
          {first.today ? "Birthday today" : "Next birthday"}
        </p>
        <p className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
          {countdown}
        </p>
      </div>
      <div className="px-4 pb-2 pt-3 sm:px-8">
        <p className="break-words font-display text-3xl leading-tight sm:text-5xl">
          {dateLabel}
        </p>
      </div>
      {one ? (
        <Link
          to={`/residents/${first.resident.id}`}
          className="mt-4 flex items-center gap-3 px-4 pb-6 hover:bg-white/5 sm:gap-5 sm:px-8 sm:pb-7"
        >
          <Avatar resident={first.resident} size={80} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 break-words font-display text-2xl leading-tight sm:text-3xl">
              {fullName(first.resident)}
              {isRa(first.resident) && <RaBadge />}
            </p>

            <p className="mt-1 text-sm text-white/65">
              {first.resident.room} · {first.resident.hall}
            </p>
          </div>
        </Link>
      ) : (
        <div className="mt-4 grid gap-3 px-4 pb-6 sm:grid-cols-2 sm:px-8 sm:pb-7">
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

function ShowerCountdown({
  rows,
  now,
  prominent,
}: {
  rows: BirthdayRow[];
  now: Date;
  prominent: boolean;
}) {
  const first = rows[0];
  const when = nextBirthdayDate(first.birthday, now);
  const dateLabel = when.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const countdown = midnightCountdown(now);
  const one = rows.length === 1;

  return (
    <section
      className={clsx(
        "mt-6 overflow-hidden rounded-[28px] shadow-lg",
        prominent ? "bg-cardinal text-white" : "bg-white text-stone-ink ring-1 ring-cardinal/15",
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pt-5 sm:px-8 sm:pt-6">
        <div className="min-w-[12rem] flex-1">
          <p
            className={clsx(
              "text-xs font-semibold uppercase tracking-[0.22em]",
              prominent ? "text-white/70" : "text-cardinal",
            )}
          >
            Birthday shower
          </p>
          <p className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
            {dateLabel}
          </p>
        </div>
        <div className={clsx("shrink-0 text-right", prominent ? "text-white" : "text-cardinal")}>
          <p className="font-display text-4xl leading-none tabular-nums sm:text-5xl">{countdown.clock}</p>
          <p
            className={clsx(
              "mt-1 text-xs font-semibold uppercase tracking-[0.16em]",
              prominent ? "text-white/70" : "text-stone-mute",
            )}
          >
            {countdown.done ? "Midnight" : "Until midnight"}
          </p>
        </div>
      </div>
      {one ? (
        <Link
          to={`/residents/${first.resident.id}`}
          className={clsx(
            "mt-4 flex items-center gap-3 px-4 pb-6 sm:gap-5 sm:px-8 sm:pb-7",
            prominent ? "hover:bg-white/5" : "hover:bg-stone-sand/80",
          )}
        >
          <Avatar resident={first.resident} size={80} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 break-words font-display text-2xl leading-tight sm:text-3xl">
              {fullName(first.resident)}
              {isRa(first.resident) && <RaBadge />}
            </p>
            <p className={clsx("mt-1 text-sm", prominent ? "text-white/65" : "text-stone-mute")}>
              {first.resident.room} · {first.resident.hall}
            </p>
          </div>
        </Link>
      ) : (
        <div className="mt-4 grid gap-3 px-4 pb-6 sm:grid-cols-2 sm:px-8 sm:pb-7">
          {rows.map((row) => (
            <Link
              key={row.resident.id}
              to={`/residents/${row.resident.id}`}
              className={clsx(
                "flex items-center gap-3 rounded-2xl px-3 py-3",
                prominent ? "bg-white/10 hover:bg-white/15" : "bg-stone-sand hover:bg-stone-sand/70",
              )}
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
          {formatBirthday(row.birthday, false)}
          {row.age > 0 ? ` · turned ${row.age}` : ""}
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

function groupByMonth(rows: BirthdayRow[]): [string, BirthdayRow[]][] {
  const groups = new Map<string, BirthdayRow[]>();
  for (const row of rows) {
    const label = new Date(2000, row.birthday.month - 1, 1).toLocaleDateString(undefined, {
      month: "long",
    });
    const list = groups.get(label) ?? [];
    list.push(row);
    groups.set(label, list);
  }
  return [...groups.entries()];
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let id = 0;
    const tick = () => {
      setNow(new Date());
      id = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    id = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    return () => window.clearTimeout(id);
  }, []);
  return now;
}
