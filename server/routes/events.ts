import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireApproved } from "../auth.js";
import { BRANNER_LAT, BRANNER_LNG } from "../geo.js";
import { eventIsHouseMeeting, isHouseMeeting, isRa } from "../roster.js";
import { slugify, uniqueSlug } from "../slug.js";
import { applyAttendanceStatus, attendanceStatus, parseResponseData } from "../attendance.js";

export const eventsRouter = Router();
eventsRouter.use(requireApproved);

const defaultFormSchema = JSON.stringify({
  fields: [
    {
      id: "notes",
      type: "textarea",
      label: "Anything we should know?",
      required: false,
      placeholder: "Optional",
    },
  ],
});

eventsRouter.get("/types", async (_req, res) => {
  const types = await prisma.eventType.findMany({ orderBy: { label: "asc" } });
  res.json({ types });
});

eventsRouter.post("/types", async (req, res) => {
  const label = String(req.body?.label ?? "").trim();
  if (!label) {
    res.status(400).json({ error: "Label required" });
    return;
  }
  const slug = slugify(label);
  const existing = await prisma.eventType.findUnique({ where: { slug } });
  if (existing) {
    res.json({ type: existing });
    return;
  }
  const type = await prisma.eventType.create({ data: { label, slug } });
  res.json({ type });
});

eventsRouter.get("/", async (_req, res) => {
  const events = await prisma.event.findMany({
    include: {
      eventType: true,
      submissions: { include: { resident: { select: { type: true } } } },
    },
    orderBy: { startsAt: "desc" },
  });
  res.json({
    events: events.map(({ submissions, ...event }) => ({
      ...event,
      _count: {
        submissions: countedSubmissions(event, submissions).length,
      },
    })),
  });
});

eventsRouter.get("/:id", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { eventType: true },
  });
  if (!event) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const submissions = await prisma.submission.findMany({
    where: { eventId: event.id },
    include: { resident: true },
    orderBy: { createdAt: "asc" },
  });
  const residents = await prisma.resident.findMany({
    where: { building: "Branner" },
    orderBy: [{ hall: "asc" }, { lastName: "asc" }],
  });
  const houseMeeting = eventIsHouseMeeting(event);
  const expected = houseMeeting ? residents.filter((r) => !isRa(r.type)) : residents;
  const visibleSubmissions = countedSubmissions(event, submissions);
  const accountedIds = new Set(
    submissions.map((s) => s.residentId).filter((id): id is string => Boolean(id)),
  );
  const absent = expected.filter((r) => !accountedIds.has(r.id));
  const presentRows = visibleSubmissions.filter((s) => attendanceStatus(s) === "present");
  const lateRows = visibleSubmissions.filter((s) => attendanceStatus(s) === "late");
  const excusedRows = visibleSubmissions.filter((s) => attendanceStatus(s) === "excused");
  const byHall: Record<string, { present: number; late: number; excused: number; expected: number }> = {};
  for (const r of expected) {
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
  res.json({
    event: { ...event, formSchema: JSON.parse(event.formSchema) },
    submissions: submissions.map((s) => ({
      ...s,
      responseData: parseResponseData(s.responseData),
    })),
    absent,
    analytics: {
      present: presentRows.length,
      late: lateRows.length,
      excused: excusedRows.length,
      expected: expected.length,
      absent: absent.length,
      byHall,
    },
  });
});

eventsRouter.post("/:id/mark-present", async (req, res) => {
  const residentId = String(req.body?.residentId ?? "").trim();
  if (!residentId) {
    res.status(400).json({ error: "Resident required" });
    return;
  }
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const resident = await prisma.resident.findUnique({ where: { id: residentId } });
  if (!resident) {
    res.status(404).json({ error: "Resident not found" });
    return;
  }
  const existing = await prisma.submission.findFirst({
    where: { eventId: event.id, residentId: resident.id },
    include: { resident: true },
  });
  if (existing) {
    res.json({
      submission: { ...existing, responseData: JSON.parse(existing.responseData) },
    });
    return;
  }
  const submission = await prisma.submission.create({
    data: {
      eventId: event.id,
      residentId: resident.id,
      guestName: `${resident.firstName} ${resident.lastName}`,
      responseData: JSON.stringify(applyAttendanceStatus({}, "present")),
      status: "present",
    },
    include: { resident: true },
  });
  res.json({
    submission: { ...submission, responseData: JSON.parse(submission.responseData) },
  });
});

