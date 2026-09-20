import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { AttendanceEvent, EventType, FormSchema } from "../lib/types";
import { formatWhen } from "../lib/utils";
import { BRANNER_LAT, BRANNER_LNG } from "../lib/geo";
import { FormBuilderModal } from "../components/FormBuilderModal";
import { EventLocationMap } from "../components/EventLocationMap";

const defaultSchema: FormSchema = {
  fields: [
    {
      id: "notes",
      type: "textarea",
      label: "Anything we should know?",
      required: false,
      placeholder: "Optional",
    },
  ],
};

export function Attendance() {
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [types, setTypes] = useState<EventType[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [e, t] = await Promise.all([
      api<{ events: AttendanceEvent[] }>("/api/events"),
      api<{ types: EventType[] }>("/api/events/types"),
    ]);
    setEvents(e.events);
    setTypes(t.types);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Attendance</h1>
          <p className="text-sm text-stone-mute">Create a check-in, share the QR, watch who is here.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-cardinal px-4 py-2 text-sm font-semibold text-white"
        >
          New event
        </button>
      </div>
      <div className="mt-6 space-y-3">
        {events.map((ev) => (
          <Link
            key={ev.id}
            to={`/attendance/${ev.id}`}
            className="block rounded-2xl bg-white px-5 py-4 shadow-sm hover:shadow"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{ev.title}</p>
                <p className="text-sm text-stone-mute">
                  {ev.eventType?.label} · {formatWhen(ev.startsAt)}
                </p>
              </div>
              <p className="text-sm text-stone-mute">{ev._count?.submissions ?? 0} present</p>
            </div>
          </Link>
        ))}
        {events.length === 0 && (
          <p className="rounded-2xl border border-dashed border-black/10 p-8 text-center text-stone-mute">
            No events yet.
          </p>
        )}
      </div>
      {open && (
        <NewEventModal
          types={types}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            load().catch(console.error);
          }}
          onTypes={load}
        />
      )}
    </div>
  );
}

function NewEventModal({
  types,
  onClose,
  onCreated,
  onTypes,
}: {
  types: EventType[];
  onClose: () => void;
  onCreated: () => void;
  onTypes: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [eventTypeId, setEventTypeId] = useState(types[0]?.id ?? "");
  const [newType, setNewType] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [requireLogin, setRequireLogin] = useState(true);
  const [locationTracking, setLocationTracking] = useState(true);
  const [lat, setLat] = useState(BRANNER_LAT);
  const [lng, setLng] = useState(BRANNER_LNG);
  const [radiusMeters, setRadiusMeters] = useState(80);
  const [schema, setSchema] = useState<FormSchema>(defaultSchema);
  const [builder, setBuilder] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventTypeId && types[0]) setEventTypeId(types[0].id);
  }, [types, eventTypeId]);

  const addType = async () => {
    if (!newType.trim()) return;
    const { type } = await api<{ type: EventType }>("/api/events/types", {
      method: "POST",
      body: JSON.stringify({ label: newType.trim() }),
    });
    setNewType("");
    setEventTypeId(type.id);
    await onTypes();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api("/api/events", {
        method: "POST",
        body: JSON.stringify({
          title,
          eventTypeId,
          startsAt: startsAt || new Date().toISOString(),
          requireLogin,
          locationTracking,
          lat,
          lng,
          radiusMeters,
          formSchema: schema,
        }),
      });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="font-display text-2xl">New event</h2>
        <label className="mt-4 block text-sm font-medium">Name</label>
        <input className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="mt-4 block text-sm font-medium">Type</label>
        <select className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm" value={eventTypeId} onChange={(e) => setEventTypeId(e.target.value)}>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm"
            placeholder="Add a new type…"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
          />
          <button type="button" onClick={addType} className="rounded-lg border border-black/10 px-3 text-sm">
            Add
          </button>
        </div>
        <label className="mt-4 block text-sm font-medium">Starts</label>
        <input
          type="datetime-local"
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={requireLogin}
            onChange={(e) => setRequireLogin(e.target.checked)}
          />
          <span>
            Require Stanford login to verify identity
            <span className="block text-xs text-stone-mute">
              Off: no Stanford login. Respondents type their first and last name.
            </span>
          </span>
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={locationTracking} onChange={(e) => setLocationTracking(e.target.checked)} />
          Location tracking (must be in range to submit)
        </label>
        {locationTracking && (
          <>
            <EventLocationMap
              lat={lat}
              lng={lng}
              radiusMeters={radiusMeters}
              onChange={(a, b) => {
                setLat(a);
                setLng(b);
              }}
              onRadiusChange={setRadiusMeters}
            />
          </>
        )}
        <button
          type="button"
          onClick={() => setBuilder(true)}
          className="mt-5 w-full rounded-lg border border-cardinal/30 bg-cardinal/5 py-2 text-sm font-medium text-cardinal"
        >
          Customize form
        </button>
        {error && <p className="mt-3 text-sm text-cardinal">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-cardinal px-4 py-2 text-sm font-semibold text-white">
            Create
          </button>
        </div>
      </form>
      {builder && (
        <FormBuilderModal
          schema={schema}
          title={title || "Untitled form"}
          requireLogin={requireLogin}
          status="draft"
          onChange={setSchema}
          onMetaChange={(meta) => {
            setTitle(meta.title);
            setRequireLogin(meta.requireLogin);
          }}
          onClose={() => setBuilder(false)}
        />
      )}
    </div>
  );
}
