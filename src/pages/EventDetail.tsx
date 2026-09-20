import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../lib/api";
import type { AttendanceEvent, FormSchema, Resident } from "../lib/types";
import { formatWhen, fullName } from "../lib/utils";
import { FormBuilderModal } from "../components/FormBuilderModal";
import { EventLocationMap } from "../components/EventLocationMap";
import { BRANNER_LAT, BRANNER_LNG } from "../lib/geo";
import { Avatar } from "./Residents";

type SubmissionRow = {
  id: string;
  createdAt: string;
  distanceM: number | null;
  resident: Resident;
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

      <section className="mt-8">
        <h2 className="font-display text-xl">Present</h2>
        <div className="mt-3 divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
          {submissions.map((s) => (
            <Link key={s.id} to={`/residents/${s.resident.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-sand">
              <Avatar resident={s.resident} />
              <div className="flex-1">
                <p className="font-medium">{fullName(s.resident)}</p>
                <p className="text-xs text-stone-mute">
                  {s.resident.room} · {s.resident.hall}
                </p>
              </div>
              {s.distanceM != null && (
                <span className="text-xs text-stone-mute">{Math.round(s.distanceM)} m</span>
              )}
            </Link>
          ))}
          {submissions.length === 0 && <p className="p-4 text-sm text-stone-mute">No check-ins yet.</p>}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl">Not yet here</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {absent.map((r) => (
            <Link key={r.id} to={`/residents/${r.id}`} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-sm">
              <Avatar resident={r} size={36} />
              <span className="text-sm">
                {fullName(r)} · {r.room}
              </span>
            </Link>
          ))}
        </div>
      </section>

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
