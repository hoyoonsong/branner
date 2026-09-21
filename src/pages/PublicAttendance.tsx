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
  oneResponse?: boolean;
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
  slug: string;
  formSchema: FormSchema;
  eventType?: { slug?: string; label: string };
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
    type?: string | null;
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
  const [lateNotice, setLateNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [devEmail, setDevEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const watchRef = useRef<number | null>(null);
  const locAskedRef = useRef(false);

  const rememberDone = (
    slugKey: string,
    first: string,
    last: string,
    message: string,
  ) => {
    sessionStorage.setItem(
      `branner-done:${slugKey}`,
      JSON.stringify({ firstName: first, lastName: last, message }),
    );
    setDone(message);
  };

  const load = async (name?: { firstName: string; lastName: string }) => {
    const first = (name?.firstName ?? firstName).trim();
    const last = (name?.lastName ?? lastName).trim();
    const qs = new URLSearchParams();
    if (first) qs.set("firstName", first);
    if (last) qs.set("lastName", last);
    const suffix = qs.toString() ? `?${qs}` : "";
    const data = await api<{
      event: PublicEvent;
      identity: Identity | null;
      alreadySubmitted?: boolean;
      alreadyAs?: string | null;
      markedLate?: boolean;
      lateAt?: string | null;
      googleEnabled: boolean;
      allowDevLogin: boolean;
    }>(`/api/public/events/${slug}${suffix}`);
    let nextEvent = data.event;
    try {
      const staff = await api<{
        events: {
          id: string;
          slug: string;
          requireLogin: boolean;
          oneResponse?: boolean;
        }[];
      }>("/api/events");
      const match = staff.events.find(
        (e) => e.slug === nextEvent.slug || e.id === nextEvent.id,
      );
      if (match) {
        nextEvent = {
          ...nextEvent,
          requireLogin: match.requireLogin,
          oneResponse: match.oneResponse ?? nextEvent.oneResponse,
        };
      }
    } catch {
      /* visitors are not staff — trust the public payload */
    }
    setEvent(nextEvent);
    setIdentity(data.identity);
    setAllowDevLogin(data.allowDevLogin);
    if (data.markedLate && !data.alreadySubmitted) {
      setLateNotice(
        "You were marked as arriving late. You can still submit, but this will not count as being here for the whole house meeting.",
      );
    } else {
      setLateNotice("");
    }
    if (data.alreadySubmitted) {
      const who =
        data.alreadyAs ||
        (data.identity?.resident
          ? `${data.identity.resident.firstName} ${data.identity.resident.lastName}`
          : `${first} ${last}`.trim());
      rememberDone(
        nextEvent.slug,
        data.identity?.resident?.firstName ?? first,
        data.identity?.resident?.lastName ?? last,
        data.markedLate
          ? `${who} already checked in. You were not here for the whole house meeting.`
          : `${who} already checked in.`,
      );
    } else {
      try {
        const prior = JSON.parse(
          sessionStorage.getItem(`branner-done:${nextEvent.slug}`) || "{}",
        ) as { firstName?: string; lastName?: string };
        const same =
          `${prior.firstName ?? ""} ${prior.lastName ?? ""}`
            .trim()
            .toLowerCase() === `${first} ${last}`.trim().toLowerCase();
        if (!same) setDone("");
      } catch {
        /* keep current done */
      }
    }
  };

  useEffect(() => {
    if (!slug) return;
    let first = "";
    let last = "";
    try {
      const raw = sessionStorage.getItem(`branner-name:${slug}`);
      const saved = raw
        ? (JSON.parse(raw) as { firstName?: string; lastName?: string })
        : {};
      first = saved.firstName ?? "";
      last = saved.lastName ?? "";
      setFirstName(first);
      setLastName(last);
      const doneRaw = sessionStorage.getItem(`branner-done:${slug}`);
      if (doneRaw) {
        const prior = JSON.parse(doneRaw) as {
          firstName?: string;
          lastName?: string;
          message?: string;
        };
        const samePerson =
          `${prior.firstName ?? ""} ${prior.lastName ?? ""}`
            .trim()
            .toLowerCase() === `${first} ${last}`.trim().toLowerCase();
        if (samePerson && prior.message) setDone(prior.message);
      }
    } catch {
      /* ignore */
    }
    load({ firstName: first, lastName: last }).catch((e) =>
      setError((e as Error).message),
    );
  }, [slug]);

  const startWatch = () => {
    if (!event?.locationTracking || event.lat == null || event.lng == null)
      return;
    locAskedRef.current = true;
    sessionStorage.setItem(`branner-loc:${event.slug}`, "watching");
    setAsk(false);
    setLoc("locating");
    if (!("geolocation" in navigator)) {
      setLoc("denied");
      return;
    }
    if (watchRef.current != null)
      navigator.geolocation.clearWatch(watchRef.current);
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

  useEffect(() => {
    if (!event?.locationTracking || !event.slug) return;
    if (watchRef.current != null) return;
    const prior = sessionStorage.getItem(`branner-loc:${event.slug}`);
    if (prior === "watching") {
      startWatch();
      return;
    }
    if (locAskedRef.current || prior === "asked") return;
    locAskedRef.current = true;
    sessionStorage.setItem(`branner-loc:${event.slug}`, "asked");
    setLoc("prompt");
    setAsk(true);
    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [event?.slug, event?.locationTracking, event?.lat, event?.lng]);

  useEffect(() => {
    if (!slug || !event || event.requireLogin || event.oneResponse === false)
      return;
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) return;
    const t = window.setTimeout(() => {
      load({ firstName: first, lastName: last }).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(t);
  }, [slug, event?.requireLogin, event?.oneResponse, firstName, lastName]);

  const hasName = firstName.trim().length > 0 && lastName.trim().length > 0;
  const identified = event?.requireLogin
    ? Boolean(identity?.resident)
    : hasName;
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
      if (!event.requireLogin) {
        sessionStorage.setItem(
          `branner-name:${event.slug}`,
          JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          }),
        );
      }
      const result = await api<{
        resident: { firstName: string; lastName: string; room: string } | null;
        guestName: string | null;
        late?: boolean;
      }>(`/api/public/events/${event.slug}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: responseData,
          responseData,
          gps,
          lat: gps?.lat,
          lng: gps?.lng,
          accuracy: gps?.accuracy,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      const typed = `${firstName.trim()} ${lastName.trim()}`;
      const who = typed || result.guestName ||
        (result.resident
          ? `${result.resident.firstName} ${result.resident.lastName}`
          : "");
      rememberDone(
        event.slug,
        firstName.trim(),
        lastName.trim(),
        result.late
          ? `You're checked in as ${who}. You were not here for the whole house meeting.`
          : `You're checked in as ${who}.`,
      );
    } catch (err) {
      const message = (err as Error).message;
      if (/already checked in/i.test(message)) {
        rememberDone(
          event.slug,
          firstName.trim(),
          lastName.trim(),
          message.endsWith(".") ? message : `${message}.`,
        );
      } else {
        setError(message);
      }
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

  const bar = statusBar({
    event,
    identified,
    loc,
    distance,
    requireLogin: event?.requireLogin ?? true,
  });

  if (!event) {
    return (
      <div className="p-10 text-center text-stone-mute">
        {error || "Loading…"}
      </div>
    );
  }

  const next = `/a/${event.slug}`;

  return (
    <div className="min-h-screen bg-stone-sand">
      <div
        className={`${bar.bg} px-4 py-3 text-center text-sm font-medium text-white`}
      >
        {bar.text}
        {loc === "denied" && event.locationTracking && (
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => setAsk(true)}
          >
            Try again
          </button>
        )}
      </div>
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cardinal">
          Branner
        </p>
        <h1 className="mt-1 font-display text-3xl">{event.title}</h1>
        <p className="text-sm text-stone-mute">
          {event.eventType?.label ?? "House meeting"}
        </p>

        {event.requireLogin && !identity?.resident && (
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm">
              Sign in with Stanford so we know who you are. You cannot pick a
              name.
            </p>
            {googleEnabled ? (
              <a
                href={`/api/auth/google?next=${encodeURIComponent(next)}`}
                className="mt-4 block rounded-lg bg-cardinal py-2 text-center text-sm font-semibold text-white"
              >
                Sign in with Stanford
              </a>
            ) : (
              <p className="mt-3 text-xs text-stone-mute">
                Google OAuth is not configured on this server yet. Use your
                roster @stanford.edu email.
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

        {event.requireLogin && identity && !identity.resident && (
          <p className="mt-6 rounded-2xl bg-white p-5 text-sm text-cardinal shadow-sm">
            {identity.email} is not on the Branner roster.
          </p>
        )}

        {event.requireLogin && identity?.resident && (
          <p className="mt-6 rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
            Checking in as <strong>{identity.name}</strong> · Room{" "}
            {identity.resident.room}
          </p>
        )}

        {!event.requireLogin && (
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium">Write your name</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                First name
                <input
                  className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                />
              </label>
              <label className="block text-sm">
                Last name
                <input
                  className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  required
                />
              </label>
            </div>
          </div>
        )}

        {lateNotice && !done && (
          <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
            {lateNotice}
          </div>
        )}

        {done ? (
          <div className={`mt-8 rounded-2xl p-6 text-center ${/whole house meeting/i.test(done) ? "bg-amber-50" : "bg-emerald-50"}`}>
            <p className={`font-medium ${/whole house meeting/i.test(done) ? "text-amber-950" : "text-emerald-800"}`}>{done}</p>
          </div>
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

      {ask && event.locationTracking && loc !== "inside" && loc !== "outside" && loc !== "locating" && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="font-display text-xl">Use your location?</h2>
            <p className="mt-2 text-sm text-stone-mute">
              We need GPS to confirm you are at this event. You cannot type or
              edit a location.
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
  requireLogin,
}: {
  event: PublicEvent | null;
  identified: boolean;
  loc: LocState;
  distance: number | null;
  requireLogin: boolean;
}) {
  if (!identified) {
    return {
      bg: "bg-red-700",
      text: requireLogin
        ? "Sign in with Stanford — you cannot submit yet"
        : "Enter your name — you cannot submit yet",
    };
  }
  if (!event?.locationTracking) {
    return {
      bg: "bg-emerald-700",
      text: requireLogin
        ? "You're signed in — you can submit"
        : "Name entered — you can submit",
    };
  }
  if (loc === "inside") {
    return {
      bg: "bg-emerald-600",
      text: "You're in the right place — you can submit",
    };
  }
  if (loc === "outside") {
    return {
      bg: "bg-red-600",
      text: `Too far (${Math.round(distance ?? 0)} m) — you cannot submit`,
    };
  }
  if (loc === "locating") {
    return {
      bg: "bg-amber-500",
      text: "Getting your location — you cannot submit yet",
    };
  }
  if (loc === "denied") {
    return { bg: "bg-red-700", text: "Location blocked — you cannot submit" };
  }
  return { bg: "bg-amber-600", text: "Allow location — you cannot submit yet" };
}
