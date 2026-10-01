import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../lib/api";
import { eventIsHouseMeeting, isHouseMeeting, isRa, type AttendanceEvent, type EventType, type FormField, type FormSchema, type Resident } from "../lib/types";
import { flattenVisibleFields } from "../lib/conditional";
import { applyAttendanceStatus, attendanceStatus, excusedNoteOf, lateAtOf, responseGateOf, submissionWindow, withResponseGate, type AttendanceStatus } from "../lib/attendance";
import { clsx, downloadTextFile, fileSlug, formatCheckIn, formatWhen, fromDatetimeLocal, fullName, personSearchHay, toCsv, toDatetimeLocal } from "../lib/utils";
import { FormBuilderModal } from "../components/FormBuilderModal";
import { EventLocationMap } from "../components/EventLocationMap";
import { BRANNER_LAT, BRANNER_LNG } from "../lib/geo";
import { Avatar, RaBadge } from "./Residents";

type SubmissionRow = {
  id: string;
  createdAt: string;
  residentId?: string | null;
  status?: string | null;
  distanceM: number | null;
  accuracy: number | null;
  selfiePath?: string | null;
  guestName: string | null;
  responseData: Record<string, unknown>;
  resident: Resident | null;
};

type PeopleFilter = "all" | "present" | "late" | "excused" | "absent";