eventsRouter.post("/:id/set-status", async (req, res) => {
  const statusRaw = String(req.body?.status ?? "").toLowerCase();
  if (statusRaw !== "present" && statusRaw !== "late" && statusRaw !== "excused") {
    res.status(400).json({ error: "Status must be present, late, or excused" });
    return;
  }
  const residentId = String(req.body?.residentId ?? "").trim();
  const submissionId = String(req.body?.submissionId ?? "").trim();
  const note = String(req.body?.note ?? "").trim();
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  let existing = submissionId
    ? await prisma.submission.findFirst({
        where: { id: submissionId, eventId: event.id },
        include: { resident: true },
      })
    : residentId
      ? await prisma.submission.findFirst({
          where: { eventId: event.id, residentId },
          include: { resident: true },
        })
      : null;

  const resident =
    existing?.resident ??
    (residentId ? await prisma.resident.findUnique({ where: { id: residentId } }) : null);
  if (!existing && !resident) {
    res.status(404).json({ error: "Resident not found" });
    return;
  }

  const nextData = applyAttendanceStatus(parseResponseData(existing?.responseData), statusRaw, note);
  if (existing) {
    existing = await prisma.submission.update({
      where: { id: existing.id },
      data: {
        status: statusRaw,
        responseData: JSON.stringify(nextData),
        guestName: existing.guestName || (resident ? `${resident.firstName} ${resident.lastName}` : null),
      },
      include: { resident: true },
    });
  } else if (resident) {
    existing = await prisma.submission.create({
      data: {
        eventId: event.id,
        residentId: resident.id,
        guestName: `${resident.firstName} ${resident.lastName}`,
        responseData: JSON.stringify(nextData),
        status: statusRaw,
      },
      include: { resident: true },
    });
  }

  res.json({
    submission: existing
      ? { ...existing, responseData: parseResponseData(existing.responseData) }
      : null,
  });
});

eventsRouter.post("/:id/unmark", async (req, res) => {
  const submissionId = String(req.body?.submissionId ?? "").trim();
  if (!submissionId) {
    res.status(400).json({ error: "Check-in required" });
    return;
  }
  const removed = await removeSubmission(req.params.id, submissionId);
  if (!removed) {
    res.status(404).json({ error: "Check-in not found" });
    return;
  }
  res.json({ ok: true });
});

eventsRouter.delete("/:id/submissions/:submissionId", async (req, res) => {
  const removed = await removeSubmission(req.params.id, req.params.submissionId);
  if (!removed) {
    res.status(404).json({ error: "Check-in not found" });
    return;
  }
  res.json({ ok: true });
});

eventsRouter.post("/", async (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  const eventTypeId = String(req.body?.eventTypeId ?? "");
  const startsAt = req.body?.startsAt ? new Date(req.body.startsAt) : new Date();
  if (!title || !eventTypeId) {
    res.status(400).json({ error: "Title and type required" });
    return;
  }
  const type = await prisma.eventType.findUnique({ where: { id: eventTypeId } });
  if (!type) {
    res.status(400).json({ error: "Unknown event type" });
    return;
  }
  const locationTracking = Boolean(req.body?.locationTracking ?? true);
  const houseMeeting =
    req.body?.houseMeeting != null ? Boolean(req.body.houseMeeting) : eventIsHouseMeeting({ eventType: type });
  const event = await prisma.event.create({
    data: {
      title,
      eventTypeId,
      startsAt,
      endsAt: req.body?.endsAt ? new Date(req.body.endsAt) : null,
      requireLogin: req.body?.requireLogin !== false,
      locationTracking,
      houseMeeting,
      oneResponse: req.body?.oneResponse !== false,
      acceptingResponses: req.body?.acceptingResponses !== false,
      responsesOpenAt: req.body?.responsesOpenAt ? new Date(req.body.responsesOpenAt) : null,
      responsesCloseAt: req.body?.responsesCloseAt ? new Date(req.body.responsesCloseAt) : null,
      lat: locationTracking ? Number(req.body?.lat ?? BRANNER_LAT) : null,
      lng: locationTracking ? Number(req.body?.lng ?? BRANNER_LNG) : null,
      radiusMeters: locationTracking ? Number(req.body?.radiusMeters ?? 80) : 80,
      formSchema: req.body?.formSchema
        ? JSON.stringify(req.body.formSchema)
        : defaultFormSchema,
      slug: uniqueSlug(title, Date.now().toString(36)),
    },
    include: { eventType: true },
  });
  res.json({ event: { ...event, formSchema: JSON.parse(event.formSchema) } });
});

