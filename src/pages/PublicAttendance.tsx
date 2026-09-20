import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { FormSchema } from "../lib/types";
import { FormRenderer } from "../components/FormRenderer";
import { haversineMeters } from "../lib/geo";
import { useAuth } from "../context/AuthContext";

type PublicEvent = {
  id: string;
  title: string;
  requireLogin: boolean;
  locationTracking: boolean;
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
  slug: string;
  formSchema: FormSchema;
  eventType?: { label: string };
};

type Identity = {
  email: string;
  name: string;
  resident: {
    id: string;
    firstName: string;
    lastName: string;
    room: string;
    hall: string;
    photoPath?: string | null;
  } | null;
};

type Gps = { lat: number; lng: number; accuracy?: number };
type LocState = "off" | "prompt" | "locating" | "inside" | "outside" | "denied";

export function PublicAttendance() {
  const { slug } = useParams();
  const { googleEnabled, refresh } = useAuth();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [allowDevLogin, setAllowDevLogin] = useState(false);
  const [gps, setGps] = useState<Gps | null>(null);
  const [loc, setLoc] = useState<LocState>("off");
  const [distance, setDistance] = useState<number | null>(null);
  const [ask, setAsk] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [devEmail, setDevEmail] = useState("");
  const watchRef = useRef<number | null>(null);

  const load = async () => {
    const data = await api<{
      event: PublicEvent;
      identity: Identity | null;
      googleEnabled: boolean;
      allowDevLogin: boolean;
    }>(`/api/public/events/${slug}`);
    setEvent(data.event);
    setIdentity(data.identity);
    setAllowDevLogin(data.allowDevLogin);
    if (data.event.locationTracking) {
      setLoc((prev) => (prev === "inside" || prev === "outside" ? prev : "prompt"));
      setAsk(true);
    } else {
      setLoc("off");
    }
  };

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [slug]);

  const startWatch = () => {
    if (!event?.locationTracking || event.lat == null || event.lng == null) return;
    setAsk(false);
    setLoc("locating");
    if (!("geolocation" in navigator)) {
      setLoc("denied");
      return;
    }
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setGps(next);
        const d = haversineMeters(next.lat, next.lng, event.lat!, event.lng!);
        setDistance(d);
        setLoc(d <= event.radiusMeters ? "inside" : "outside");
      },
      () => setLoc("denied"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  };

  const identified = Boolean(identity?.resident);
  const canSubmit = useMemo(() => {
    if (!event) return false;
    if (!identified) return false;
    if (event.locationTracking && loc !== "inside") return false;
    return true;
  }, [event, identified, loc]);

  const submit = async (responseData: Record<string, unknown>) => {
    if (!event) return;
    setSubmitting(true);
    setError("");
    try {
      await api(`/api/public/events/${event.slug}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: responseData,
          responseData,
          gps,
          lat: gps?.lat,
          lng: gps?.lng,
          accuracy: gps?.accuracy,
        }),
      });
      setDone("You're checked in.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onIdentify = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api("/api/auth/identify", {
        method: "POST",
        body: JSON.stringify({ email: devEmail }),
      });
      await refresh();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const bar = statusBar({ event, identified, loc, distance });

  if (!event) {
    return <div className="p-10 text-center text-stone-mute">{error || "Loading…"}</div>;
  }

  const next = `/a/${event.slug}`;

  return (
    <div className="min-h-screen bg-stone-sand">
      <div className={`${bar.bg} px-4 py-3 text-center text-sm font-medium text-white`}>
        {bar.text}
        {loc === "denied" && event.locationTracking && (
          <button type="button" className="ml-3 underline" onClick={() => setAsk(true)}>
            Try again
          </button>
        )}
      </div>
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cardinal">Branner</p>
        <h1 className="mt-1 font-display text-3xl">{event.title}</h1>
        <p className="text-sm text-stone-mute">{event.eventType?.label ?? "House meeting"}</p>

        {!identified && (
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm">Sign in with Stanford so we know who you are. You cannot pick a name.</p>
            {googleEnabled ? (
              <a
                href={`/api/auth/google?next=${encodeURIComponent(next)}`
                }
                className="mt-4 block rounded-lg bg-cardinal py-2 text-center text-sm font-semibold text-white"
              >
                Sign in with Stanford
              </a>
            ) : (
              <p className="mt-3 text-xs text-stone-mute">
                Google OAuth is not configured on this server yet. Use your roster @stanford.edu email.
              </p>
            )}
            {allowDevLogin && (
              <form className="mt-4 space-y-2" onSubmit={onIdentify}>
                <input
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  placeholder="sunet@stanford.edu"
                  type="email"
                  required
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                />
                <button className="w-full rounded-lg bg-cardinal py-2 text-sm font-semibold text-white">
                  Continue with Stanford email
                </button>
              </form>
            )}
          </div>
        )}

        {identity && !identity.resident && (
          <p className="mt-6 rounded-2xl bg-white p-5 text-sm text-cardinal shadow-sm">
            {identity.email} is not on the Branner roster.
          </p>
        )}

        {identity?.resident && (
          <p className="mt-6 rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
            Checking in as <strong>{identity.name}</strong> · Room {identity.resident.room}
          </p>
        )}

        {done ? (
          <p className="mt-8 rounded-2xl bg-emerald-50 p-6 text-center font-medium text-emerald-800">{done}</p>
        ) : (
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <FormRenderer
              schema={event.formSchema}
              onSubmit={submit}
              submitting={submitting}
              disabled={!canSubmit}
              submitLabel="Check in"
            />
            {error && <p className="mt-3 text-sm text-cardinal">{error}</p>}
          </div>
        )}
      </div>

      {ask && event.locationTracking && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="font-display text-xl">Use your location?</h2>
            <p className="mt-2 text-sm text-stone-mute">
              We need GPS to confirm you are at this event. You cannot type or edit a location.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm"
                onClick={() => {
                  setAsk(false);
                  setLoc("denied");
                }}
              >
                Not now
              </button>
              <button
                type="button"
                className="rounded-lg bg-cardinal px-4 py-2 text-sm font-semibold text-white"
                onClick={startWatch}
              >
                Allow location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function statusBar({
  event,
  identified,
  loc,
  distance,
}: {
  event: PublicEvent | null;
  identified: boolean;
  loc: LocState;
  distance: number | null;
}) {
  if (!identified) {
    return { bg: "bg-red-700", text: "Sign in with Stanford — you cannot submit yet" };
  }
  if (!event?.locationTracking) {
    return { bg: "bg-emerald-700", text: "You're signed in — you can submit" };
  }
  if (loc === "inside") {
    return { bg: "bg-emerald-600", text: "You're in the right place — you can submit" };
  }
  if (loc === "outside") {
    return {
      bg: "bg-red-600",
      text: `Too far (${Math.round(distance ?? 0)} m) — you cannot submit`,
    };
  }
  if (loc === "locating") {
    return { bg: "bg-amber-500", text: "Getting your location — you cannot submit yet" };
  }
  if (loc === "denied") {
    return { bg: "bg-red-700", text: "Location blocked — you cannot submit" };
  }
  return { bg: "bg-amber-600", text: "Allow location — you cannot submit yet" };
}