export function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState<AttendanceEvent | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [absent, setAbsent] = useState<Resident[]>([]);
  const [analytics, setAnalytics] = useState<{
    present: number;
    late?: number;
    excused?: number;
    expected: number;
    absent: number;
    byHall: Record<string, { present: number; late?: number; excused?: number; expected: number }>;
  } | null>(null);
  const [builder, setBuilder] = useState(false);
  const [settings, setSettings] = useState(false);
  const [peopleQ, setPeopleQ] = useState("");
  const [list, setList] = useState<PeopleFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [peopleError, setPeopleError] = useState("");
  const savingRef = useRef(false);
  const revision = useRef(0);

  const load = async (opts?: { force?: boolean }) => {
    if (!id) return;
    const rev = revision.current;
    if (savingRef.current && !opts?.force) return;
    const data = await api<{
      event: AttendanceEvent;
      submissions: SubmissionRow[];
      absent: Resident[];
      analytics: NonNullable<typeof analytics>;
    }>(`/api/events/${id}`);
    if (rev !== revision.current) return;
    if (savingRef.current && !opts?.force) return;
    setEvent(withResponseGate(data.event));
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

  const rollup = useMemo(
    () => deriveRollup(event, submissions, absent, analytics),
    [event, submissions, absent, analytics],
  );

  if (!event || !analytics) return <p className="text-stone-mute">Loading…</p>;

  const saveSchema = async (formSchema: FormSchema) => {
    const next = { ...formSchema, responseGate: event.formSchema.responseGate };
    await api(`/api/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ formSchema: next }),
    });
    setEvent({ ...event, formSchema: next });
  };

  const persistAttendance = async (
    resident: Resident | undefined,
    submission: SubmissionRow | undefined,
    status: AttendanceStatus,
    note: string,
  ) => {
    try {
      await api(`/api/events/${event.id}/set-status`, {
        method: "POST",
        body: JSON.stringify({
          status,
          residentId: resident?.id,
          submissionId: submission?.id,
          note,
        }),
      });
      return;
    } catch (err) {
      if (event.requireLogin || !resident) throw err;
    }

    if (status === "present") {
      const marked = await fetch(`/api/events/${event.id}/mark-present`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({ residentId: resident!.id }),
      });
      if (marked.ok) return;
      if (marked.status !== 404 || event.requireLogin) {
        const data = (await marked.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || marked.statusText);
      }
    }

    const answers: Record<string, unknown> = {
      staffMarked: true,
    };
    if (status === "late") {
      answers.late = true;
      answers.lateAt = new Date().toISOString();
    } else if (status === "excused") {
      answers.excused = true;
      if (note) answers.excusedNote = note;
    }
    await api(`/api/public/events/${event.slug}/submit`, {
      method: "POST",
      body: JSON.stringify({
        firstName: resident!.firstName,
        lastName: resident!.lastName,
        answers,
        lat: event.lat,
        lng: event.lng,
        accuracy: 0,
      }),
    });
  };

  const setAttendance = async (
    target: { resident?: Resident; submission?: SubmissionRow },
    status: AttendanceStatus,
  ) => {
    const resident = target.resident ?? target.submission?.resident ?? undefined;
    const submission = target.submission;
    const id = resident?.id ?? submission?.id;
    if (!id) {
      setPeopleError("Could not update attendance for this person.");
      return;
    }
    setPeopleError("");
    setBusyId(id);
    savingRef.current = true;
    const previousSubmissions = submissions;
    const previousAbsent = absent;
    const now = new Date().toISOString();
    const nextData = applyAttendanceStatus(
      submission?.responseData ?? {},
      status,
    );
    if (resident) {
      setAbsent((rows) => rows.filter((row) => row.id !== resident.id));
    }
    setSubmissions((rows) => {
      const idx = rows.findIndex(
        (row) =>
          (submission && row.id === submission.id) ||
          Boolean(resident && (row.residentId === resident.id || row.resident?.id === resident.id)),
      );
      if (idx >= 0) {
        const next = [...rows];
        next[idx] = { ...next[idx], status, responseData: { ...next[idx].responseData, ...nextData } };
        return next;
      }
      if (!resident) return rows;
      return [
        ...rows,
        {
          id: `tmp-${resident.id}`,
          createdAt: now,
          residentId: resident.id,
          status,
          distanceM: null,
          accuracy: null,
          guestName: fullName(resident),
          responseData: nextData,
          resident,
        },
      ];
    });
    try {
      await persistAttendance(resident, submission, status, "");
      await load({ force: true });
    } catch (err) {
      setSubmissions(previousSubmissions);
      setAbsent(previousAbsent);
      setPeopleError(err instanceof Error ? err.message : "Could not update attendance");
    } finally {
      savingRef.current = false;
      setBusyId(null);
    }
  };

  const setAccepting = async (next: boolean) => {
    const previous = event;
    const rev = ++revision.current;
    setPeopleError("");
    savingRef.current = true;
    const formSchema = {
      ...event.formSchema,
      responseGate: {
        acceptingResponses: next,
        responsesOpenAt: event.responsesOpenAt ?? null,
        responsesCloseAt: event.responsesCloseAt ?? null,
      },
    };
    setEvent({ ...event, acceptingResponses: next, formSchema });
    try {
      const data = await api<{ event: AttendanceEvent }>(`/api/events/${event.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          acceptingResponses: next,
          responsesOpenAt: event.responsesOpenAt ?? null,
          responsesCloseAt: event.responsesCloseAt ?? null,
          formSchema,
        }),
      });
      if (rev !== revision.current) return;
      const saved = withResponseGate(data.event);
      if (saved.acceptingResponses !== next) {
        throw new Error("Could not save whether responses are open.");
      }
      setEvent(saved);
    } catch (err) {
      if (rev === revision.current) setEvent(previous);
      setPeopleError(err instanceof Error ? err.message : "Could not update check-in");
    } finally {
      if (rev === revision.current) savingRef.current = false;
    }
  };

  const removeCheckIn = async (submission: SubmissionRow) => {
    const label = submission.resident
      ? fullName(submission.resident)
      : submission.guestName || "this response";
    if (!window.confirm(`Delete ${label}'s check-in? This cannot be undone.`)) return;
    setPeopleError("");
    setBusyId(submission.id);
    savingRef.current = true;
    const previous = submissions;
    setSubmissions((rows) => rows.filter((row) => row.id !== submission.id));
    try {
      await api(`/api/events/${event.id}/unmark`, {
        method: "POST",
        body: JSON.stringify({ submissionId: submission.id }),
      });
      await load({ force: true });
    } catch (err) {
      setSubmissions(previous);
      setPeopleError(err instanceof Error ? err.message : "Could not delete response");
    } finally {
      savingRef.current = false;
      setBusyId(null);
    }
  };

  return (
    <div>
      <Link to="/attendance" className="text-sm text-cardinal">
        ← Attendance
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words font-display text-2xl sm:text-3xl">{event.title}</h1>
          <p className="text-stone-mute">
            {event.eventType?.label} · {formatWhen(event.startsAt)}
          </p>
          <p className="mt-1 text-sm text-stone-mute">{responseWindowCopy(event)}</p>
          {eventIsHouseMeeting(event) && (
            <p className="mt-1 text-sm text-stone-mute">
              RAs are not expected and do not appear under Not here. If they check in, they still show as present.
            </p>
          )}
          {peopleError && (
            <p className="mt-3 rounded-xl bg-cardinal/10 px-3 py-2 text-sm text-cardinal">{peopleError}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={event.acceptingResponses !== false}
              onChange={(e) => void setAccepting(e.target.checked)}
            />
            Accepting responses
          </label>
          <button
            type="button"
            onClick={() => setSettings(true)}
            className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => setBuilder(true)}
            className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm"
          >
            Edit form
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Present" value={rollup.present} />
          <Stat label="Late" value={rollup.late} />
          <Stat label="Excused" value={rollup.excused} />
          <Stat label="Absent" value={rollup.absent} />
          <Stat label="Expected" value={rollup.expected} />
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
        {Object.entries(rollup.byHall).map(([hall, v]) => (
          <div key={hall} className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
            <p className="font-medium">{hall}</p>
            <p className="text-stone-mute">
              {v.present + (v.late ?? 0)} here
              {(v.late ?? 0) > 0 ? ` · ${v.late} late` : ""}
              {(v.excused ?? 0) > 0 ? ` · ${v.excused} excused` : ""}
              {` / ${v.expected}`}
            </p>
          </div>
        ))}
      </div>

      <PeopleLists
        event={event}
        submissions={submissions}
        absent={rollup.missing}
        query={peopleQ}
        onQuery={setPeopleQ}
        list={list}
        onList={setList}
        busyId={busyId}
        error={peopleError}
        onSetStatus={setAttendance}
        onRemove={removeCheckIn}
      />

      {settings && (
        <EventSettingsModal
          event={event}
          onClose={() => setSettings(false)}
          onSaved={(next) => {
            setEvent({ ...event, ...next });
            setSettings(false);
          }}
        />
      )}

      {builder && (
        <FormBuilderModal
          schema={event.formSchema}
          title={event.title}
          requireLogin={event.requireLogin}
          shareUrl={shareUrl}
          status="published"
          submissions={submissions}
          onDeleteSubmission={removeCheckIn}
          onChange={(schema) =>
            setEvent((current) =>
              current
                ? {
                    ...current,
                    formSchema: { ...schema, responseGate: current.formSchema.responseGate },
                  }
                : current,
            )
          }
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

function matchesPerson(q: string, s: SubmissionRow) {
  return personSearchHay([
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
  ]).includes(q);
}

function PeopleLists({
  event,
  submissions,
  absent,
  query,
  onQuery,
  list,
  onList,
  busyId,
  error,
  onSetStatus,
  onRemove,
}: {
  event: AttendanceEvent;
  submissions: SubmissionRow[];
  absent: Resident[];
  query: string;
  onQuery: (q: string) => void;
  list: PeopleFilter;
  onList: (v: PeopleFilter) => void;
  busyId: string | null;
  error: string;
  onSetStatus: (
    target: { resident?: Resident; submission?: SubmissionRow },
    status: AttendanceStatus,
  ) => void;
  onRemove: (submission: SubmissionRow) => void;
}) {
  const q = personSearchHay([query]);
  const present = useMemo(() => {
    const rows = submissions
      .filter((s) => attendanceStatus(s) === "present")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return q ? rows.filter((s) => matchesPerson(q, s)) : rows;
  }, [submissions, q]);
  const late = useMemo(() => {
    const rows = submissions
      .filter((s) => attendanceStatus(s) === "late")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return q ? rows.filter((s) => matchesPerson(q, s)) : rows;
  }, [submissions, q]);
  const excused = useMemo(() => {
    const rows = submissions
      .filter((s) => attendanceStatus(s) === "excused")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return q ? rows.filter((s) => matchesPerson(q, s)) : rows;
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

  const exportLabel =
    list === "present"
      ? "Export present CSV"
      : list === "late"
        ? "Export late CSV"
        : list === "excused"
          ? "Export excused CSV"
          : list === "absent"
            ? "Export not-here CSV"
            : "Export all CSV";

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Who is here</h2>
          <p className="text-sm text-stone-mute">
            Mark late or excused from either list. Late people can still submit the form. Export uses
            the current filter and search.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search people…"
          className="w-full max-w-sm rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["all", `All (${present.length + late.length + excused.length + missing.length})`],
            ["present", `Present (${present.length})`],
            ["late", `Late (${late.length})`],
            ["excused", `Excused (${excused.length})`],
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
        <button
          type="button"
          onClick={() => exportAttendanceCsv(event, { present, late, excused, missing }, list)}
          className="ml-auto rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium"
        >
          {exportLabel}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-cardinal">{error}</p>}

      {(list === "all" || list === "present") && (
        <section className="mt-6">
          <h3 className="font-display text-lg">Present</h3>
          <div className="mt-3 divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
            {present.map((s) => (
              <PresentRow
                key={s.id}
                submission={s}
                schema={event.formSchema}
                busy={busyId === s.id || busyId === s.resident?.id}
                onMarkLate={s.resident ? () => onSetStatus({ submission: s, resident: s.resident! }, "late") : undefined}
                onRemove={() => onRemove(s)}
              />
            ))}
            {present.length === 0 && (
              <p className="p-4 text-sm text-stone-mute">
                {q ? "No matching check-ins." : "No check-ins yet."}
              </p>
            )}
          </div>
        </section>
      )}

      {(list === "all" || list === "late") && (
        <section className="mt-8">
          <h3 className="font-display text-lg">Arrived late</h3>
          <div className="mt-3 divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
            {late.map((s) => (
              <PresentRow
                key={s.id}
                submission={s}
                schema={event.formSchema}
                kind="late"
                busy={busyId === s.id || busyId === s.resident?.id}
                onRemove={() => onRemove(s)}
              />
            ))}
            {late.length === 0 && (
              <p className="p-4 text-sm text-stone-mute">
                {q ? "No matching late arrivals." : "Nobody has been marked late."}
              </p>
            )}
          </div>
        </section>
      )}

      {(list === "all" || list === "excused") && (
        <section className="mt-8">
          <h3 className="font-display text-lg">Excused absences</h3>
          <div className="mt-3 divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
            {excused.map((s) => (
              <PresentRow
                key={s.id}
                submission={s}
                schema={event.formSchema}
                kind="excused"
                busy={busyId === s.id || busyId === s.resident?.id}
                onRemove={() => onRemove(s)}
              />
            ))}
            {excused.length === 0 && (
              <p className="p-4 text-sm text-stone-mute">
                {q ? "No matching excused absences." : "No excused absences."}
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
              <div
                key={r.id}
                className={clsx(
                  "flex flex-col gap-2 rounded-xl px-3 py-2 shadow-sm sm:flex-row sm:items-center sm:gap-3",
                  isRa(r) ? "bg-amber-50 ring-1 ring-amber-300" : "bg-white",
                )}
              >
                <Link to={`/residents/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
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
                <div className="flex flex-wrap gap-1 sm:shrink-0 sm:justify-end">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSetStatus({ resident: r }, "present");
                    }}
                    className="rounded-lg bg-cardinal px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {busyId === r.id ? "Saving…" : "Present"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSetStatus({ resident: r }, "late");
                    }}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 disabled:opacity-60"
                  >
                    Late
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSetStatus({ resident: r }, "excused");
                    }}
                    className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs font-medium disabled:opacity-60"
                  >
                    Excused
                  </button>
                </div>
              </div>
            ))}
          </div>
          {missing.length === 0 && (
            <p className="mt-3 text-sm text-stone-mute">
              {q ? "No matching people still out." : "Everyone expected is accounted for."}
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
  kind = "present",
  busy,
  onMarkLate,
  onRemove,
}: {
  submission: SubmissionRow;
  schema: FormSchema;
  kind?: AttendanceStatus;
  busy: boolean;
  onMarkLate?: () => void;
  onRemove: () => void;
}) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const resident = s.resident;
  const name = resident ? fullName(resident) : s.guestName || "Guest";
  const answers = responseItems(schema, s.responseData);
  const staffMarked = Boolean(s.responseData?.staffMarked);
  const lateAt = lateAtOf(s.responseData);
  const excusedNote = excusedNoteOf(s.responseData);
  const person = (
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
          {kind === "late" && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
              Late
            </span>
          )}
          {kind === "excused" && (
            <span className="rounded-full bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-mute">
              Excused
            </span>
          )}
          {staffMarked && kind === "present" && (
            <span className="rounded-full bg-cardinal/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cardinal">
              Marked by staff
            </span>
          )}
        </p>
        <p className="text-xs text-stone-mute">
          {resident
            ? [resident.room, resident.hall, resident.email].filter(Boolean).join(" · ")
            : "Name written at check-in — not matched to the roster"}
        </p>
      </div>
    </>
  );

  const locationLines = staffMarked
    ? ["No GPS"]
    : s.responseData?.locationUnavailable
      ? ["Location not shared"]
      : [
          s.distanceM != null ? `${Math.round(s.distanceM)} m away` : "",
          s.accuracy != null ? `±${Math.round(s.accuracy)} m GPS` : "",
        ].filter(Boolean);
  const hasDetails =
    answers.length > 0 || locationLines.length > 0 || Boolean(lateAt) || Boolean(excusedNote);

  return (
    <div className={clsx("px-4 py-2.5", isRa(resident) && "bg-amber-50/80")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        {resident ? (
          <Link to={`/residents/${resident.id}`} className="flex items-center gap-3 hover:text-cardinal">
            {person}
          </Link>
        ) : (
          <div className="flex items-center gap-3">{person}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 text-right text-xs text-stone-mute">
        <div>
          <p>{formatCheckIn(s.createdAt)}</p>
          <div className="mt-1.5 flex items-center justify-end gap-1.5">
            {onMarkLate && (
              <button
                type="button"
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMarkLate();
                }}
                className="whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 disabled:opacity-60"
              >
                Mark late
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }}
              className="whitespace-nowrap rounded-lg border border-cardinal/20 px-2.5 py-1 text-xs font-medium text-cardinal hover:bg-cardinal/10 disabled:opacity-60"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
        {s.selfiePath && (
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            className="shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10"
            aria-label={`View check-in photo for ${name}`}
          >
            <img src={s.selfiePath} alt="" className="h-12 w-12 object-cover" />
          </button>
        )}
        {hasDetails && (
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-label={detailsOpen ? `Hide details for ${name}` : `Show details for ${name}`}
            onClick={() => setDetailsOpen((open) => !open)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-mute hover:bg-black/5"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={clsx("h-4 w-4 transition", detailsOpen && "rotate-180")}
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
      </div>
      {detailsOpen && (
        <dl className="mt-2 grid gap-2 border-t border-black/5 pt-2 text-xs sm:ml-[3.75rem]">
          {kind === "late" && lateAt && (
            <div>
              <dt className="font-medium text-amber-800">Marked late</dt>
              <dd className="text-stone-mute">{formatCheckIn(lateAt)}</dd>
            </div>
          )}
          {kind === "excused" && excusedNote && (
            <div>
              <dt className="font-medium text-stone-ink">Excused note</dt>
              <dd className="whitespace-pre-wrap text-stone-mute">{excusedNote}</dd>
            </div>
          )}
          {locationLines.length > 0 && (
            <div>
              <dt className="font-medium text-stone-ink">Location</dt>
              <dd className="text-stone-mute">{locationLines.join(" · ")}</dd>
            </div>
          )}
          {answers.map((item) => (
            <div key={item.id}>
              <dt className="font-medium text-stone-ink">{item.label}</dt>
              <dd className="whitespace-pre-wrap text-stone-mute">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {photoOpen && s.selfiePath && (
        <PhotoModal src={s.selfiePath} name={name} onClose={() => setPhotoOpen(false)} />
      )}
    </div>
  );
}

function PhotoModal({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Check-in photo for ${name}`}
    >
      <div className="relative inline-block max-h-[90vh] max-w-full" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={`Check-in photo for ${name}`} className="max-h-[85vh] max-w-full rounded-xl object-contain" />
        <p className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-sm text-white">{name}</p>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-sm font-medium text-white hover:bg-black/80"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function formatFieldValue(data: Record<string, unknown> | null | undefined, id: string): string {
  if (!data) return "";
  const value = data[id];
  if (value == null || value === "" || value === false) return "";
  return Array.isArray(value) ? value.filter(Boolean).join(", ") : String(value);
}

function guestNameParts(name: string | null): { first: string; last: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function exportAttendanceCsv(
  event: AttendanceEvent,
  groups: {
    present: SubmissionRow[];
    late: SubmissionRow[];
    excused: SubmissionRow[];
    missing: Resident[];
  },
  list: PeopleFilter,
) {
  const formFields = (event.formSchema?.fields ?? []).filter(
    (field) => field.id !== "staffMarked" && field.type !== "heading" && field.type !== "conditional",
  );
  const contactHeaders = [
    "Status",
    "Name",
    "First name",
    "Last name",
    "Legal name",
    "Email",
    "Phone",
    "Room",
    "Hall",
    "Type",
    "Hometown",
    "Country",
  ];
  const includeCheckIn = list === "present" || list === "late" || list === "all";
  const extraHeaders =
    includeCheckIn
      ? ["Checked in at", "Marked late at", "Marked by staff", ...formFields.map((field) => field.label || field.id)]
      : list === "excused"
        ? ["Note"]
        : [];
  const headers = [...contactHeaders, ...extraHeaders];
  const rows: unknown[][] = [];
  const pushSubmission = (submission: SubmissionRow, statusLabel: string) => {
    const resident = submission.resident;
    const guest = guestNameParts(submission.guestName);
    const contact = [
      statusLabel,
      resident ? fullName(resident) : submission.guestName || "Guest",
      resident?.firstName ?? guest.first,
      resident?.lastName ?? guest.last,
      resident?.legalName ?? "",
      resident?.email ?? "",
      resident?.phone ?? "",
      resident?.room ?? "",
      resident?.hall ?? "",
      resident?.type ?? (resident ? "" : "Guest"),
      resident?.hometown ?? "",
      resident?.country ?? "",
    ];
    if (includeCheckIn) {
      rows.push([
        ...contact,
        submission.createdAt ? new Date(submission.createdAt).toLocaleString() : "",
        lateAtOf(submission.responseData) ? new Date(String(lateAtOf(submission.responseData))).toLocaleString() : "",
        submission.responseData?.staffMarked ? "Yes" : "",
        ...formFields.map((field) => formatFieldValue(submission.responseData, field.id)),
      ]);
      return;
    }
    rows.push(list === "excused" ? [...contact, excusedNoteOf(submission.responseData) ?? ""] : contact);
  };
  if (list === "all" || list === "present") {
    for (const submission of groups.present) pushSubmission(submission, "Present");
  }
  if (list === "all" || list === "late") {
    for (const submission of groups.late) pushSubmission(submission, "Late");
  }
  if (list === "all" || list === "excused") {
    for (const submission of groups.excused) pushSubmission(submission, "Excused");
  }
  if (list === "all" || list === "absent") {
    for (const resident of groups.missing) {
      const contact = [
        "Absent",
        fullName(resident),
        resident.firstName,
        resident.lastName,
        resident.legalName ?? "",
        resident.email,
        resident.phone ?? "",
        resident.room,
        resident.hall,
        resident.type,
        resident.hometown ?? "",
        resident.country ?? "",
      ];
      if (includeCheckIn) rows.push([...contact, "", "", "", ...formFields.map(() => "")]);
      else rows.push(contact);
    }
  }
  const filter =
    list === "present"
      ? "present"
      : list === "late"
        ? "late"
        : list === "excused"
          ? "excused"
          : list === "absent"
            ? "not-here"
            : "all";
  const stamp = new Date().toISOString().slice(0, 10);
  downloadTextFile(`${fileSlug(event.title)}-${filter}-${stamp}.csv`, toCsv(headers, rows));
}

const HIDDEN_RESPONSE_IDS = new Set(["staffMarked", "late", "lateAt", "excused", "excusedNote", "formSubmitted"]);

function responseItems(schema: FormSchema, data: Record<string, unknown> | null | undefined) {
  const answers = data ?? {};
  return flattenVisibleFields(schema.fields ?? [], answers)
    .filter((field) => field.type !== "heading" && field.type !== "location" && !HIDDEN_RESPONSE_IDS.has(field.id))
    .map((field) => {
      const value = formatAnswerValue(field, answers[field.id]);
      if (!value) return null;
      const rawLabel = field.label?.trim() || "";
      const label =
        field.type === "waiver"
          ? rawLabel.length > 0 && rawLabel.length <= 80
            ? rawLabel
            : "Agreement"
          : rawLabel || "Response";
      return { id: field.id, label, value };
    })
    .filter((item): item is { id: string; label: string; value: string } => Boolean(item));
}

function formatAnswerValue(field: FormField, value: unknown): string | null {
  if (field.type === "waiver") {
    const agreed =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as { agreed?: unknown }).agreed
        : value;
    if (agreed === true || agreed === "true" || agreed === "yes") return "Agreed";
    if (agreed === false || agreed === "false" || agreed === "no") return "Did not agree";
    return null;
  }
  if (value == null || value === "") return null;
  if (field.type === "yesno") {
    if (value === true || value === "true" || value === "yes") return "Yes";
    if (value === false || value === "false" || value === "no") return "No";
  }
  if (field.type === "checkbox" && (value === false || value === "false")) return null;
  if (value === true || value === "true") return "Yes";
  if (Array.isArray(value)) {
    const shown = value
      .map((entry) => (entry == null || entry === false ? "" : String(entry)))
      .filter(Boolean)
      .join(", ");
    return shown || null;
  }
  if (typeof value === "object") {
    const parts = Object.values(value as Record<string, unknown>)
      .filter((entry) => entry != null && entry !== "" && entry !== false)
      .map(String);
    return parts.length ? parts.join(", ") : null;
  }
  const shown = String(value).trim();
  return shown || null;
}

function deriveRollup(
  event: AttendanceEvent | null,
  submissions: SubmissionRow[],
  absent: Resident[],
  analytics: {
    present: number;
    late?: number;
    excused?: number;
    expected: number;
    absent: number;
    byHall: Record<string, { present: number; late?: number; excused?: number; expected: number }>;
  } | null,
) {
  if (!event || !analytics) {
    return { present: 0, late: 0, excused: 0, expected: 0, absent: 0, byHall: {}, missing: absent };
  }
  const house = eventIsHouseMeeting(event);
  const byId = new Map<string, Resident>();
  for (const row of submissions) {
    if (row.resident) byId.set(row.resident.id, row.resident);
  }
  for (const row of absent) byId.set(row.id, row);
  const roster = [...byId.values()];
  const expectedPeople = house ? roster.filter((r) => !isRa(r)) : roster;
  const counted = (status: AttendanceStatus) =>
    submissions.filter((s) => attendanceStatus(s) === status && (!house || !isRa(s.resident)));
  const presentRows = counted("present");
  const lateRows = counted("late");
  const excusedRows = counted("excused");
  const accountedIds = new Set(
    submissions
      .filter((s) => s.resident && (!house || !isRa(s.resident)))
      .map((s) => s.resident!.id),
  );
  const missing = expectedPeople.filter((r) => !accountedIds.has(r.id));
  const byHall: Record<string, { present: number; late: number; excused: number; expected: number }> = {};
  for (const r of expectedPeople) {
    byHall[r.hall] ??= { present: 0, late: 0, excused: 0, expected: 0 };
    byHall[r.hall].expected += 1;
  }
  for (const s of presentRows) {
    if (s.resident?.hall) {
      byHall[s.resident.hall] ??= { present: 0, late: 0, excused: 0, expected: 0 };
      byHall[s.resident.hall].present += 1;
    }
  }
  for (const s of lateRows) {
    if (s.resident?.hall) {
      byHall[s.resident.hall] ??= { present: 0, late: 0, excused: 0, expected: 0 };
      byHall[s.resident.hall].late += 1;
    }
  }
  for (const s of excusedRows) {
    if (s.resident?.hall) {
      byHall[s.resident.hall] ??= { present: 0, late: 0, excused: 0, expected: 0 };
      byHall[s.resident.hall].excused += 1;
    }
  }
  return {
    present: presentRows.length,
    late: lateRows.length,
    excused: excusedRows.length,
    expected: expectedPeople.length,
    absent: missing.length,
    byHall,
    missing,
  };
}

function EventSettingsModal({
  event,
  onClose,
  onSaved,
}: {
  event: AttendanceEvent;
  onClose: () => void;
  onSaved: (next: Partial<AttendanceEvent>) => void;
}) {
  const [types, setTypes] = useState<EventType[]>(event.eventType ? [event.eventType] : []);
  const [eventTypeId, setEventTypeId] = useState(event.eventTypeId);
  const [newType, setNewType] = useState("");
  const [locationTracking, setLocationTracking] = useState(event.locationTracking);
  const [oneResponse, setOneResponse] = useState(event.oneResponse !== false);
  const [acceptingResponses, setAcceptingResponses] = useState(event.acceptingResponses !== false);
  const [limitWindow, setLimitWindow] = useState(Boolean(event.responsesOpenAt || event.responsesCloseAt));
  const [responsesOpenAt, setResponsesOpenAt] = useState(toDatetimeLocal(event.responsesOpenAt));
  const [responsesCloseAt, setResponsesCloseAt] = useState(toDatetimeLocal(event.responsesCloseAt));
  const [lat, setLat] = useState(event.lat ?? BRANNER_LAT);
  const [lng, setLng] = useState(event.lng ?? BRANNER_LNG);
  const [radiusMeters, setRadiusMeters] = useState(event.radiusMeters || 80);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ types: EventType[] }>("/api/events/types")
      .then((d) => {
        const list = d.types;
        if (event.eventType && !list.some((t) => t.id === event.eventType!.id)) {
          list.unshift(event.eventType);
        }
        setTypes(list);
      })
      .catch(console.error);
  }, [event.eventType]);

  const selected = types.find((t) => t.id === eventTypeId) ?? event.eventType;
  const houseMeeting = isHouseMeeting(selected);

  const addType = async () => {
    if (!newType.trim()) return;
    const { type } = await api<{ type: EventType }>("/api/events/types", {
      method: "POST",
      body: JSON.stringify({ label: newType.trim() }),
    });
    setNewType("");
    setTypes((prev) => (prev.some((t) => t.id === type.id) ? prev : [...prev, type]));
    setEventTypeId(type.id);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    const openAt = limitWindow ? fromDatetimeLocal(responsesOpenAt) : null;
    const closeAt = limitWindow ? fromDatetimeLocal(responsesCloseAt) : null;
    if (openAt && closeAt && new Date(closeAt) <= new Date(openAt)) {
      setError("Close time has to be after the open time.");
      setSaving(false);
      return;
    }
    const payload = {
      eventTypeId,
      houseMeeting,
      locationTracking,
      oneResponse,
      acceptingResponses,
      responsesOpenAt: openAt,
      responsesCloseAt: closeAt,
      formSchema: {
        ...event.formSchema,
        responseGate: {
          acceptingResponses,
          responsesOpenAt: openAt,
          responsesCloseAt: closeAt,
        },
      },
      lat: locationTracking ? lat : null,
      lng: locationTracking ? lng : null,
      radiusMeters: locationTracking ? radiusMeters : event.radiusMeters,
    };
    try {
      let next: AttendanceEvent;
      try {
        const data = await api<{ event: AttendanceEvent }>(`/api/events/${event.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        next = data.event;
      } catch {
        const data = await api<{ event: AttendanceEvent }>(`/api/events/${event.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            eventTypeId,
            locationTracking,
            lat: payload.lat,
            lng: payload.lng,
            radiusMeters: payload.radiusMeters,
          }),
        });
        next = data.event;
      }
      onSaved({
        eventTypeId: next.eventTypeId,
        eventType: next.eventType ?? selected,
        houseMeeting: next.houseMeeting ?? houseMeeting,
        locationTracking: next.locationTracking,
        oneResponse: next.oneResponse ?? oneResponse,
        ...responseGateOf(next),
        lat: next.lat,
        lng: next.lng,
        radiusMeters: next.radiusMeters,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="font-display text-2xl">Event settings</h2>
        <label className="mt-5 block text-sm font-medium">Type</label>
        <select
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          value={eventTypeId}
          onChange={(e) => setEventTypeId(e.target.value)}
        >
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
          <button type="button" onClick={() => void addType()} className="rounded-lg border border-black/10 px-3 text-sm">
            Add
          </button>
        </div>
        {houseMeeting && (
          <p className="mt-2 text-xs text-stone-mute">
            House meetings exclude RAs from expected / absent. They can still check in.
          </p>
        )}
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={acceptingResponses}
            onChange={(e) => setAcceptingResponses(e.target.checked)}
          />
          <span>
            Accepting responses
            <span className="block text-xs text-stone-mute">
              People can check in and submit the form. Turn this off to pause it immediately.
            </span>
          </span>
        </label>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={limitWindow}
            onChange={(e) => setLimitWindow(e.target.checked)}
          />
          <span>
            Only during a set time
            <span className="block text-xs text-stone-mute">
              Outside this window the form stays closed, even if responses are on.
            </span>
          </span>
        </label>
        {limitWindow && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Opens
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                value={responsesOpenAt}
                onChange={(e) => setResponsesOpenAt(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Closes
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                value={responsesCloseAt}
                onChange={(e) => setResponsesCloseAt(e.target.value)}
              />
            </label>
          </div>
        )}
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={oneResponse}
            onChange={(e) => setOneResponse(e.target.checked)}
          />
          <span>
            One response per person
            <span className="block text-xs text-stone-mute">
              After someone checks in, they cannot submit again.
            </span>
          </span>
        </label>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={locationTracking}
            onChange={(e) => setLocationTracking(e.target.checked)}
          />
          <span>
            Location tracking
            <span className="block text-xs text-stone-mute">
              Respondents must be inside the check-in area to submit.
              {locationTracking
                ? " If a phone can't share location, they take a selfie at the meeting instead."
                : ""}
            </span>
          </span>
        </label>
        {locationTracking && (
          <div className="mt-3">
            <EventLocationMap
              lat={lat}
              lng={lng}
              radiusMeters={radiusMeters}
              onChange={(nextLat, nextLng) => {
                setLat(nextLat);
                setLng(nextLng);
              }}
              onRadiusChange={setRadiusMeters}
            />
          </div>
        )}
        {error && <p className="mt-3 text-sm text-cardinal">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-cardinal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

function responseWindowCopy(event: AttendanceEvent): string {
  const gate = submissionWindow(event);
  const open = event.responsesOpenAt ? formatWhen(event.responsesOpenAt) : "";
  const close = event.responsesCloseAt ? formatWhen(event.responsesCloseAt) : "";
  const range = open && close ? `${open} – ${close}` : open ? `from ${open}` : close ? `until ${close}` : "";
  if (gate.reason === "paused") {
    return range ? `Responses paused. Window is ${range}.` : "Responses paused. People cannot check in or submit the form.";
  }
  if (gate.reason === "not_yet" && open) return `Check-in opens ${open}.`;
  if (gate.reason === "ended" && close) return `Check-in closed ${close}.`;
  return range ? `People can submit ${range}.` : "People can check in and submit the form.";
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