eventsRouter.patch("/:id", async (req, res) => {
  const data: Record<string, unknown> = {};
  if (req.body.title != null) data.title = String(req.body.title);
  if (req.body.eventTypeId != null) {
    data.eventTypeId = String(req.body.eventTypeId);
    if (req.body.houseMeeting == null) {
      const nextType = await prisma.eventType.findUnique({ where: { id: String(req.body.eventTypeId) } });
      if (nextType) data.houseMeeting = isHouseMeeting(nextType);
    }
  }
  if (req.body.startsAt != null) data.startsAt = new Date(req.body.startsAt);
  if (req.body.endsAt !== undefined)
    data.endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
  if (req.body.requireLogin != null) data.requireLogin = Boolean(req.body.requireLogin);
  if (req.body.locationTracking != null)
    data.locationTracking = Boolean(req.body.locationTracking);
  if (req.body.houseMeeting != null) data.houseMeeting = Boolean(req.body.houseMeeting);
  if (req.body.oneResponse != null) data.oneResponse = Boolean(req.body.oneResponse);
  if (req.body.acceptingResponses != null)
    data.acceptingResponses = Boolean(req.body.acceptingResponses);
  if (req.body.responsesOpenAt !== undefined)
    data.responsesOpenAt = req.body.responsesOpenAt ? new Date(req.body.responsesOpenAt) : null;
  if (req.body.responsesCloseAt !== undefined)
    data.responsesCloseAt = req.body.responsesCloseAt ? new Date(req.body.responsesCloseAt) : null;
  if (req.body.lat !== undefined) data.lat = req.body.lat == null || req.body.lat === "" ? null : Number(req.body.lat);
  if (req.body.lng !== undefined) data.lng = req.body.lng == null || req.body.lng === "" ? null : Number(req.body.lng);
  if (req.body.radiusMeters != null) data.radiusMeters = Number(req.body.radiusMeters);
  if (req.body.formSchema != null) data.formSchema = JSON.stringify(req.body.formSchema);
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data,
    include: { eventType: true },
  });
  res.json({ event: { ...event, formSchema: JSON.parse(event.formSchema) } });
});

eventsRouter.delete("/:id", async (req, res) => {
  await prisma.event.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

async function removeSubmission(eventId: string, submissionId: string) {
  const existing = await prisma.submission.findFirst({
    where: { id: submissionId, eventId },
  });
  if (!existing) return false;
  await prisma.submission.delete({ where: { id: existing.id } });
  return true;
}

function countedSubmissions<
  T extends {
    status?: string | null;
    responseData?: string | Record<string, unknown> | null;
    resident?: { type?: string | null } | null;
    residentId?: string | null;
  },
>(
  event: {
    houseMeeting?: boolean | null;
    eventType?: { slug?: string | null; label?: string | null } | null;
  },
  submissions: T[],
): T[] {
  const visible = submissions.filter((s) => attendanceStatus(s) !== "excused");
  if (!eventIsHouseMeeting(event)) return visible;
  return visible.filter((s) => !isRa(s.resident?.type));
}
