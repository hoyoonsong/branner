import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { submissionWindow } from "../lib/attendance";
import type { FormSchema } from "../lib/types";
import { formatWhen } from "../lib/utils";
import { FormRenderer } from "../components/FormRenderer";
import { haversineMeters, isNearEvent } from "../lib/geo";
import { useAuth } from "../context/AuthContext";

type PublicEvent = {
  id: string;
  title: string;
  requireLogin: boolean;
  locationTracking: boolean;
  oneResponse?: boolean;
  acceptingResponses?: boolean;
  responsesOpenAt?: string | null;
  responsesCloseAt?: string | null;
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
type LocState = "off" | "prompt" | "locating" | "inside" | "outside" | "unavailable";

function requestFix(highAccuracy: boolean): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: highAccuracy,
      maximumAge: highAccuracy ? 20_000 : 180_000,
      timeout: highAccuracy ? 12_000 : 20_000,
    });
  });
}

async function requestBestFix(): Promise<GeolocationPosition> {
  try {
    return await requestFix(true);
  } catch (err) {
    if ((err as GeolocationPositionError).code === 1) throw err;
    return requestFix(false);
  }
}

function locationFailureNote(code: number | undefined): string {
  if (code === 1) {
    return "Safari blocked location. On iPhone, open Settings, then Safari, then Location, and choose Allow. Take a selfie to check in.";
  }
  if (code === 3) {
    return "Safari didn't return a location in time. Take a selfie to check in.";
  }
  return "This phone couldn't share a location. Take a selfie to check in.";
}

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
  const [locNote, setLocNote] = useState("");
  const [done, setDone] = useState("");
  const [lateNotice, setLateNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [devEmail, setDevEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selfie, setSelfie] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const watchRef = useRef<number | null>(null);
  const locateTimerRef = useRef<number | null>(null);
  const locateGen = useRef(0);

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

  const stopWatch = () => {
    locateGen.current += 1;
    if (locateTimerRef.current != null) {
      window.clearTimeout(locateTimerRef.current);
      locateTimerRef.current = null;
    }
    if (watchRef.current != null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  };

  const applyFix = (pos: GeolocationPosition) => {
    if (locateTimerRef.current != null) {
      window.clearTimeout(locateTimerRef.current);
      locateTimerRef.current = null;
    }
    if (!event || event.lat == null || event.lng == null) return;
    const next = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
    setGps(next);
    const d = haversineMeters(next.lat, next.lng, event.lat, event.lng);
    setDistance(d);
    setLoc(isNearEvent(d, event.radiusMeters, next.accuracy) ? "inside" : "outside");
    setLocNote("");
    sessionStorage.setItem(`branner-loc:${event.slug}`, "granted");
  };

  const startWatch = () => {
    if (!event?.locationTracking || !event.slug) return;
    if (event.lat == null || event.lng == null) {
      setAsk(false);
      setLoc("off");
      return;
    }
    setAsk(false);
    setLoc("locating");
    setLocNote("");
    if (!("geolocation" in navigator)) {
      setLoc("unavailable");
      setLocNote("This browser can't share a location. Take a selfie to check in.");
      return;
    }
    stopWatch();
    const gen = locateGen.current;
    locateTimerRef.current = window.setTimeout(() => {
      if (gen !== locateGen.current) return;
      setLoc((current) => {
        if (current !== "locating") return current;
        setLocNote("Safari is still working on a location. Take a selfie to check in.");
        return "unavailable";
      });
    }, 10_000);
    void requestBestFix()
      .then((pos) => {
        if (gen !== locateGen.current) return;
        applyFix(pos);
        watchRef.current = navigator.geolocation.watchPosition(
          applyFix,
          () => {
            /* a later watch error should not undo a fix we already accepted */
          },
          { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 },
        );
      })
      .catch((err: GeolocationPositionError) => {
        if (gen !== locateGen.current) return;
        if (locateTimerRef.current != null) {
          window.clearTimeout(locateTimerRef.current);
          locateTimerRef.current = null;
        }
        setGps(null);
        setDistance(null);
        setLoc("unavailable");
        setLocNote(locationFailureNote(err?.code));
        sessionStorage.removeItem(`branner-loc:${event.slug}`);
      });
  };

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(t);
  }, []);

  const gate = submissionWindow(
    {
      acceptingResponses: event?.acceptingResponses,
      responsesOpenAt: event?.responsesOpenAt,
      responsesCloseAt: event?.responsesCloseAt,
    },
    new Date(now),
  );

  useEffect(() => {
    if (!event?.locationTracking || !event.slug || !gate.open) {
      setAsk(false);
      return;
    }
    if (event.lat == null || event.lng == null) {
      setLoc("off");
      setAsk(false);
      return;
    }
    const prior = sessionStorage.getItem(`branner-loc:${event.slug}`);
    if (prior === "granted") {
      startWatch();
    } else {
      setLoc("prompt");
      setAsk(true);
    }
    return () => stopWatch();
  }, [event?.slug, event?.locationTracking, event?.lat, event?.lng, gate.open]);

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
  const needsSelfie =
    Boolean(event?.locationTracking) &&
    event?.lat != null &&
    event?.lng != null &&
    loc === "unavailable";
  const canSubmit = useMemo(() => {
    if (!event || !gate.open) return false;
    if (!identified) return false;
    if (needsSelfie && !selfie) return false;
    if (event.locationTracking && event.lat != null && event.lng != null && loc !== "inside" && loc !== "unavailable") {
      return false;
    }
    return true;
  }, [event, gate.open, identified, loc, needsSelfie, selfie]);

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
          gps: loc === "inside" ? gps : null,
          lat: loc === "inside" ? gps?.lat : null,
          lng: loc === "inside" ? gps?.lng : null,
          accuracy: loc === "inside" ? gps?.accuracy : null,
          locationUnavailable: event.locationTracking && loc !== "inside",
          selfie: needsSelfie ? selfie : null,
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

  const closed = event && !gate.open ? closedCopy(event) : "";
  const bar = statusBar({
    event,
    identified,
    loc,
    distance,
    requireLogin: event?.requireLogin ?? true,
    hasSelfie: Boolean(selfie),
    closed,
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
        {!closed && (loc === "unavailable" || loc === "prompt") && event.locationTracking && (
          <button
            type="button"
            className="ml-3 underline"
            onClick={startWatch}
          >
            Try location again
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

        {closed && !done ? (
          <div className="mt-6 rounded-2xl bg-white p-5 text-sm shadow-sm">
            <p className="font-medium">Check-in is closed</p>
            <p className="mt-1 text-stone-mute">{closed}</p>
          </div>
        ) : null}

        {!closed && event.requireLogin && !identity?.resident && (
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

        {!closed && event.requireLogin && identity && !identity.resident && (
          <p className="mt-6 rounded-2xl bg-white p-5 text-sm text-cardinal shadow-sm">
            {identity.email} is not on the Branner roster.
          </p>
        )}

        {!closed && event.requireLogin && identity?.resident && (
          <p className="mt-6 rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
            Checking in as <strong>{identity.name}</strong> · Room{" "}
            {identity.resident.room}
          </p>
        )}

        {!closed && !event.requireLogin && (
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium">Write your name</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                First name
                <input
                  className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    setDone("");
                  }}
                  autoComplete="given-name"
                  required
                />
              </label>
              <label className="block text-sm">
                Last name
                <input
                  className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    setDone("");
                  }}
                  autoComplete="family-name"
                  required
                />
              </label>
            </div>
          </div>
        )}

        {!closed && locNote && !done && (
          <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
            {locNote}
          </div>
        )}

        {!closed && needsSelfie && !done && (
          <MeetingSelfie value={selfie} onChange={setSelfie} />
        )}

        {!closed && lateNotice && !done && (
          <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
            {lateNotice}
          </div>
        )}

        {done ? (
          <div className={`mt-8 rounded-2xl p-6 text-center ${/whole house meeting/i.test(done) ? "bg-amber-50" : "bg-emerald-50"}`}>
            <p className={`font-medium ${/whole house meeting/i.test(done) ? "text-amber-950" : "text-emerald-800"}`}>{done}</p>
          </div>
        ) : closed ? null : (
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

      {ask && gate.open && event.locationTracking && loc !== "inside" && loc !== "outside" && loc !== "locating" && loc !== "unavailable" && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="font-display text-xl">Use your location?</h2>
            <p className="mt-2 text-sm text-stone-mute">
              Safari will ask to share your location so we know you're at this event. If you
              decline, or Safari can't get a fix, take a selfie at the meeting instead.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm"
                onClick={() => {
                  setAsk(false);
                  setLoc("unavailable");
                  setLocNote("Location skipped. Take a selfie to check in.");
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

function MeetingSelfie({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState("");

  const stop = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
    setReady(false);
  };

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!live || !video || !stream) return;
    let stopped = false;
    video.srcObject = stream;
    const kick = window.setInterval(() => {
      if (stopped) return;
      if (video.videoWidth > 0) {
        setReady(true);
        window.clearInterval(kick);
        return;
      }
      void video.play().catch(() => undefined);
    }, 200);
    void video.play().catch(() => undefined);
    return () => {
      stopped = true;
      window.clearInterval(kick);
      video.srcObject = null;
      setReady(false);
    };
  }, [live]);

  useEffect(() => () => stop(), []);

  const openCamera = async () => {
    setCamError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("This browser can't open the camera. Allow the camera for this site, then try again.");
      return;
    }
    try {
      stop();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 1280 } },
      });
      streamRef.current = stream;
      setLive(true);
    } catch {
      setCamError("Camera blocked. On iPhone, allow the camera for this site in Settings, then try again.");
    }
  };

  const snap = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const scale = Math.min(1, 960 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL("image/jpeg", 0.72));
    stop();
  };

  return (
    <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm font-medium">Selfie at the meeting</p>
      <p className="mt-1 text-sm text-stone-mute">
        Your browser didn't share a location, so take a photo here before you check in.
      </p>
      {value ? (
        <div className="mt-4">
          <img src={value} alt="Your selfie" className="aspect-[3/4] w-full rounded-xl object-cover" />
          <button
            type="button"
            className="mt-3 text-sm font-medium text-cardinal"
            onClick={() => {
              onChange(null);
              void openCamera();
            }}
          >
            Retake
          </button>
        </div>
      ) : (
        <div className="mt-4">
          {live ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="aspect-[3/4] w-full rounded-xl bg-black object-cover"
              />
              <button
                type="button"
                className="mt-3 w-full rounded-lg bg-cardinal py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                onClick={snap}
                disabled={!ready}
              >
                {ready ? "Take selfie" : "Starting camera…"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="w-full rounded-lg border border-black/10 py-2 text-sm font-semibold"
              onClick={() => void openCamera()}
            >
              Open camera
            </button>
          )}
          {camError && <p className="mt-3 text-sm text-cardinal">{camError}</p>}
        </div>
      )}
    </div>
  );
}

function closedCopy(event: PublicEvent): string {
  const gate = submissionWindow(event);
  if (gate.reason === "not_yet" && event.responsesOpenAt) {
    return `Check-in opens ${formatWhen(event.responsesOpenAt)}.`;
  }
  if (gate.reason === "ended" && event.responsesCloseAt) {
    return `Check-in closed ${formatWhen(event.responsesCloseAt)}.`;
  }
  return "Check-in is closed right now. You cannot submit yet.";
}

function statusBar({
  event,
  identified,
  loc,
  distance,
  requireLogin,
  hasSelfie,
  closed,
}: {
  event: PublicEvent | null;
  identified: boolean;
  loc: LocState;
  distance: number | null;
  requireLogin: boolean;
  hasSelfie: boolean;
  closed: string;
}) {
  if (closed) {
    return { bg: "bg-stone-700", text: closed.replace(/\.$/, "") };
  }
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
  if (loc === "unavailable") {
    if (!hasSelfie) {
      return { bg: "bg-amber-600", text: "Location isn't available — take a selfie to check in" };
    }
    return { bg: "bg-emerald-700", text: "Selfie taken — you can submit" };
  }
  return { bg: "bg-amber-600", text: "Allow location to confirm you're here — or skip and take a selfie" };
}
