import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FormResponseDetail, SheetsConnection } from "../components/FormResponseDetail";
import { api } from "../lib/api";
import { useConnectedForm, type FormResponse } from "../lib/connectedForm";
import { isRa, type Resident } from "../lib/types";
import { clsx, downloadTextFile, fullName, personSearchHay, toCsv } from "../lib/utils";
import { Avatar } from "./Residents";

const FORM_ID = "roommate-agreement";
const HALLS = ["Savannah Bananas", "Banana Treats", "Banana Cartoons", "Banana Republic"];

type Filter = "all" | "missing" | "submitted";

type RoomGroup = {
  room: string;
  hall: string;
  residents: Resident[];
  submitted: boolean;
  response: FormResponse | null;
};

export function RoommateContracts() {
  const { payload, error, loading, reload } = useConnectedForm(FORM_ID);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [q, setQ] = useState("");
  const [hall, setHall] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    api<{ residents: Resident[] }>("/api/residents")
      .then((data) => setResidents(data.residents))
      .catch(console.error);
  }, []);

  const ready = Boolean(payload && !payload.needsConnection && !payload.error && !error);
  const byRoom = useMemo(() => {
    const map = new Map<string, FormResponse>();
    if (!ready || !payload) return map;
    for (const row of payload.responses) map.set(row.matchValue, row);
    return map;
  }, [payload, ready]);

  const rooms = useMemo(() => groupRooms(residents, byRoom), [residents, byRoom]);
  const submittedCount = rooms.filter((room) => room.submitted).length;
  const missingCount = rooms.length - submittedCount;
  const coveredPeople = rooms.filter((room) => room.submitted).reduce((sum, room) => sum + room.residents.length, 0);
  const expectedPeople = rooms.reduce((sum, room) => sum + room.residents.length, 0);

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rooms.filter((room) => {
      if (hall && room.hall !== hall) return false;
      if (filter === "missing" && room.submitted) return false;
      if (filter === "submitted" && !room.submitted) return false;
      if (!query) return true;
      const hay = personSearchHay([
        room.room,
        room.hall,
        room.response?.subtitle,
        room.response?.submitter,
        ...room.residents.flatMap((resident) => [
          resident.firstName,
          resident.lastName,
          resident.legalName,
          resident.email,
        ]),
      ]);
      return hay.includes(personSearchHay([query]));
    });
  }, [rooms, q, hall, filter]);

  const missing = visible.filter((room) => !room.submitted);
  const submitted = visible.filter((room) => room.submitted);
  const exportLabel =
    filter === "missing" ? "Export not submitted" : filter === "submitted" ? "Export submitted" : "Export all";

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl">Roommate contracts</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-mute">
            One agreement covers everyone in a shared room. Responses come from the roommate form, not a saved copy.
            Singles and resident assistants are not included.
          </p>
        </div>
        {ready && (
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="shrink-0 self-start rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </div>

      {loading && !payload && <p className="mt-6 text-sm text-stone-mute">Loading responses…</p>}
      {error && (
        <p className="mt-6 rounded-2xl bg-white p-5 text-sm text-cardinal shadow-sm">
          {/not found/i.test(error)
            ? "This server does not have form connections yet. After the next deploy, connect Google Sheets from this page."
            : `Could not load form responses. ${error}`}
        </p>
      )}
      {payload?.error && (
        <p className="mt-6 rounded-2xl bg-white p-5 text-sm text-cardinal shadow-sm">
          <LinkedNotice text={payload.error} />
        </p>
      )}
      {payload?.needsConnection && (
        <SheetsConnection title={payload.title.toLowerCase()} description={payload.description} />
      )}

      {ready && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Rooms submitted" value={`${submittedCount} of ${rooms.length}`} />
            <Stat label="Rooms missing" value={String(missingCount)} />
            <Stat label="Residents covered" value={`${coveredPeople} of ${expectedPeople}`} />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search name or room"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm sm:w-64"
            />
            <select
              value={hall}
              onChange={(event) => setHall(event.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm sm:w-auto"
            >
              <option value="">All halls</option>
              {HALLS.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <div className="flex overflow-x-auto rounded-lg bg-white p-1 text-sm shadow-sm">
              {(
                [
                  ["all", "All"],
                  ["missing", "Not submitted"],
                  ["submitted", "Submitted"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={clsx(
                    "shrink-0 rounded-md px-3 py-1.5 font-medium",
                    filter === id ? "bg-cardinal text-white" : "text-stone-mute hover:bg-stone-sand",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => exportContracts(visible, filter)}
              disabled={visible.length === 0}
              title="Exports the rooms in the current filter, hall, and search"
              className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {exportLabel}
            </button>
          </div>

          {filter !== "submitted" && (
            <RoomSection title="Not submitted" rooms={missing} empty="Every shared room in this view has submitted." />
          )}
          {filter !== "missing" && (
            <RoomSection title="Submitted" rooms={submitted} empty="No submitted contracts in this view." />
          )}
        </>
      )}
    </div>
  );
}

function exportContracts(rooms: RoomGroup[], filter: Filter) {
  const extra = [...new Set(rooms.flatMap((room) => Object.keys(room.response?.values ?? {})))];
  const headers = ["Status", "Room", "Hall", "First name", "Last name", "Email", "Bed", ...extra];
  const rows = rooms.flatMap((room) =>
    room.residents.map((resident) => [
      room.submitted ? "Submitted" : "Not submitted",
      room.room,
      room.hall,
      resident.firstName,
      resident.lastName,
      resident.email,
      resident.bedSlot,
      ...extra.map((header) => room.response?.values[header] ?? ""),
    ]),
  );
  const slug = filter === "missing" ? "not-submitted" : filter === "submitted" ? "submitted" : "all";
  const stamp = new Date().toISOString().slice(0, 10);
  downloadTextFile(`roommate-contracts-${slug}-${stamp}.csv`, toCsv(headers, rows));
}

function groupRooms(residents: Resident[], byRoom: Map<string, FormResponse>): RoomGroup[] {
  const groups = new Map<string, Resident[]>();
  for (const resident of residents) {
    if (isRa(resident) || !/^\d+$/.test(resident.room)) continue;
    const list = groups.get(resident.room) ?? [];
    list.push(resident);
    groups.set(resident.room, list);
  }
  return [...groups.entries()]
    .flatMap(([room, people]) => {
      if (people.length < 2) return [];
      const response = byRoom.get(room) ?? null;
      return [
        {
          room,
          hall: people[0]?.hall ?? "",
          residents: [...people].sort((a, b) => fullName(a).localeCompare(fullName(b))),
          submitted: Boolean(response),
          response,
        },
      ];
    })
    .sort((a, b) => Number(a.room) - Number(b.room));
}

function RoomSection({ title, rooms, empty }: { title: string; rooms: RoomGroup[]; empty: string }) {
  const byHall = HALLS.map((hall) => ({
    hall,
    rooms: rooms.filter((room) => room.hall === hall),
  })).filter((group) => group.rooms.length > 0);
  const other = rooms.filter((room) => !HALLS.includes(room.hall));

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl">
        {title} <span className="text-base font-normal text-stone-mute">({rooms.length})</span>
      </h2>
      {rooms.length === 0 && <p className="mt-3 text-sm text-stone-mute">{empty}</p>}
      {byHall.map((group) => (
        <HallRooms key={group.hall} hall={group.hall} rooms={group.rooms} />
      ))}
      {other.length > 0 && <HallRooms hall="Other" rooms={other} />}
    </section>
  );
}

function HallRooms({ hall, rooms }: { hall: string; rooms: RoomGroup[] }) {
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-mute">{hall}</h3>
      <div className="mt-2 space-y-3">
        {rooms.map((room) => (
          <RoomCard key={room.room} room={room} />
        ))}
      </div>
    </div>
  );
}

function RoomCard({ room }: { room: RoomGroup }) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl">Room {room.room}</p>
          <p className="text-sm text-stone-mute">
            {room.hall}
            {room.response?.subtitle ? ` · ${room.response.subtitle}` : ""}
          </p>
        </div>
        <span
          className={clsx(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
            room.submitted ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900",
          )}
        >
          {room.submitted ? "Submitted" : "Not submitted"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {room.residents.map((resident) => (
          <Link
            key={resident.id}
            to={`/residents/${resident.id}`}
            className="flex max-w-full items-center gap-2 rounded-full bg-stone-sand py-1 pl-1 pr-3 text-sm hover:bg-black/5"
          >
            <Avatar resident={resident} size={28} />
            <span className="truncate">{fullName(resident)}</span>
          </Link>
        ))}
      </div>
      {room.response && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-cardinal">View agreement</summary>
          <div className="mt-3">
            <FormResponseDetail response={room.response} residents={room.residents} />
          </div>
        </details>
      )}
    </article>
  );
}

function LinkedNotice({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+)/);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("http") ? (
          <a key={index} href={part} target="_blank" rel="noreferrer" className="break-all underline">
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-mute">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}
