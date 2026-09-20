import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../lib/api";
import { isRa, type AttendanceEvent, type FormSchema, type Resident } from "../lib/types";
import { clsx, formatCheckIn, formatWhen, fullName, personSearchHay } from "../lib/utils";
import { FormBuilderModal } from "../components/FormBuilderModal";
import { EventLocationMap } from "../components/EventLocationMap";
import { BRANNER_LAT, BRANNER_LNG } from "../lib/geo";
import { Avatar, RaBadge } from "./Residents";

type SubmissionRow = {
  id: string;
  createdAt: string;
  distanceM: number | null;
  accuracy: number | null;
  guestName: string | null;
  responseData: Record<string, unknown>;
  resident: Resident | null;
};

export function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState<AttendanceEvent | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [absent, setAbsent] = useState<Resident[]>([]);
  const [analytics, setAnalytics] = useState<{
    present: number;
    expected: number;
    absent: number;
    byHall: Record<string, { present: number; expected: number }>;
  } | null>(null);
  const [builder, setBuilder] = useState(false);
  const [peopleQ, setPeopleQ] = useState("");
  const [list, setList] = useState<"all" | "present" | "absent">("all");

  const load = async () => {
    if (!id) return;
    const data = await api<{
      event: AttendanceEvent;
      submissions: SubmissionRow[];
      absent: Resident[];
      analytics: NonNullable<typeof analytics>;
    }>(`/api/events/${id}`);
    setEvent(data.event);
    setSubmissions(data.submissions);
    setAbsent(data.absent);
    setAnalytics(data.analytics);
  };

  useEffect(() => {
    load().catch(console.error);
    const t = setInterval(() => load().catch(() => undefined), 8000);
    return () => clearInterval(t);
  }, [id]);

  const shareUrl = useMemo(() => {
    if (!event) return "";
    return `${window.location.origin}/a/${event.slug}`;
  }, [event]);

  if (!event || !analytics) return <p className="text-stone-mute">Loading…</p>;

  const saveSchema = async (formSchema: FormSchema) => {
    await api(`/api/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ formSchema }),
    });
    setEvent({ ...event, formSchema });
  };

  return (
    <div>
      <Link to="/attendance" className="text-sm text-cardinal">
        ← Attendance
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">{event.title}</h1>
          <p className="text-stone-mute">
            {event.eventType?.label} · {formatWhen(event.startsAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setBuilder(true)}
          className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm"
        >
          Edit form
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Present" value={analytics.present} />
          <Stat label="Expected" value={analytics.expected} />
          <Stat label="Absent" value={analytics.absent} />
        </div>
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
          {shareUrl && <QRCodeSVG value={shareUrl} size={140} className="mx-auto" />}
          <a href={shareUrl} className="mt-2 block break-all text-xs text-cardinal">
            {shareUrl}
          </a>
        </div>
      </div>

      {event.locationTracking && (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl">Check-in area</h2>
          <p className="text-sm text-stone-mute">
            Residents must be inside this circle to submit. Search a place, use your location, or drag the pin and radius handle.
          </p>
          <EventLocationEditor
            eventId={event.id}
            lat={event.lat ?? BRANNER_LAT}
            lng={event.lng ?? BRANNER_LNG}
            radiusMeters={event.radiusMeters}
            onSaved={(next) => setEvent({ ...event, ...next })}
          />
        </section>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {Object.entries(analytics.byHall).map(([hall, v]) => (
          <div key={hall} className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
            <p className="font-medium">{hall}</p>
            <p className="text-stone-mute">
              {v.present} / {v.expected}
            </p>
          </div>
        ))}
      </div>

      <PeopleLists
        event={event}
        submissions={submissions}
        absent={absent}
        query={peopleQ}
        onQuery={setPeopleQ}
        list={list}
        onList={setList}
      />

      {builder && (
        <FormBuilderModal
          schema={event.formSchema}
          title={event.title}
          requireLogin={event.requireLogin}
          shareUrl={shareUrl}
          status="published"
          submissions={submissions}
          onChange={(schema) => setEvent({ ...event, formSchema: schema })}
          onSave={saveSchema}
          onMetaChange={async (meta) => {
            await api(`/api/events/${event.id}`, {
              method: "PATCH",
              body: JSON.stringify({ title: meta.title, requireLogin: meta.requireLogin }),
            });
            setEvent({ ...event, title: meta.title, requireLogin: meta.requireLogin });
          }}
          onClose={() => {
            saveSchema(event.formSchema).catch(console.error);
            setBuilder(false);
          }}
        />
      )}
    </div>
  );
}

function PeopleLists({
  event,
  submissions,
  absent,
  query,
  onQuery,
  list,
  onList,
}: {
  event: AttendanceEvent;
  submissions: SubmissionRow[];
  absent: Resident[];
  query: string;
  onQuery: (q: string) => void;
  list: "all" | "present" | "absent";
  onList: (v: "all" | "present" | "absent") => void;
}) {
  const q = personSearchHay([query]);
  const present = useMemo(() => {
    const rows = [...submissions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (!q) return rows;
    return rows.filter((s) =>
      personSearchHay([
        s.guestName,
        s.resident?.firstName,
        s.resident?.lastName,
        s.resident?.legalName,
        s.resident?.email,
        s.resident?.room,
        s.resident?.bedSlot,
        s.resident?.hall,
        s.resident?.phone,
        s.resident?.type,
        JSON.stringify(s.responseData ?? {}),
      ]).includes(q),
    );
  }, [submissions, q]);
  const missing = useMemo(() => {
    const rows = [...absent].sort((a, b) => Number(isRa(b)) - Number(isRa(a)));
    if (!q) return rows;
    return rows.filter((r) =>
      personSearchHay([
        r.firstName,
        r.lastName,
        r.legalName,
        r.email,
        r.room,
        r.bedSlot,
        r.hall,
        r.phone,
        r.type,
        r.hometown,
      ]).includes(q),
    );
  }, [absent, q]);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Who is here</h2>
          <p className="text-sm text-stone-mute">
            Search names, rooms, halls, emails, or form answers. Check-in times update live.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search present or not here…"
          className="w-full max-w-sm rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["all", `All (${present.length + missing.length})`],
            ["present", `Present (${present.length})`],
            ["absent", `Not here (${missing.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onList(key)}
            className={clsx(
              "rounded-full px-3 py-1 text-sm font-medium",
              list === key ? "bg-cardinal text-white" : "bg-white text-stone-mute shadow-sm",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {(list === "all" || list === "present") && (
        <section className="mt-6">
          <h3 className="font-display text-lg">Present</h3>
          <div className="mt-3 divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
            {present.map((s) => (
              <PresentRow key={s.id} submission={s} schema={event.formSchema} />
            ))}
            {present.length === 0 && (
              <p className="p-4 text-sm text-stone-mute">
                {q ? "No matching check-ins." : "No check-ins yet."}
              </p>
            )}
          </div>
        </section>
      )}

      {(list === "all" || list === "absent") && (
        <section className="mt-8">
          <h3 className="font-display text-lg">Not yet here</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {missing.map((r) => (
              <Link
                key={r.id}
                to={`/residents/${r.id}`}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2 shadow-sm",
                  isRa(r) ? "bg-amber-50 ring-1 ring-amber-300" : "bg-white",
                )}
              >
                <Avatar resident={r} size={36} />
                <span className="min-w-0 text-sm">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {fullName(r)}
                    {isRa(r) && <RaBadge />}
                  </span>
                  <span className="block text-xs text-stone-mute">
                    {r.room} · {r.hall}
                    {r.email ? ` · ${r.email}` : ""}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          {missing.length === 0 && (
            <p className="mt-3 text-sm text-stone-mute">
              {q ? "No matching people still out." : "Everyone on the roster is here."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function PresentRow({
  submission: s,
  schema,
}: {
  submission: SubmissionRow;
  schema: FormSchema;
}) {
  const resident = s.resident;
  const name = resident ? fullName(resident) : s.guestName || "Guest";
  const answers = formatAnswers(schema, s.responseData);
  const inner = (
    <>
      {resident ? (
        <Avatar resident={resident} />
      ) : (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-stone-200 text-sm font-semibold text-stone-mute">
          {(s.guestName ?? "?")
            .split(" ")
            .map((p) => p[0])
            .join("")
            .slice(0, 2)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {name}
          {isRa(resident) && <RaBadge />}
          {!resident && (
            <span className="rounded-full bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-mute">
              Guest
            </span>
          )}
        </p>
        <p className="text-xs text-stone-mute">
          {resident
            ? [resident.room, resident.hall, resident.email].filter(Boolean).join(" · ")
            : "Name written at check-in — not matched to the roster"}
        </p>
        {answers.length > 0 && (
          <p className="mt-1 line-clamp-2 text-xs text-stone-mute">{answers.join(" · ")}</p>
        )}
      </div>
      <div className="shrink-0 text-right text-xs text-stone-mute">
        <p>{formatCheckIn(s.createdAt)}</p>
        {s.distanceM != null && <p>{Math.round(s.distanceM)} m away</p>}
        {s.accuracy != null && <p>±{Math.round(s.accuracy)} m GPS</p>}
      </div>
    </>
  );

  const cls = clsx(
    "flex items-center gap-3 px-4 py-3",
    isRa(resident) && "bg-amber-50/80",
    resident && "hover:bg-stone-sand",
  );

  if (resident) {
    return (
      <Link to={`/residents/${resident.id}`} className={cls}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function formatAnswers(schema: FormSchema, data: Record<string, unknown> | null | undefined): string[] {
  if (!data) return [];
  return (schema.fields ?? [])
    .map((field) => {
      const value = data[field.id];
      if (value == null || value === "" || value === false) return null;
      const shown = Array.isArray(value) ? value.filter(Boolean).join(", ") : String(value);
      if (!shown.trim()) return null;
      return `${field.label}: ${shown}`;
    })
    .filter((v): v is string => Boolean(v));
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-stone-mute">{label}</p>
      <p className="font-display text-3xl">{value}</p>
    </div>
  );
}

function EventLocationEditor({
  eventId,
  lat,
  lng,
  radiusMeters,
  onSaved,
}: {
  eventId: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  onSaved: (next: { lat: number; lng: number; radiusMeters: number }) => void;
}) {
  const [center, setCenter] = useState({ lat, lng });
  const [radius, setRadius] = useState(radiusMeters);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | null>(null);
  const latest = useRef({ lat, lng, radius: radiusMeters });
  latest.current = { lat: center.lat, lng: center.lng, radius };

  const persist = async (nextLat: number, nextLng: number, nextRadius: number) => {
    setSaving(true);
    try {
      await api(`/api/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({ lat: nextLat, lng: nextLng, radiusMeters: nextRadius, locationTracking: true }),
      });
      onSaved({ lat: nextLat, lng: nextLng, radiusMeters: nextRadius });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } finally {
      setSaving(false);
    }
  };

  const persistSoon = (nextLat: number, nextLng: number, nextRadius: number) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      persist(nextLat, nextLng, nextRadius).catch(console.error);
    }, 400);
  };

  return (
    <div>
      <EventLocationMap
        lat={center.lat}
        lng={center.lng}
        radiusMeters={radius}
        onChange={(nextLat, nextLng) => {
          setCenter({ lat: nextLat, lng: nextLng });
          persistSoon(nextLat, nextLng, latest.current.radius);
        }}
        onRadiusChange={(nextRadius) => {
          setRadius(nextRadius);
          persistSoon(latest.current.lat, latest.current.lng, nextRadius);
        }}
      />
      <p className="mt-2 text-xs text-stone-mute">
        {saving ? "Saving…" : saved ? "Saved" : "Changes save as you move the pin or radius."}
      </p>
    </div>
  );
}
